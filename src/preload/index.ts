import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

type SaveSessionArgs =
  | {
      sessionId: string
      mode: 'pomodoro'
      sessionType: 'focus' | 'shortBreak' | 'longBreak'
      startTime: number
      endTime: number
      durationPlannedSec: number
      durationActualSec: number
      completed: boolean
      endReason: 'auto_complete' | 'abandoned'
      autoPausedCount?: number
      pauseCount?: number
    }
  | {
      sessionId: string
      mode: 'standard'
      startTime: number
      endTime: number
      durationActualSec: number
      completed: boolean
      endReason: 'manual_stop' | 'force_ended'
      autoPausedCount?: number
      pauseCount?: number
    }

// The API exposed to the renderer process via contextBridge
const focusEngineAPI = {
  saveSession: (args: SaveSessionArgs) => {
    if (args.mode === 'pomodoro') {
      return ipcRenderer.invoke('session:save', {
        sessionId: args.sessionId,
        mode: args.mode,
        sessionType: args.sessionType,
        startTime: args.startTime,
        endTime: args.endTime,
        durationPlannedSec: args.durationPlannedSec,
        durationActualSec: args.durationActualSec,
        completed: args.completed,
        endReason: args.endReason,
        autoPausedCount: args.autoPausedCount,
        pauseCount: args.pauseCount
      })
    } else {
      return ipcRenderer.invoke('session:save', {
        sessionId: args.sessionId,
        mode: args.mode,
        sessionType: null,
        startTime: args.startTime,
        endTime: args.endTime,
        durationPlannedSec: null,
        durationActualSec: args.durationActualSec,
        completed: args.completed,
        endReason: args.endReason,
        autoPausedCount: args.autoPausedCount,
        pauseCount: args.pauseCount
      })
    }
  },

  getAllSessions: () => {
    return ipcRenderer.invoke('session:getAll')
  },

  // Hosts blocking endpoints
  startBlocking: () => {
    return ipcRenderer.invoke('blocking:start')
  },

  stopBlocking: () => {
    return ipcRenderer.invoke('blocking:stop')
  },

  isBlockingActive: () => {
    return ipcRenderer.invoke('blocking:status')
  },

  getBlockedDomains: () => {
    return ipcRenderer.invoke('blocking:getDomains')
  },

  addBlockedDomain: (domain: string) => {
    return ipcRenderer.invoke('blocking:addDomain', domain)
  },

  removeBlockedDomain: (domain: string) => {
    return ipcRenderer.invoke('blocking:removeDomain', domain)
  },

  toggleBlockedDomain: (domain: string, enabled: boolean) => {
    return ipcRenderer.invoke('blocking:toggleDomain', { domain, enabled })
  },

  // App blocking endpoints
  killBlacklistedApps: (sessionId: string) => {
    return ipcRenderer.invoke('appBlocking:killBlacklisted', { sessionId })
  },

  getBlacklistedApps: () => {
    return ipcRenderer.invoke('appBlocking:getApps')
  },

  addBlacklistedApp: (appName: string) => {
    return ipcRenderer.invoke('appBlocking:addApp', appName)
  },

  removeBlacklistedApp: (appName: string) => {
    return ipcRenderer.invoke('appBlocking:removeApp', appName)
  },

  toggleBlacklistedApp: (appName: string, enabled: boolean) => {
    return ipcRenderer.invoke('appBlocking:toggleApp', { appName, enabled })
  },

  // CV Engine endpoints
  startCV: (sessionId: string, fps?: number) => {
    return ipcRenderer.invoke('cv:start', sessionId, fps)
  },

  stopCV: () => {
    return ipcRenderer.invoke('cv:stop')
  },

  getCVSummary: (sessionId: string) => {
    return ipcRenderer.invoke('cv:getSummary', sessionId)
  },

  getCVEnabled: () => {
    return ipcRenderer.invoke('settings:getCVEnabled')
  },

  setCVEnabled: (enabled: boolean) => {
    return ipcRenderer.invoke('settings:setCVEnabled', enabled)
  },

  getCVPermission: () => {
    return ipcRenderer.invoke('settings:getCVPermission')
  },

  setCVPermission: (permission: 'granted' | 'denied' | 'pending') => {
    return ipcRenderer.invoke('settings:setCVPermission', permission)
  },

  getCalibration: () => {
    return ipcRenderer.invoke('settings:getCalibration')
  },

  setCalibration: (calibration: any) => {
    return ipcRenderer.invoke('settings:setCalibration', calibration)
  },

  getDefaultCalibration: () => {
    return ipcRenderer.invoke('settings:getDefaultCalibration')
  },

  resetCalibrationToDefault: () => {
    return ipcRenderer.invoke('settings:resetCalibrationToDefault')
  },

  // Telemetry endpoints
  startTelemetry: (sessionId: string, mode: 'pomodoro' | 'standard') => {
    return ipcRenderer.invoke('telemetry:start', { sessionId, mode })
  },

  stopTelemetry: () => {
    return ipcRenderer.invoke('telemetry:stop')
  },

  getWindowHistory: (sessionId: string) => {
    return ipcRenderer.invoke('telemetry:getWindowHistory', { sessionId })
  },

  getCategoryBreakdown: (sessionId: string) => {
    return ipcRenderer.invoke('telemetry:getCategoryBreakdown', { sessionId })
  },

  startKPM: (sessionId: string) => {
    return ipcRenderer.invoke('telemetry:startKPM', { sessionId })
  },

  stopKPM: () => {
    return ipcRenderer.invoke('telemetry:stopKPM')
  },

  getKPMHistory: (sessionId: string) => {
    return ipcRenderer.invoke('telemetry:getKPMHistory', { sessionId })
  },

  startMouse: (sessionId: string) => {
    return ipcRenderer.invoke('telemetry:startMouse', { sessionId })
  },

  stopMouse: () => {
    return ipcRenderer.invoke('telemetry:stopMouse')
  },

  getMouseHistory: (sessionId: string) => {
    return ipcRenderer.invoke('telemetry:getMouseHistory', { sessionId })
  },

  getSessionSummary: (sessionId: string) => {
    return ipcRenderer.invoke('telemetry:getSessionSummary', { sessionId })
  },

  validateSession: (sessionId: string) => {
    return ipcRenderer.invoke('telemetry:validateSession', { sessionId })
  },

  validateAllSessions: () => {
    return ipcRenderer.invoke('telemetry:validateAllSessions')
  },

  getLatestWindow: () => {
    return ipcRenderer.invoke('telemetry:getLatestWindow')
  },

  getLiveMouseCounts: () => {
    return ipcRenderer.invoke('telemetry:getLiveMouseCounts')
  },

  getDistractionEvents: (sessionId: string) => {
    return ipcRenderer.invoke('telemetry:getDistractionEvents', { sessionId })
  },

  onActiveWindowUpdate: (
    callback: (info: {
      appName: string
      windowTitle: string
      domain: string
      category: 'productive' | 'distraction' | 'neutral' | 'unknown'
    }) => void
  ) => {
    const subscription = (
      _event: any,
      data: {
        appName: string
        windowTitle: string
        domain: string
        category: 'productive' | 'distraction' | 'neutral' | 'unknown'
      }
    ) => callback(data)
    ipcRenderer.on('telemetry:activeWindowUpdate', subscription)
    // Return unsubscribe function
    return () => {
      ipcRenderer.removeListener('telemetry:activeWindowUpdate', subscription)
    }
  },

  onKpmUpdate: (callback: (kpm: number) => void) => {
    const subscription = (_event: any, kpm: number) => callback(kpm)
    ipcRenderer.on('telemetry:kpmUpdate', subscription)
    return () => {
      ipcRenderer.removeListener('telemetry:kpmUpdate', subscription)
    }
  },

  onActivityUpdate: (callback: (info: { status: 'Active' | 'Idle'; idleSeconds: number }) => void) => {
    const subscription = (_event: any, data: { status: 'Active' | 'Idle'; idleSeconds: number }) => callback(data)
    ipcRenderer.on('telemetry:activityUpdate', subscription)
    return () => {
      ipcRenderer.removeListener('telemetry:activityUpdate', subscription)
    }
  },

  onDistractionEvent: (callback: (event: { eventType: string; eventData: any; timestamp: number }) => void) => {
    const subscription = (_event: any, data: { eventType: string; eventData: any; timestamp: number }) => callback(data)
    ipcRenderer.on('telemetry:distractionEvent', subscription)
    return () => {
      ipcRenderer.removeListener('telemetry:distractionEvent', subscription)
    }
  },

  onTelemetryHealthWarning: (callback: (status: { window: boolean; kpm: boolean; mouse: boolean }) => void) => {
    const subscription = (_event: any, data: { window: boolean; kpm: boolean; mouse: boolean }) => callback(data)
    ipcRenderer.on('telemetry:healthWarning', subscription)
    return () => {
      ipcRenderer.removeListener('telemetry:healthWarning', subscription)
    }
  },

  onCVUpdate: (callback: (data: any) => void) => {
    const subscription = (_event: any, data: any) => callback(data)
    ipcRenderer.on('cv:update', subscription)
    return () => {
      ipcRenderer.removeListener('cv:update', subscription)
    }
  },

  onCVError: (callback: (error: string) => void) => {
    const subscription = (_event: any, error: string) => callback(error)
    ipcRenderer.on('cv:error', subscription)
    return () => {
      ipcRenderer.removeListener('cv:error', subscription)
    }
  },

  getCurrentFocusBuffer: () => {
    return ipcRenderer.invoke('buffer:getCurrent')
  },

  resumeBuffer: () => {
    return ipcRenderer.invoke('buffer:resume')
  },

  pauseBuffer: () => {
    return ipcRenderer.invoke('buffer:pause')
  },

  validateAllBufferData: () => {
    return ipcRenderer.invoke('buffer:validateAll')
  },

  onFocusBufferUpdate: (callback: (data: any) => void) => {
    const subscription = (_event: any, data: any) => callback(data)
    ipcRenderer.on('buffer:update', subscription)
    return () => {
      ipcRenderer.removeListener('buffer:update', subscription)
    }
  },

  onSessionAutoPause: (callback: (data: { reason: string }) => void) => {
    const subscription = (_event: any, data: { reason: string }) => callback(data)
    ipcRenderer.on('session:autoPause', subscription)
    return () => {
      ipcRenderer.removeListener('session:autoPause', subscription)
    }
  },

  onSessionForceEnd: (callback: (data: { reason: string }) => void) => {
    const subscription = (_event: any, data: { reason: string }) => callback(data)
    ipcRenderer.on('session:forceEnd', subscription)
    return () => {
      ipcRenderer.removeListener('session:forceEnd', subscription)
    }
  },

  onFocusBufferStateChanged: (
    callback: (data: {
      previousState: string
      newState: string
      durationInPreviousState: number
    }) => void
  ) => {
    const subscription = (_event: any, data: any) => callback(data)
    ipcRenderer.on('buffer:stateChanged', subscription)
    return () => {
      ipcRenderer.removeListener('buffer:stateChanged', subscription)
    }
  },

  getBufferSnapshots: (sessionId: string) => {
    return ipcRenderer.invoke('buffer:getSnapshots', { sessionId })
  },

  auditSessionBuffer: (sessionId: string) => {
    return ipcRenderer.invoke('buffer:auditSession', { sessionId })
  },

  getBufferStateTransitions: (sessionId: string) => {
    return ipcRenderer.invoke('buffer:getStateTransitions', { sessionId })
  },

  getBufferStateTimeSummary: (sessionId: string) => {
    return ipcRenderer.invoke('buffer:getStateTimeSummary', { sessionId })
  },

  onMLPrediction: (callback: (data: { focusScore: number; isAnomaly: boolean }) => void) => {
    const subscription = (_event: any, data: any) => callback(data)
    ipcRenderer.on('ml:prediction', subscription)
    return () => {
      ipcRenderer.removeListener('ml:prediction', subscription)
    }
  },

  analytics: {
    getHeatmap: () => ipcRenderer.invoke('analytics:getHeatmap'),
    getStreaks: () => ipcRenderer.invoke('analytics:getStreaks'),
    getProductivitySummary: () => ipcRenderer.invoke('analytics:getProductivitySummary'),
    getRecommendations: () => ipcRenderer.invoke('analytics:getRecommendations'),
    triggerRetrain: () => ipcRenderer.invoke('ml:triggerRetrain'),
    getRetrainHistory: () => ipcRenderer.invoke('ml:getRetrainHistory')
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('focusEngineAPI', focusEngineAPI)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.focusEngineAPI = focusEngineAPI
}
