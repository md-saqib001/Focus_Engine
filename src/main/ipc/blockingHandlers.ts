import { ipcMain } from 'electron'
import {
  getAllBlockedDomains,
  getEnabledBlockedDomains,
  addBlockedDomain,
  removeBlockedDomain,
  toggleBlockedDomain
} from '../database/blockedDomainsRepository'
import {
  blockDomains,
  restoreHosts,
  isBlockingActive
} from '../blocking/hostsFileManager'
import { closeActiveBlockedTabs } from '../blocking/tabCloser'

let tabCloserInterval: NodeJS.Timeout | null = null

export function registerBlockingHandlers(): void {
  // Start active blocking (writes to hosts file and closes existing tabs)
  ipcMain.handle('blocking:start', async () => {
    try {
      const domains = getEnabledBlockedDomains()
      await blockDomains(domains)
      
      // Fire-and-forget immediate close of active browser tabs containing blocked domains
      closeActiveBlockedTabs(domains).catch((err) =>
        console.error('[IPC blocking:start] Tab closer error:', err)
      )

      // Clear any existing active tab closer interval
      if (tabCloserInterval) {
        clearInterval(tabCloserInterval)
        tabCloserInterval = null
      }

      // Periodically check and close matching tabs every 30 seconds (30,000 ms) while focus is on
      tabCloserInterval = setInterval(() => {
        closeActiveBlockedTabs(domains).catch((err) =>
          console.error('[IPC tabCloserInterval] Tab closer error:', err)
        )
      }, 30000)

      return { success: true }
    } catch (error: any) {
      console.error('[IPC blocking:start]', error)
      return { success: false, error: error.message || String(error) }
    }
  })

  // Stop active blocking (removes block from hosts file)
  ipcMain.handle('blocking:stop', async () => {
    try {
      // Safely clear the active tab closer interval
      if (tabCloserInterval) {
        clearInterval(tabCloserInterval)
        tabCloserInterval = null
      }
      
      await restoreHosts()
      return { success: true }
    } catch (error: any) {
      console.error('[IPC blocking:stop]', error)
      return { success: false, error: error.message || String(error) }
    }
  })

  // Get active blocking status
  ipcMain.handle('blocking:status', async () => {
    try {
      const active = await isBlockingActive()
      return { success: true, data: active }
    } catch (error: any) {
      console.error('[IPC blocking:status]', error)
      return { success: false, error: error.message || String(error) }
    }
  })

  // Get all configured domains in the repository
  ipcMain.handle('blocking:getDomains', async () => {
    try {
      const list = getAllBlockedDomains()
      return { success: true, data: list }
    } catch (error: any) {
      console.error('[IPC blocking:getDomains]', error)
      return { success: false, error: error.message || String(error) }
    }
  })

  // Add a domain to the configured list
  ipcMain.handle('blocking:addDomain', async (_event, domain: string) => {
    try {
      addBlockedDomain(domain)
      return { success: true }
    } catch (error: any) {
      console.error('[IPC blocking:addDomain]', error)
      return { success: false, error: error.message || String(error) }
    }
  })

  // Remove a domain from the configured list
  ipcMain.handle('blocking:removeDomain', async (_event, domain: string) => {
    try {
      removeBlockedDomain(domain)
      return { success: true }
    } catch (error: any) {
      console.error('[IPC blocking:removeDomain]', error)
      return { success: false, error: error.message || String(error) }
    }
  })

  // Toggle enabled/disabled status of a domain
  ipcMain.handle('blocking:toggleDomain', async (_event, args: { domain: string; enabled: boolean }) => {
    try {
      toggleBlockedDomain(args.domain, args.enabled)
      return { success: true }
    } catch (error: any) {
      console.error('[IPC blocking:toggleDomain]', error)
      return { success: false, error: error.message || String(error) }
    }
  })
}
