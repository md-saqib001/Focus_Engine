import { execFile } from 'child_process'
import { promisify } from 'util'
import { basename } from 'path'

const execFileAsync = promisify(execFile)

/**
 * Validates and sanitizes a process name to prevent shell command injection.
 * Reject any characters that are not alphanumeric, hyphens, or underscores.
 */
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

/**
 * Returns a list of active process names on the system.
 */
export async function getRunningProcesses(): Promise<string[]> {
  const processes: string[] = []

  if (process.platform === 'win32') {
    try {
      const { stdout } = await execFileAsync('tasklist', ['/FO', 'CSV', '/NH'])
      const lines = stdout.split(/\r?\n/)
      for (const line of lines) {
        if (!line.trim()) continue
        const match = line.split('","')
        if (match && match[0]) {
          const name = match[0].replace(/^"/, '').trim()
          if (name) {
            processes.push(name)
          }
        }
      }
    } catch (error) {
      console.error('[ProcessManager] Failed to get running processes on Windows:', error)
    }
  } else {
    try {
      const { stdout } = await execFileAsync('ps', ['-A', '-o', 'comm'])
      const lines = stdout.split(/\r?\n/)
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed === 'COMM' || trimmed === 'command') continue
        processes.push(basename(trimmed))
      }
    } catch (error) {
      console.error('[ProcessManager] Failed to get running processes on Unix:', error)
    }
  }

  return processes
}

/**
 * Terminates a process by its name using execFile to avoid command injection.
 * Sanitizes input to allow only alphanumeric, hyphens, and underscores.
 * Gracefully swallows exit codes 1 (pkill) and 128 (taskkill) representing process not found.
 * Returns true if the process was terminated, false if not found.
 */
export async function killProcess(appName: string): Promise<boolean> {
  const cleanName = sanitizeProcessName(appName)

  if (process.platform === 'win32') {
    const exeName = `${cleanName}.exe`
    try {
      await execFileAsync('taskkill', ['/F', '/IM', exeName])
      return true
    } catch (error: any) {
      // Exit code 128 means process not found
      if (error.code === 128 || (error.message && error.message.includes('not found'))) {
        console.log(`[ProcessManager] process "${exeName}" was not running (swallowed taskkill exit code 128)`)
        return false
      }
      throw error
    }
  } else {
    try {
      await execFileAsync('pkill', ['-i', cleanName])
      return true
    } catch (error: any) {
      // Exit code 1 means no processes matched
      if (error.code === 1) {
        console.log(`[ProcessManager] process "${cleanName}" was not running (swallowed pkill exit code 1)`)
        return false
      }
      throw error
    }
  }
}

/**
 * Loops through the given appNames, calls killProcess, and returns the result breakdown.
 */
export async function killBlacklistedApps(appNames: string[]): Promise<{
  killed: string[]
  notFound: string[]
}> {
  const killed: string[] = []
  const notFound: string[] = []

  for (const app of appNames) {
    try {
      const wasKilled = await killProcess(app)
      if (wasKilled) {
        killed.push(app)
      } else {
        notFound.push(app)
      }
    } catch (error) {
      console.error(`[ProcessManager] Failed to kill ${app}:`, error)
      notFound.push(app)
    }
  }

  return { killed, notFound }
}
