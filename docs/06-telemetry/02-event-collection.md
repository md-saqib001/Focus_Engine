# OS Event Collection Mechanics

## 1. Foreground Window & Title Extraction

Located in `src/main/telemetry/activeWindowTracker.ts`:

### Windows Implementation (Win32 Dynamic C# Invocation)
To obtain the foreground window without deploying native C++ `.node` binaries, Focus Engine dynamically compiles an in-memory Win32 bridge via PowerShell:

```csharp
using System;
using System.Runtime.InteropServices;
using System.Text;

namespace Win32 {
  public class ActiveWin {
    [DllImport("user32.dll")] 
    public static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")] 
    public static extern int GetWindowThreadProcessId(IntPtr hWnd, out int lpdwProcessId);

    [DllImport("user32.dll")] 
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
  }
}
```

#### Execution Logic:
1. `GetForegroundWindow()` retrieves the OS window handle (`HWND`) of the frontmost window.
2. `GetWindowThreadProcessId(hwnd, ref targetPid)` extracts the Windows process identifier (PID) owning that window.
3. If `targetPid !== $PID` (ignoring the background PowerShell process itself):
   - `GetWindowText(hwnd, titleBuffer, 512)` retrieves the window title text string.
   - `Get-Process -Id targetPid` queries the process image name (`ProcessName`).
   - Emits structured output: `ProcessName + "|||" + Title`.
4. Node.js splits by `|||` to yield `{ appName, windowTitle }`.

---

### macOS Implementation (AppleScript)
```applescript
tell application "System Events"
  set activeApp to name of first application process whose frontmost is true
  tell process activeApp
    try
      set activeWindow to name of first window
    on error
      set activeWindow to ""
    end try
  end tell
  return activeApp & "|||" & activeWindow
end tell
```
- Queries `System Events` to identify the frontmost process.
- Queries `first window` to retrieve the active document or tab title.

---

### Linux Implementation (`xdotool`)
On X11 Linux environments, Focus Engine falls back to executing:
```bash
xdotool getactivewindow getwindowname
```

---

## 2. Keystroke Pulse Capture (`keystrokeCounter.ts`)

Capturing typing activity without invading privacy requires an aggregate pulse counter design:

1. **Non-Content Capture**: The low-level hook intercepts `WM_KEYDOWN` (Windows) or `keyDown` events.
2. **Atomic Counter Increment**:
   ```typescript
   let rawCount = 0
   function onKeyHookEvent() {
     rawCount++
     activityTimestampTracker.recordActivity()
   }
   ```
3. **Reset on Read**: When `kpmTracker` records a minute segment, it calls `keystrokeCounter.resetCount()`, which atomically returns `rawCount` and resets it to `0`.
4. **Security Guarantee**: Because keycodes (`VK_A`, `VK_ENTER`, etc.) are never passed to the callback or stored in any data structure, it is technically impossible for Focus Engine to act as a keylogger.

---

## 3. Mouse Movement & Click Kinematics (`mouseTracker.ts`)

Mouse activity reflects fine-motor user engagement:
1. **Position Sampling**: Samples $(X, Y)$ screen coordinates at discrete intervals.
2. **Displacement Vector Math**:
   $$\Delta d = \sqrt{(X_2 - X_1)^2 + (Y_2 - Y_1)^2}$$
3. **Movement vs. Jitter Filtering**: Movements $< 3\text{ px}$ are discarded as sensor jitter or hardware noise.
4. **Click Detection**: Increments a click counter on mouse down events and updates `activityTimestampTracker`.

---

## 4. Telemetry Health Checking (`telemetryHealthCheck.ts`)

Operating system hooks can occasionally stall or freeze if the host OS enters sleep or experiences high thread contention.

`TelemetryHealthCheck` runs every **10 seconds**:
- Checks `kpmTracker.getLastTickTime()`
- Checks `mouseMetricsTracker.getLastTickTime()`
- Checks `telemetryPoller.getLastTickTime()`
- If any timestamp is $> 15\text{ seconds}$ old while a session is active, it flags a health violation and broadcasts `telemetry:healthWarning` to the UI:
  ```typescript
  window.webContents.send('telemetry:healthWarning', {
    window: isWindowAlive,
    kpm: isKpmAlive,
    mouse: isMouseAlive
  })
  ```
  The UI displays an ambient warning banner alerting the user to restart background tracking if necessary.
