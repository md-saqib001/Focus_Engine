import { app } from 'electron'
import { join } from 'path'
import * as fs from 'fs'

function getLogFilePath(): string {
  return join(app.getPath('userData'), 'focus-engine.log')
}

function writeLog(level: 'INFO' | 'WARN' | 'ERROR', message: string): void {
  const logPath = getLogFilePath()
  const timestamp = new Date().toISOString()
  const logLine = `[${timestamp}] [${level}] ${message}\n`

  // Fire-and-forget async write — never blocks the main thread
  fs.promises.appendFile(logPath, logLine, 'utf8').catch((error) => {
    console.error('Failed to write to log file:', error)
  })
}

export const logger = {
  info: (message: string) => {
    console.log(`[INFO] ${message}`)
    writeLog('INFO', message)
  },
  warn: (message: string) => {
    console.warn(`[WARN] ${message}`)
    writeLog('WARN', message)
  },
  error: (message: string) => {
    console.error(`[ERROR] ${message}`)
    writeLog('ERROR', message)
  }
}
