import { ipcMain } from 'electron'
import { telemetryPoller } from '../telemetry/telemetryPoller'
import { kpmTracker } from '../telemetry/kpmTracker'
import { mouseMetricsTracker } from '../telemetry/mouseMetricsTracker'
import { getWindowFocusHistory, getCategoryBreakdown } from '../database/windowFocusRepository'
import {
  getForSession as getKeyboardHistory,
  getAverageKPM,
  getMaxMinKPM
} from '../database/keyboardMetricsRepository'
import {
  getForSession as getMouseHistory,
  getMaxIdleDuration
} from '../database/mouseMetricsRepository'
import { getSessionTelemetrySummary } from '../database/telemetryAggregator'
import { validateSession, validateAllSessions } from '../telemetry/validateTelemetry'
import { getActiveWindow } from '../telemetry/activeWindowTracker'
import { classifyWindow } from '../telemetry/domainClassifier'
import { mouseTracker } from '../telemetry/mouseTracker'
import { distractionDetector } from '../telemetry/distractionDetector'
import { getForSession as getDistractionEvents } from '../database/distractionEventsRepository'
import { telemetryHealthCheck } from '../telemetry/telemetryHealthCheck'
import { bufferOrchestrator } from '../buffer/bufferOrchestrator'

export function registerTelemetryHandlers(): void {
  // telemetry:start — starts window tracking + KPM tracking + Mouse tracking + distraction detector + health checker + buffer orchestrator
  ipcMain.handle(
    'telemetry:start',
    async (_event, args: { sessionId: string; mode: 'pomodoro' | 'standard' }) => {
      try {
        telemetryPoller.start(args.sessionId)
        kpmTracker.start(args.sessionId)
        mouseMetricsTracker.start(args.sessionId)
        distractionDetector.start(args.sessionId)
        telemetryHealthCheck.start(args.sessionId)
        bufferOrchestrator.start(args.sessionId, args.mode)
        return { success: true }
      } catch (error: any) {
        console.error('[IPC telemetry:start]', error)
        return { success: false, error: error.message || String(error) }
      }
    }
  )

  // telemetry:stop — stops window tracking + KPM tracking + Mouse tracking + distraction detector + health checker + buffer orchestrator
  ipcMain.handle('telemetry:stop', async () => {
    try {
      telemetryPoller.stop()
      kpmTracker.stop()
      mouseMetricsTracker.stop()
      distractionDetector.stop()
      telemetryHealthCheck.stop()
      bufferOrchestrator.stop()
      return { success: true }
    } catch (error: any) {
      console.error('[IPC telemetry:stop]', error)
      return { success: false, error: error.message || String(error) }
    }
  })

  // telemetry:getWindowHistory — retrieves full focus telemetry list for a session
  ipcMain.handle(
    'telemetry:getWindowHistory',
    async (_event, args: { sessionId: string }) => {
      try {
        const history = getWindowFocusHistory(args.sessionId)
        return { success: true, data: history }
      } catch (error: any) {
        console.error('[IPC telemetry:getWindowHistory]', error)
        return { success: false, error: error.message || String(error) }
      }
    }
  )

  // telemetry:getCategoryBreakdown — retrieves grouped breakdown counts for a session
  ipcMain.handle(
    'telemetry:getCategoryBreakdown',
    async (_event, args: { sessionId: string }) => {
      try {
        const breakdown = getCategoryBreakdown(args.sessionId)
        return { success: true, data: breakdown }
      } catch (error: any) {
        console.error('[IPC telemetry:getCategoryBreakdown]', error)
        return { success: false, error: error.message || String(error) }
      }
    }
  )

  // telemetry:startKPM — starts KPM tracking specifically
  ipcMain.handle(
    'telemetry:startKPM',
    async (_event, args: { sessionId: string }) => {
      try {
        kpmTracker.start(args.sessionId)
        return { success: true }
      } catch (error: any) {
        console.error('[IPC telemetry:startKPM]', error)
        return { success: false, error: error.message || String(error) }
      }
    }
  )

  // telemetry:stopKPM — stops KPM tracking specifically
  ipcMain.handle('telemetry:stopKPM', async () => {
    try {
      kpmTracker.stop()
      return { success: true }
    } catch (error: any) {
      console.error('[IPC telemetry:stopKPM]', error)
      return { success: false, error: error.message || String(error) }
    }
  })

  // telemetry:getKPMHistory — retrieves rolling KPM history and calculated session metrics
  ipcMain.handle(
    'telemetry:getKPMHistory',
    async (_event, args: { sessionId: string }) => {
      try {
        const list = getKeyboardHistory(args.sessionId)
        const avg = getAverageKPM(args.sessionId)
        const bounds = getMaxMinKPM(args.sessionId)
        return {
          success: true,
          data: {
            history: list,
            average: avg,
            maxKpm: bounds.maxKpm,
            minKpm: bounds.minKpm
          }
        }
      } catch (error: any) {
        console.error('[IPC telemetry:getKPMHistory]', error)
        return { success: false, error: error.message || String(error) }
      }
    }
  )

  // telemetry:startMouse — starts mouse metrics tracking specifically
  ipcMain.handle(
    'telemetry:startMouse',
    async (_event, args: { sessionId: string }) => {
      try {
        mouseMetricsTracker.start(args.sessionId)
        return { success: true }
      } catch (error: any) {
        console.error('[IPC telemetry:startMouse]', error)
        return { success: false, error: error.message || String(error) }
      }
    }
  )

  // telemetry:stopMouse — stops mouse metrics tracking specifically
  ipcMain.handle('telemetry:stopMouse', async () => {
    try {
      mouseMetricsTracker.stop()
      return { success: true }
    } catch (error: any) {
      console.error('[IPC telemetry:stopMouse]', error)
      return { success: false, error: error.message || String(error) }
    }
  })

  // telemetry:getMouseHistory — retrieves mouse metrics log and max idle stats for a session
  ipcMain.handle(
    'telemetry:getMouseHistory',
    async (_event, args: { sessionId: string }) => {
      try {
        const list = getMouseHistory(args.sessionId)
        const maxIdle = getMaxIdleDuration(args.sessionId)
        return {
          success: true,
          data: {
            history: list,
            maxIdleSeconds: maxIdle
          }
        }
      } catch (error: any) {
        console.error('[IPC telemetry:getMouseHistory]', error)
        return { success: false, error: error.message || String(error) }
      }
    }
  )

  // telemetry:getSessionSummary — aggregates metrics from window focus, keyboard, and mouse metrics
  ipcMain.handle(
    'telemetry:getSessionSummary',
    async (_event, args: { sessionId: string }) => {
      try {
        const summary = getSessionTelemetrySummary(args.sessionId)
        return { success: true, data: summary }
      } catch (error: any) {
        console.error('[IPC telemetry:getSessionSummary]', error)
        return { success: false, error: error.message || String(error) }
      }
    }
  )

  // telemetry:validateSession — runs database checks to verify telemetry completeness
  ipcMain.handle(
    'telemetry:validateSession',
    async (_event, args: { sessionId: string }) => {
      try {
        const result = validateSession(args.sessionId)
        return { success: true, data: result }
      } catch (error: any) {
        console.error('[IPC telemetry:validateSession]', error)
        return { success: false, error: error.message || String(error) }
      }
    }
  )

  // telemetry:getLatestWindow — queries active window on-demand and returns domain + category classification
  ipcMain.handle(
    'telemetry:getLatestWindow',
    async () => {
      try {
        const activeWindow = await getActiveWindow()
        if (activeWindow) {
          const classification = classifyWindow(activeWindow.appName, activeWindow.windowTitle)
          return {
            success: true,
            data: {
              appName: activeWindow.appName,
              windowTitle: activeWindow.windowTitle,
              domain: classification.domain,
              category: classification.category
            }
          }
        }
        return { success: true, data: null }
      } catch (error: any) {
        console.error('[IPC telemetry:getLatestWindow]', error)
        return { success: false, error: error.message || String(error) }
      }
    }
  )

  // telemetry:getLiveMouseCounts — returns current click and movement counts from mouseTracker
  ipcMain.handle(
    'telemetry:getLiveMouseCounts',
    async () => {
      try {
        const counts = mouseTracker.getCounts()
        return { success: true, data: counts }
      } catch (error: any) {
        console.error('[IPC telemetry:getLiveMouseCounts]', error)
        return { success: false, error: error.message || String(error) }
      }
    }
  )

  // telemetry:getDistractionEvents — retrieves logged distraction warning events for a session
  ipcMain.handle(
    'telemetry:getDistractionEvents',
    async (_event, args: { sessionId: string }) => {
      try {
        const events = getDistractionEvents(args.sessionId)
        return { success: true, data: events }
      } catch (error: any) {
        console.error('[IPC telemetry:getDistractionEvents]', error)
        return { success: false, error: error.message || String(error) }
      }
    }
  )

  // telemetry:validateAllSessions — executes full integrity audits for all database sessions in bulk
  ipcMain.handle(
    'telemetry:validateAllSessions',
    async () => {
      try {
        const summary = validateAllSessions()
        return { success: true, data: summary }
      } catch (error: any) {
        console.error('[IPC telemetry:validateAllSessions]', error)
        return { success: false, error: error.message || String(error) }
      }
    }
  )
}
