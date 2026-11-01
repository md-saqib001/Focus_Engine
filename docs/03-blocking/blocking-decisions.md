# Blocking Engineering Decisions

## 1. Overview

This document reviews the engineering rationale, trade-offs, evaluated alternatives, and known constraints of the Blocking Subsystem in Focus Engine.

---

## 2. Key Architectural Decisions

### Decision 1: OS Hosts File Redirection vs. Local HTTP/DNS Proxy vs. Browser Extension

- **Context**: The application must block distracting websites across the entire workstation.
- **Choice**: Direct modification of the operating system `hosts` file (`127.0.0.1 <domain>`), delimited by custom block comment markers.
- **Rationale**:
  - **Browser Independence**: Works identically across Google Chrome, Brave, Edge, Firefox, Opera, and any new browser the user installs.
  - **Zero Background Resource Overhead**: A local DNS or HTTP proxy requires a persistent Node.js or Go server listening on port 53/8080, consuming memory and introducing network latency. The hosts file is resolved natively by the OS kernel in microseconds.
  - **Bypasses Browser Extensions**: Extensions can be disabled in incognito mode or easily toggled off by users in moments of weakness.
- **Trade-offs**:
  - *Advantage*: Zero runtime overhead, universal coverage across all applications.
  - *Disadvantage*: Requires administrative privileges (`Administrator` on Windows, `root` on Unix).
  - *Known Limitation (DNS-over-HTTPS)*: Modern browsers with **DoH (DNS-over-HTTPS)** enabled by default may bypass OS hosts resolution. (Mitigated in Focus Engine by the active `tabCloser` which inspects window titles directly).
- **Alternatives Considered**:
  - *Local Forward Proxy*: Intercepting traffic via PAC files. Rejected due to SSL certificate pinning and TLS root certificate installation complexity.
  - *Chrome Extension WebRequest API*: Rejected because Manifest V3 severely limits dynamic blocking rules (`declarativeNetRequest`) and it only protects Chrome.

---

### Decision 2: Detached Headless Electron Watchdog vs. Native Windows Service

- **Context**: Guarding against permanent hosts corruption if Focus Engine crashes or is abruptly terminated.
- **Choice**: Spawning a detached Node.js script using `process.execPath` with `ELECTRON_RUN_AS_NODE: '1'`.
- **Rationale**:
  - Zero external installation dependencies: Reuses the already-bundled Electron binary.
  - Avoids requiring a separate Windows Service or systemd daemon installation step during app setup.
  - Lightweight: The headless Node process consumes minimal memory and polls parent liveness via non-invasive `process.kill(parentPid, 0)`.
- **Trade-offs**:
  - *Advantage*: Self-contained, portable, zero install overhead, cross-platform.
  - *Disadvantage*: If the entire machine loses power or undergoes a hard kernel panic (BSOD), the watchdog cannot execute until the next OS boot. Focus Engine mitigates this by validating and cleaning old markers upon subsequent app startup.

---

### Decision 3: Window Title Close Scripting vs. OS Network Packet Filtering (WFP/iptables)

- **Context**: Addressing persistent HTTP/2 keep-alive sockets for websites already open when a session starts.
- **Choice**: PowerShell `Get-Process ... CloseMainWindow()` on Windows and AppleScript `osascript` on macOS.
- **Rationale**:
  - Packet filtering via Windows Filtering Platform (WFP) requires a signed Windows Kernel Driver (`.sys`), adding massive development, maintenance, and driver-signing friction.
  - PowerShell scripting cleanly requests browsers to close target windows or tabs via standard window messages without crashing the browser or losing unsaved work.
- **Trade-offs**:
  - *Advantage*: User-friendly, requires no kernel drivers, immediately breaks keep-alive sockets.
  - *Disadvantage*: On Windows, closes the entire browser window containing the distracting tab rather than only the single tab (unlike macOS which supports granular AppleScript tab querying).

---

### Decision 4: Synchronous Cleanup During App Shutdown (`restoreHostsSync`)

- **Context**: When a user quits Electron via menu or hotkey, Electron fires `before-quit` and immediately terminates the Node event loop once the event handlers finish.
- **Choice**: Executing `fs.readFileSync` and `fs.writeFileSync` synchronously in `restoreHostsSync()`.
- **Rationale**:
  - Asynchronous promises (`fs.promises.writeFile`) dispatched during `before-quit` may be aborted mid-flight as the runtime tears down.
  - Synchronous I/O blocks the thread for $< 5\text{ ms}$, ensuring 100% completion before the process exits.

---

## 3. Known Limitations & Future Roadmap

1. **DNS-over-HTTPS (DoH)**:
   - *Limitation*: If a browser uses DoH (e.g. Cloudflare 1.1.1.1 or Google 8.8.8.8) with strict fallback disabled, it may resolve domains via encrypted HTTPS directly, ignoring `hosts`.
   - *Future Recommendation*: Add detection in `Settings.tsx` to detect DoH in browser policies or provide automated registry script toggles.
2. **Subdomain Granularity**:
   - *Limitation*: The hosts file cannot block specific URL paths (e.g. blocking `youtube.com/shorts` while allowing educational videos on `youtube.com`). It operates on domain granularity only.
   - *Future Recommendation*: Pair the hosts blocker with an optional Focus Engine companion browser extension for URL-path filtering.
