# Website Blocking & Hosts File Manipulation

## 1. Overview & Problem Definition

Blocking websites effectively on modern operating systems poses two distinct engineering challenges:
1. **Network Layer Redirection**: Preventing any browser, API, or application from establishing a TCP/TLS connection to target domain names.
2. **The Socket Keep-Alive Problem**: Even after DNS resolution is altered in the operating system, existing open tabs in modern browsers maintain persistent HTTP/2 or HTTP/3 (QUIC) TCP connections over long-lived keep-alive sockets. As a result, users can continue browsing YouTube or Reddit uninterrupted until the connection drops.

Focus Engine solves both challenges through a combined **Hosts Redirection + Active Tab Termination Pipeline**.

---

## 2. Operating System Hosts Redirection

Located in `src/main/blocking/hostsFileManager.ts`:

### 1. Platform-Specific Path Resolution
```typescript
function getHostsPath(): string {
  if (process.platform === 'win32') {
    const windir = process.env.SystemRoot || 'C:\\Windows'
    return join(windir, 'System32', 'drivers', 'etc', 'hosts')
  }
  return '/etc/hosts'
}
```

### 2. Automatic Backup Protocol
Before any write operation modifies the hosts file, Focus Engine creates a pristine backup copy:
- **Location**: `app.getPath('userData')/hosts.backup`
- **Execution**: Checks if the backup file already exists via `fs.promises.access()`. If not found, asynchronously copies the current hosts file to disk.

### 3. Marker Demarcation Protocol
To prevent corrupting existing user entries (e.g. `localhost`, WSL bindings, or custom local domains), Focus Engine wraps all generated rules within strict comment delimiters:

```text
# --- Existing User Hosts Content ---
127.0.0.1 localhost
::1 localhost

# FOCUS_ENGINE_BLOCK_START
127.0.0.1 youtube.com
127.0.0.1 www.youtube.com
127.0.0.1 reddit.com
127.0.0.1 www.reddit.com
127.0.0.1 twitter.com
127.0.0.1 www.twitter.com
# FOCUS_ENGINE_BLOCK_END
```

### 4. Strip & Clean Algorithm
When deactivating blocking, `stripBlockingBlock()` cleans the hosts content using index slicing and fallback regular expressions:
```typescript
function stripBlockingBlock(content: string): string {
  const startIndex = content.indexOf(BLOCK_START_MARKER)
  const endIndex = content.indexOf(BLOCK_END_MARKER)

  if (startIndex !== -1 && endIndex !== -1) {
    const before = content.substring(0, startIndex)
    const after = content.substring(endIndex + BLOCK_END_MARKER.length)
    return before.trimEnd() + '\n' + after.trimStart()
  }

  return content
    .replace(new RegExp(`\\n?${BLOCK_START_MARKER}[\\s\\S]*?${BLOCK_END_MARKER}\\n?`, 'g'), '\n')
    .replace(new RegExp(`\\n?${BLOCK_START_MARKER}.*`, 'g'), '')
    .replace(new RegExp(`.*${BLOCK_END_MARKER}\\n?`, 'g'), '')
}
```

---

## 3. Resolving the Keep-Alive Socket Problem (`tabCloser.ts`)

To break active keep-alive connections immediately upon session start, `closeActiveBlockedTabs()` inspects running browsers and closes matching windows or tabs.

### 1. Keyword Extraction
Given a list of blocked domains (e.g. `['youtube.com', 'www.reddit.com']`), the engine extracts bare matching keywords:
```typescript
const keywords = domains
  .map((domain) => {
    const parts = domain.split('.')
    return parts[0] === 'www' ? parts[1] : parts[0]
  })
  .map(sanitizeKeyword) // "youtube", "reddit"
```

### 2. Windows Enforcement (PowerShell `CloseMainWindow`)
On Windows, Focus Engine uses PowerShell via `execFile` targeting known browsers (`chrome, brave, msedge, firefox, opera, iexplore`):
```powershell
$keywords = @('youtube', 'reddit');
Get-Process -Name chrome, brave, msedge, firefox, opera, iexplore -ErrorAction SilentlyContinue | Where-Object {
  $title = $_.MainWindowTitle;
  $match = $false;
  if ($title) {
    foreach ($k in $keywords) {
      if ($title.ToLower().Contains($k.ToLower())) { $match = $true; break }
    }
  };
  $match
} | ForEach-Object { $_.CloseMainWindow() }
```
- Calls `CloseMainWindow()`, which sends a clean `WM_CLOSE` message to the window.
- This immediately closes the active distracting window, severing all persistent TCP/TLS sockets. Any subsequent attempt to open the website forces a fresh DNS request, hitting `127.0.0.1` and failing.

### 3. macOS Enforcement (AppleScript Tab Closing)
On macOS, Focus Engine can inspect browser tabs individually via AppleScript (`osascript`), closing only the offending tabs rather than closing the entire browser window:
```applescript
tell application "Google Chrome"
  repeat with w in windows
    repeat with t in tabs of w
      if title of t contains "youtube" or URL of t contains "youtube" then
        close t
      end if
    end repeat
  end repeat
end tell
```

---

## 4. Administrative Permissions & Error Formatting

Writing to the hosts file requires OS elevated privileges (`Administrator` on Windows, `root` on Unix).
If Focus Engine is launched without appropriate permissions, Node.js throws `EACCES` or `EPERM`.

Focus Engine intercepts this in `handleWriteError(error)` and presents clear, human-actionable guidance:
```text
Permission Denied: Focus Engine lacks administrative permissions to modify the hosts file.

How to fix:
- Windows: Close your terminals, open PowerShell or Command Prompt as Administrator, and run "npm run dev".
- macOS/Linux: Run the dev server with sudo: "sudo npm run dev".
```
This message is returned across the IPC channel and displayed directly in the UI dashboard as a banner, allowing users to understand the permission requirements immediately.
