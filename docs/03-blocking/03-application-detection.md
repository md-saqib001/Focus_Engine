# Application Detection & Termination

## 1. Overview

Focus Engine enforces process boundaries by detecting and terminating unauthorized desktop applications. This document explains the low-level OS process enumeration, security sanitization, termination mechanics, and event logging.

---

## 2. Process Enumeration Across Platforms

Located in `src/main/blocking/processManager.ts` under `getRunningProcesses()`:

### Windows Implementation (`tasklist`)
```typescript
const { stdout } = await execFileAsync('tasklist', ['/FO', 'CSV', '/NH'])
```
- **Arguments**:
  - `/FO CSV`: Formats the process table as structured comma-separated values.
  - `/NH`: "No Headers" — omits column titles (`Image Name`, `PID`, `Session Name`, etc.) to streamline parsing.
- **Parsing Logic**:
  - Splits output by newline `\r?\n`.
  - Splits CSV fields: `line.split('","')`.
  - Extracts column 0 (`match[0]`), removes surrounding quotes, and collects process names (e.g. `Discord.exe`, `Steam.exe`, `chrome.exe`).

### Unix & macOS Implementation (`ps`)
```typescript
const { stdout } = await execFileAsync('ps', ['-A', '-o', 'comm'])
```
- **Arguments**:
  - `-A`: Selects all running processes across all users and sessions.
  - `-o comm`: Outputs only the executable command basename, omitting CPU, memory, and PID columns.
- **Parsing Logic**:
  - Trims lines, filters out headers (`COMM`, `command`), and runs `basename(trimmed)` to ensure consistent relative executable names.

---

## 3. Security: Command Injection Elimination

Because application names can be entered by users in `Settings.tsx` (e.g. adding a custom game or tool), directly interpolating untrusted input into shell commands is a major security vulnerability (CWE-78: OS Command Injection).

Focus Engine applies two defensive layers:

### Layer 1: Strict Whitelist Regex Sanitization
```typescript
export function sanitizeProcessName(name: string): string {
  const clean = name.trim()
  const allowedPattern = /^[a-zA-Z0-9_-]+$/
  if (!allowedPattern.test(clean)) {
    throw new Error(
      `Invalid process name: "${name}". Process names may only contain ` +
      `alphanumeric characters, hyphens, and underscores.`
    )
  }
  return clean
}
```
Any attempt to insert characters like `;`, `&`, `|`, `` ` ``, `$`, `>`, `<`, or whitespace throws an immediate validation exception before any OS command is spawned.

### Layer 2: `execFile` Instead of `exec`
Node.js `exec()` passes a raw command string to `/bin/sh` or `cmd.exe`, which parses shell metacharacters.
In contrast, Focus Engine strictly uses `execFile('taskkill', ['/F', '/IM', exeName])`, passing executable arguments as a pre-tokenized array. The operating system kernel spawns the executable directly without invoking a command shell.

---

## 4. Force Termination Mechanics

Located in `killProcess(appName: string)`:

### Windows (`taskkill`)
```typescript
const exeName = `${cleanName}.exe`
await execFileAsync('taskkill', ['/F', '/IM', exeName])
```
- `/F`: Specifies that processes are forcefully terminated.
- `/IM`: Specifies the image name of the process to be terminated.

### Unix / macOS (`pkill`)
```typescript
await execFileAsync('pkill', ['-i', cleanName])
```
- `-i`: Case-insensitive pattern matching.

### Graceful Non-Existent Process Handling
If a blacklisted app is not actively running when `killProcess` executes, standard OS CLI tools return non-zero exit codes:
- Windows `taskkill`: Returns **exit code 128** (`ERROR_NOT_FOUND`).
- Unix `pkill`: Returns **exit code 1** (`no processes matched`).

Focus Engine swallows these exit codes gracefully without throwing errors:
```typescript
if (error.code === 128 || (error.message && error.message.includes('not found'))) {
  console.log(`[ProcessManager] process "${exeName}" was not running (swallowed exit code 128)`)
  return false
}
```

---

## 5. Database Audit Logging

Every time an application is terminated, an audit record is inserted into SQLite:

```typescript
// src/main/ipc/appBlockingHandlers.ts
for (const app of killed) {
  logKillEvent(args.sessionId, app)
}
```

### Table: `blacklisted_app_kills`
```sql
INSERT INTO blacklisted_app_kills (session_id, app_name, killed_at)
VALUES (?, ?, ?);
```

This data is used to:
1. Populate `appsKilled: string[]` in the frontend session summary modal.
2. Feed `recommendationEngine.ts` to identify the user's most frequently blocked distraction applications.
