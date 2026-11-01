import { execFile } from 'child_process'
import { promisify } from 'util'
import { basename } from 'path'

const execFileAsync = promisify(execFile)

export interface ActiveWindowInfo {
  appName: string
  windowTitle: string
}

/**
 * Platform-independent check to get the frontmost/active window and process.
 * Never throws, returns null if unable to resolve.
 */
export async function getActiveWindow(): Promise<ActiveWindowInfo | null> {
  try {
    if (process.platform === 'win32') {
      return await getWindowsActiveWindow()
    } else if (process.platform === 'darwin') {
      return await getMacActiveWindow()
    } else if (process.platform === 'linux') {
      return await getLinuxActiveWindow()
    }
  } catch (error) {
    console.error('[ActiveWindowTracker] Failed to get active window:', error)
  }
  return null
}

/**
 * Windows implementation using user32.dll Win32 APIs loaded dynamically in PowerShell
 * to find the exact active foreground process and title.
 */
async function getWindowsActiveWindow(): Promise<ActiveWindowInfo | null> {
  const script = `
    $code = @'
    using System;
    using System.Runtime.InteropServices;
    using System.Text;
    namespace Win32 {
      public class ActiveWin {
        [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
        [DllImport("user32.dll")] public static extern int GetWindowThreadProcessId(IntPtr hWnd, out int lpdwProcessId);
        [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
      }
    }
'@
    if (-not ([System.Management.Automation.PSTypeName]'Win32.ActiveWin').Type) {
      Add-Type -TypeDefinition $code -ErrorAction SilentlyContinue
    }
    $hwnd = [Win32.ActiveWin]::GetForegroundWindow()
    if ($hwnd -ne [IntPtr]::Zero) {
      $targetPid = 0
      [void][Win32.ActiveWin]::GetWindowThreadProcessId($hwnd, [ref]$targetPid)
      if ($targetPid -ne $PID) {
        $title = New-Object System.Text.StringBuilder(512)
        [void][Win32.ActiveWin]::GetWindowText($hwnd, $title, 512)
        $proc = Get-Process -Id $targetPid -ErrorAction SilentlyContinue
        if ($proc) {
          Write-Output ($proc.ProcessName + "|||" + $title.ToString())
        }
      }
    }
  `.trim()

  try {
    const { stdout } = await execFileAsync('powershell', ['-NoProfile', '-Command', script])
    const result = stdout.trim()
    if (result && result.includes('|||')) {
      const parts = result.split('|||')
      return {
        appName: parts[0].trim(),
        windowTitle: parts[1].trim() || 'Untitled Window'
      }
    }
  } catch (err) {
    console.error('[ActiveWindowTracker] Windows PowerShell telemetry failed:', err)
  }
  return null
}

/**
 * macOS implementation using AppleScript to query frontmost window and application.
 */
async function getMacActiveWindow(): Promise<ActiveWindowInfo | null> {
  const script = `
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
  `.trim()

  try {
    const { stdout } = await execFileAsync('osascript', ['-e', script])
    const result = stdout.trim()
    if (result && result.includes('|||')) {
      const parts = result.split('|||')
      return {
        appName: parts[0].trim(),
        windowTitle: parts[1].trim() || 'Untitled Window'
      }
    }
  } catch (err) {
    console.error('[ActiveWindowTracker] macOS osascript telemetry failed:', err)
  }
  return null
}

/**
 * Linux implementation using xdotool and ps command.
 */
async function getLinuxActiveWindow(): Promise<ActiveWindowInfo | null> {
  try {
    // 1. Get active window ID
    const { stdout: winIdStr } = await execFileAsync('xdotool', ['getactivewindow'])
    const winId = winIdStr.trim()
    if (!winId) return null

    // 2. Get process PID
    const { stdout: pidStr } = await execFileAsync('xdotool', ['getwindowpid', winId])
    const pid = pidStr.trim()

    // 3. Get window title
    const { stdout: titleStr } = await execFileAsync('xdotool', ['getwindowname', winId])
    const title = titleStr.trim()

    let appName = 'Unknown'
    if (pid) {
      // 4. Resolve process command name
      const { stdout: nameStr } = await execFileAsync('ps', ['-p', pid, '-o', 'comm='])
      appName = basename(nameStr.trim())
    }

    return {
      appName,
      windowTitle: title || 'Untitled Window'
    }
  } catch (err) {
    console.error('[ActiveWindowTracker] Linux xdotool telemetry failed:', err)
  }
  return null
}
