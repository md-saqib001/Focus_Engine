import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

/**
 * Sanitizes a keyword for safe use in PowerShell or AppleScript commands.
 * Strips everything except alphanumeric characters to prevent injection.
 */
function sanitizeKeyword(keyword: string): string {
  return keyword.replace(/[^a-zA-Z0-9]/g, '')
}

/**
 * Closes browser windows (Windows) or individual tabs (macOS) matching the blocked domains.
 * This terminates active sockets and forces a new DNS request on reconnect.
 */
export async function closeActiveBlockedTabs(domains: string[]): Promise<void> {
  if (domains.length === 0) return

  // Extract clean keywords for title matching (e.g. "youtube.com" -> "youtube")
  const keywords = domains
    .map((domain) => {
      const parts = domain.split('.')
      return parts[0] === 'www' ? parts[1] : parts[0]
    })
    .map(sanitizeKeyword)
    .filter((k) => k.length > 0)

  if (keywords.length === 0) return

  if (process.platform === 'win32') {
    await closeWindowsOnWindows(keywords)
  } else if (process.platform === 'darwin') {
    await closeTabsOnMac(keywords)
  }
}

/**
 * On Windows, we find running browser processes with window titles containing our keywords
 * and request a clean window close (CloseMainWindow).
 * We explicitly restrict this to known web browsers to avoid closing our own Electron app or shell.
 *
 * Uses execFile('powershell', [...]) instead of exec() to avoid shell injection.
 * Keywords are pre-sanitized to alphanumeric-only before being interpolated.
 */
async function closeWindowsOnWindows(keywords: string[]): Promise<void> {
  const psArray = keywords.map((k) => `'${k}'`).join(', ')
  const browserNames = "chrome, brave, msedge, firefox, opera, iexplore"
  
  const script = [
    `$keywords = @(${psArray});`,
    `Get-Process -Name ${browserNames} -ErrorAction SilentlyContinue | Where-Object {`,
    `  $title = $_.MainWindowTitle;`,
    `  $match = $false;`,
    `  if ($title) {`,
    `    foreach ($k in $keywords) {`,
    `      if ($title.ToLower().Contains($k.ToLower())) { $match = $true; break }`,
    `    }`,
    `  };`,
    `  $match`,

    `} | ForEach-Object { $_.CloseMainWindow() }`
  ].join(' ')

  try {
    // Pass the script as an argument to powershell.exe via execFile
    // so the OS does not interpret metacharacters in the outer shell
    await execFileAsync('powershell', ['-NoProfile', '-Command', script])
    console.log('[TabCloser] Sent close signals to matching browser windows on Windows')
  } catch (error) {
    console.error('[TabCloser] Failed to close windows on Windows:', error)
  }
}

/**
 * On macOS, we can target Chrome, Brave, and Safari specifically using AppleScript
 * to close matching tabs individually without closing the entire window.
 *
 * Uses execFile('osascript', ['-e', script]) instead of exec() to avoid shell injection.
 * Keywords are pre-sanitized to alphanumeric-only before being interpolated.
 */
async function closeTabsOnMac(keywords: string[]): Promise<void> {
  const appleScriptConditions = keywords
    .map((k) => `title of t contains "${k}" or URL of t contains "${k}"`)
    .join(' or ')

  const script = `
    tell application "Google Chrome"
      repeat with w in windows
        repeat with t in tabs of w
          if ${appleScriptConditions} then
            close t
          end if
        end repeat
      end repeat
    end tell
    tell application "Brave Browser"
      repeat with w in windows
        repeat with t in tabs of w
          if ${appleScriptConditions} then
            close t
          end if
        end repeat
      end repeat
    end tell
    tell application "Safari"
      repeat with w in windows
        repeat with t in tabs of w
          if ${appleScriptConditions} then
            close t
          end if
        end repeat
      end repeat
    end tell
  `

  try {
    await execFileAsync('osascript', ['-e', script])
    console.log('[TabCloser] Closed matching browser tabs on macOS')
  } catch (error) {
    console.error('[TabCloser] Failed to close tabs on macOS:', error)
  }
}
