import { ipcMain } from 'electron'
import { bufferOrchestrator } from '../buffer/bufferOrchestrator'
import { bufferSnapshotsRepository } from '../database/bufferSnapshotsRepository'
import { bufferStateTransitionsRepository } from '../database/bufferStateTransitionsRepository'
import { auditTickSynchronization, validateAllBufferData } from '../buffer/bufferDiagnostics'

/**
 * Registers all focus buffer-related IPC handlers.
 * Called once during app initialization in main/index.ts.
 */
export function registerBufferHandlers(): void {
  ipcMain.handle('buffer:getCurrent', () => {
    try {
      return {
        success: true,
        data: {
          value: bufferOrchestrator.getCurrentValue(),
          state: bufferOrchestrator.getState(),
          history: bufferOrchestrator.getHistory(),
          signals: bufferOrchestrator.getCurrentSignals(),
          autoPausedCount: bufferOrchestrator.getAutoPausedCount()
        }
      }
    } catch (err: any) {
      console.error('[IPC buffer:getCurrent]', err)
      return { success: false, error: err.message || String(err) }
    }
  })

  ipcMain.handle('buffer:getSnapshots', (_event, args: { sessionId: string }) => {
    try {
      const snapshots = bufferSnapshotsRepository.getSnapshotsForSession(args.sessionId)
      return { success: true, data: snapshots }
    } catch (err: any) {
      console.error('[IPC buffer:getSnapshots]', err)
      return { success: false, error: err.message || String(err) }
    }
  })

  ipcMain.handle('buffer:auditSession', (_event, args: { sessionId: string }) => {
    try {
      const audit = auditTickSynchronization(args.sessionId)
      return { success: true, data: audit }
    } catch (err: any) {
      console.error('[IPC buffer:auditSession]', err)
      return { success: false, error: err.message || String(err) }
    }
  })

  ipcMain.handle('buffer:getStateTransitions', (_event, args: { sessionId: string }) => {
    try {
      const transitions = bufferStateTransitionsRepository.getForSession(args.sessionId)
      return { success: true, data: transitions }
    } catch (err: any) {
      console.error('[IPC buffer:getStateTransitions]', err)
      return { success: false, error: err.message || String(err) }
    }
  })

  ipcMain.handle('buffer:getStateTimeSummary', (_event, args: { sessionId: string }) => {
    try {
      const summary = bufferStateTransitionsRepository.getTimeInEachState(args.sessionId)
      return { success: true, data: summary }
    } catch (err: any) {
      console.error('[IPC buffer:getStateTimeSummary]', err)
      return { success: false, error: err.message || String(err) }
    }
  })

  ipcMain.handle('buffer:resume', () => {
    try {
      bufferOrchestrator.resume()
      return { success: true }
    } catch (err: any) {
      console.error('[IPC buffer:resume]', err)
      return { success: false, error: err.message || String(err) }
    }
  })

  ipcMain.handle('buffer:pause', () => {
    try {
      bufferOrchestrator.pause()
      return { success: true }
    } catch (err: any) {
      console.error('[IPC buffer:pause]', err)
      return { success: false, error: err.message || String(err) }
    }
  })

  ipcMain.handle('buffer:validateAll', () => {
    try {
      const report = validateAllBufferData()
      return { success: true, data: report }
    } catch (err: any) {
      console.error('[IPC buffer:validateAll]', err)
      return { success: false, error: err.message || String(err) }
    }
  })
}
