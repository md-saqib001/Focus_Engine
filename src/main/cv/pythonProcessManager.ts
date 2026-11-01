import { spawn, ChildProcess } from 'child_process'
import { join } from 'path'
import { app, BrowserWindow } from 'electron'
import * as fs from 'fs'
import { cvMetricsRepository } from '../database/cvMetricsRepository'
import { settingsRepository } from '../database/settingsRepository'
import { getProcessSpawnConfig } from '../utils/paths'

class PythonCVProcessManager {
  private process: ChildProcess | null = null
  private sessionId: string | null = null
  private stdoutBuffer: string = ''
  private lastRecord: any = null

  /**
   * Starts the CV Engine process for a given session.
   * @param sessionId The current session ID
   * @param fps The polling rate for the camera
   */
  public start(sessionId: string, fps: number = 2): void {
    if (this.process) {
      console.warn(`[PythonCV] Process is already running for session ${this.sessionId}.`)
      return
    }

    this.sessionId = sessionId
    this.stdoutBuffer = ''
    this.lastRecord = null

    // Determine spawn configuration
    const spawnConfig = getProcessSpawnConfig('cv', 'main_loop.py')

    // Read calibration and write to temporary file if exists
    let calibrationFile: string | null = null
    try {
      const calibrationRes = settingsRepository.getSetting('cv_calibration', '')
      if (calibrationRes) {
        const tempDir = app.getPath('temp')
        calibrationFile = join(tempDir, `cv_calibration_${sessionId}.json`)
        fs.writeFileSync(calibrationFile, calibrationRes)
        console.log(`[PythonCV] Wrote temporary calibration file to ${calibrationFile}`)
      }
    } catch (err) {
      console.error('[PythonCV] Failed to fetch or write calibration:', err)
    }

    console.log(`[PythonCV] Spawning python CV engine... FPS=${fps}`)
    
    const args = [...spawnConfig.args, '--fps', fps.toString(), '--stream-preview']
    if (calibrationFile) {
      args.push('--calibration-file', calibrationFile)
    }

    this.process = spawn(spawnConfig.command, args)

    this.process.stdout?.on('data', (data: Buffer) => {
      this.handleStdoutData(data.toString('utf-8'))
    })

    this.process.stderr?.on('data', (data: Buffer) => {
      console.error(`[PythonCV STDERR] ${data.toString('utf-8').trim()}`)
    })

    this.process.on('close', (code) => {
      console.log(`[PythonCV] Process exited with code ${code}`)
      if (code !== 0 && code !== null) {
        this.broadcastError(`Process exited unexpectedly with code ${code}`)
      }
      
      // Clean up temporary calibration file
      if (calibrationFile && fs.existsSync(calibrationFile)) {
        try {
          fs.unlinkSync(calibrationFile)
          console.log(`[PythonCV] Deleted temporary calibration file: ${calibrationFile}`)
        } catch (e) {
          console.error('[PythonCV] Failed to delete temp calibration file:', e)
        }
      }

      this.process = null
      this.sessionId = null
    })
    
    this.process.on('error', (err) => {
      console.error(`[PythonCV] Failed to start python process:`, err)
      this.broadcastError(`Failed to start python process: ${err.message}`)
      this.process = null
      this.sessionId = null
    })
  }

  /**
   * Broadcasts CV errors to all open renderer windows.
   */
  private broadcastError(errorMsg: string): void {
    const windows = BrowserWindow.getAllWindows()
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send('cv:error', errorMsg)
      }
    }
  }

  /**
   * Handles incoming stdout data, properly buffering lines to parse JSON.
   * JSON strings may be split across multiple TCP/pipe chunk boundaries.
   */
  private handleStdoutData(chunk: string): void {
    this.stdoutBuffer += chunk
    let newlineIndex: number

    // Process all complete lines in the buffer
    while ((newlineIndex = this.stdoutBuffer.indexOf('\n')) !== -1) {
      const line = this.stdoutBuffer.slice(0, newlineIndex).trim()
      this.stdoutBuffer = this.stdoutBuffer.slice(newlineIndex + 1)

      if (!line) continue

      try {
        const record = JSON.parse(line)
        
        if (record.error) {
          this.broadcastError(record.error)
        }

        // We expect normal JSON from main_loop.py to have a 'frame' or 'ts' key
        if (record.ts && this.sessionId) {
          this.lastRecord = record
          // It's a telemetry record! Persist to database.
          cvMetricsRepository.insertCVMetric({
            session_id: this.sessionId,
            face_present: record.face_present ?? false,
            yaw: record.yaw ?? null,
            pitch: record.pitch ?? null,
            roll: record.roll ?? null,
            gaze_direction: record.gaze_direction ?? null,
            looking_at_screen: record.looking_at_screen ?? false,
            raw_attention_score: record.raw_attention_score ?? 0.0,
            smoothed_attention_score: record.smoothed_attention_score ?? 0.0,
            timestamp: record.ts
          })

          // Broadcast to all open renderer windows
          const windows = BrowserWindow.getAllWindows()
          for (const win of windows) {
            if (!win.isDestroyed()) {
              win.webContents.send('cv:update', record)
            }
          }
        }
      } catch (err) {
        // Some output from OpenCV/MediaPipe might be plain text logs (e.g. warnings)
        // We log it and ignore it rather than throwing an error.
        console.log(`[PythonCV STDOUT] ${line}`)
      }
    }
  }

  /**
   * Stops the currently running python process.
   * Attempts graceful SIGTERM, forcefully kills after 2s if stubborn.
   */
  public stop(): void {
    if (!this.process) {
      return
    }

    console.log(`[PythonCV] Stopping CV process...`)
    
    // Fallback timer to SIGKILL if SIGTERM is ignored
    const killTimeout = setTimeout(() => {
      if (this.process) {
        console.warn(`[PythonCV] Process did not exit gracefully. Force killing.`)
        this.process.kill('SIGKILL')
      }
    }, 2000)

    this.process.once('close', () => {
      clearTimeout(killTimeout)
    })

    // Try graceful exit first
    this.process.kill('SIGTERM')
    this.lastRecord = null
  }

  /**
   * Retrieves the last parsed CV telemetry record.
   */
  public getLastRecord(): any {
    return this.lastRecord
  }
}

export const pythonCVProcessManager = new PythonCVProcessManager()
