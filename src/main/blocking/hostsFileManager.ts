import { app } from 'electron'
import { join } from 'path'
import * as fs from 'fs'
import { startWatchdog, stopWatchdog } from './watchdogManager'

const BLOCK_START_MARKER = '# FOCUS_ENGINE_BLOCK_START'
const BLOCK_END_MARKER = '# FOCUS_ENGINE_BLOCK_END'

function getHostsPath(): string {
  if (process.platform === 'win32') {
    const windir = process.env.SystemRoot || 'C:\\Windows'
    return join(windir, 'System32', 'drivers', 'etc', 'hosts')
  }
  return '/etc/hosts'
}

function getBackupPath(): string {
  return join(app.getPath('userData'), 'hosts.backup')
}

/**
 * Backs up the hosts file asynchronously if no backup has been created yet.
 */
export async function backupHosts(): Promise<void> {
  const hostsPath = getHostsPath()
  const backupPath = getBackupPath()

  try {
    await fs.promises.access(backupPath)
    return // Backup already exists
  } catch {
    // File doesn't exist, proceed to create backup
  }

  try {
    const content = await fs.promises.readFile(hostsPath, 'utf8')
    await fs.promises.writeFile(backupPath, content, 'utf8')
    console.log(`[HostsManager] Created backup at: ${backupPath}`)
  } catch (error) {
    console.error('[HostsManager] Failed to create backup:', error)
  }
}

/**
 * Returns true if the hosts file currently has our blocking marker block.
 */
export async function isBlockingActive(): Promise<boolean> {
  const hostsPath = getHostsPath()
  try {
    const content = await fs.promises.readFile(hostsPath, 'utf8')
    return content.includes(BLOCK_START_MARKER)
  } catch (error) {
    console.error('[HostsManager] Failed to check blocking status:', error)
    return false
  }
}

/**
 * Appends the blocked domains block to the hosts file asynchronously.
 */
export async function blockDomains(domains: string[]): Promise<void> {
  // Ensure we have a backup before modifying anything
  await backupHosts()

  const hostsPath = getHostsPath()
  let content = ''

  try {
    content = await fs.promises.readFile(hostsPath, 'utf8')
  } catch (error) {
    throw new Error(
      `Failed to read hosts file: ${String(error)}. ` +
      `Ensure the application is running with administrative/root privileges.`
    )
  }

  // Clean out any existing markers first
  content = stripBlockingBlock(content)

  if (domains.length === 0) {
    try {
      await fs.promises.writeFile(hostsPath, content, 'utf8')
      stopWatchdog()
      return
    } catch (error: any) {
      handleWriteError(error)
    }
  }

  // Build the new blocking block
  const lines: string[] = []
  lines.push(`\n${BLOCK_START_MARKER}`)
  for (const domain of domains) {
    lines.push(`127.0.0.1 ${domain}`)
    if (!domain.startsWith('www.')) {
      lines.push(`127.0.0.1 www.${domain}`)
    }
  }
  lines.push(BLOCK_END_MARKER)

  const updatedContent = content.trimEnd() + lines.join('\n') + '\n'

  try {
    await fs.promises.writeFile(hostsPath, updatedContent, 'utf8')
    console.log('[HostsManager] Web blocking active. Blocked domains:', domains)
    startWatchdog(hostsPath)
  } catch (error: any) {
    handleWriteError(error)
  }
}

/**
 * Restores the hosts file asynchronously by stripping out the focus-engine block.
 */
export async function restoreHosts(): Promise<void> {
  const hostsPath = getHostsPath()
  try {
    try {
      await fs.promises.access(hostsPath)
    } catch {
      return // Hosts file doesn't exist
    }
    const content = await fs.promises.readFile(hostsPath, 'utf8')
    if (!content.includes(BLOCK_START_MARKER)) return // Nothing to restore

    const cleaned = stripBlockingBlock(content)
    await fs.promises.writeFile(hostsPath, cleaned, 'utf8')
    console.log('[HostsManager] Web blocking deactivated. Hosts restored.')
    stopWatchdog()
  } catch (error: any) {
    console.error('[HostsManager] Failed to restore hosts file:', error)
  }
}

/**
 * Synchronous version of restoreHosts for use in shutdown paths (before-quit)
 * where async operations cannot be awaited. Uses fs.readFileSync/writeFileSync
 * intentionally — blocking is acceptable during app shutdown.
 */
export function restoreHostsSync(): void {
  const hostsPath = getHostsPath()
  try {
    if (!fs.existsSync(hostsPath)) return
    const content = fs.readFileSync(hostsPath, 'utf8')
    if (!content.includes(BLOCK_START_MARKER)) return

    const cleaned = stripBlockingBlock(content)
    fs.writeFileSync(hostsPath, cleaned, 'utf8')
    console.log('[HostsManager] Web blocking deactivated (sync shutdown). Hosts restored.')
    stopWatchdog()
  } catch (error: any) {
    console.error('[HostsManager] Failed to restore hosts file on shutdown:', error)
  }
}

/**
 * Helper to strip the blocking block from file content.
 */
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

/**
 * Formats write errors into clean, human-actionable permission recommendations.
 */
function handleWriteError(error: any): never {
  const code = error.code || ''
  if (code === 'EACCES' || code === 'EPERM') {
    throw new Error(
      `Permission Denied: Focus Engine lacks administrative permissions to modify the hosts file.\n\n` +
      `How to fix:\n` +
      `- Windows: Close your terminals, open PowerShell or Command Prompt as Administrator, and run "npm run dev".\n` +
      `- macOS/Linux: Run the dev server with sudo: "sudo npm run dev".`
    )
  }
  throw new Error(`Failed to write to hosts file: ${error.message || String(error)}`)
}