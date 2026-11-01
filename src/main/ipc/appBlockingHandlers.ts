import { ipcMain } from 'electron'
import {
  getAllBlacklistedApps,
  getEnabledApps,
  addBlacklistedApp,
  removeBlacklistedApp,
  toggleBlacklistedApp,
  logKillEvent
} from '../database/blacklistedAppsRepository'
import { killBlacklistedApps } from '../blocking/processManager'

export function registerAppBlockingHandlers(): void {
  // Terminate active blacklisted apps and log events to SQLite
  ipcMain.handle(
    'appBlocking:killBlacklisted',
    async (_event, args: { sessionId: string }) => {
      try {
        const blacklist = getEnabledApps()
        const { killed } = await killBlacklistedApps(blacklist)
        
        // Log each process termination event
        for (const app of killed) {
          logKillEvent(args.sessionId, app)
        }
        
        return { success: true, data: killed }
      } catch (error: any) {
        console.error('[IPC appBlocking:killBlacklisted]', error)
        return { success: false, error: error.message || String(error) }
      }
    }
  )

  // Get all blacklisted apps from database
  ipcMain.handle('appBlocking:getApps', async () => {
    try {
      const apps = getAllBlacklistedApps()
      return { success: true, data: apps }
    } catch (error: any) {
      console.error('[IPC appBlocking:getApps]', error)
      return { success: false, error: error.message || String(error) }
    }
  })

  // Add app to blacklist
  ipcMain.handle('appBlocking:addApp', async (_event, appName: string) => {
    try {
      addBlacklistedApp(appName)
      return { success: true }
    } catch (error: any) {
      console.error('[IPC appBlocking:addApp]', error)
      return { success: false, error: error.message || String(error) }
    }
  })

  // Remove app from blacklist
  ipcMain.handle('appBlocking:removeApp', async (_event, appName: string) => {
    try {
      removeBlacklistedApp(appName)
      return { success: true }
    } catch (error: any) {
      console.error('[IPC appBlocking:removeApp]', error)
      return { success: false, error: error.message || String(error) }
    }
  })

  // Toggle app block status
  ipcMain.handle(
    'appBlocking:toggleApp',
    async (_event, args: { appName: string; enabled: boolean }) => {
      try {
        toggleBlacklistedApp(args.appName, args.enabled)
        return { success: true }
      } catch (error: any) {
        console.error('[IPC appBlocking:toggleApp]', error)
        return { success: false, error: error.message || String(error) }
      }
    }
  )
}
