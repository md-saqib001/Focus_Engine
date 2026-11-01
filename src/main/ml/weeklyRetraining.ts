import { spawn } from 'child_process'
import { ipcMain } from 'electron'
import { getProcessSpawnConfig } from '../utils/paths'
import { getDatabase } from '../database/db'
import { settingsRepository } from '../database/settingsRepository'

export interface RetrainRecord {
  id?: number
  timestamp: number
  real_sessions: number
  synthetic_sessions: number
  r2_score: number
  mae_score: number
  cv_r2_mean: number
  cv_mae_mean: number
  deployed: boolean
}

/**
 * Spawns a Python script or compiled binary and resolves with its stdout when complete.
 */
function runPythonScript(scriptRelativePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const spawnConfig = getProcessSpawnConfig('ml', scriptRelativePath)
    const proc = spawn(spawnConfig.command, spawnConfig.args)

    let stdout = ''
    let stderr = ''

    proc.stdout?.on('data', (data) => {
      stdout += data.toString()
    })
    proc.stderr?.on('data', (data) => {
      stderr += data.toString()
    })

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Script ${scriptRelativePath} exited with code ${code}: ${stderr}`))
      } else {
        resolve(stdout)
      }
    })
    proc.on('error', (err) => {
      reject(err)
    })
  })
}

export const weeklyRetraining = {
  /**
   * Runs the weekly retraining pipeline sequentially:
   * 1. dataset_builder.py (refreshes current 40-row sliding window)
   * 2. train_focus_model.py (evaluates RandomForestRegressor, deploys only if equal/improved)
   * 3. train_anomaly_model.py (re-calibrates IsolationForest)
   */
  async runRetrainingPipeline(): Promise<RetrainRecord> {
    console.log('[WeeklyRetraining] Launching ML retraining pipeline...')
    
    // Step 1: Re-build the sliding window dataset
    console.log('[WeeklyRetraining] Running dataset_builder.py...')
    await runPythonScript('dataset_builder.py')
    
    // Step 2: Train the focus score regressor
    console.log('[WeeklyRetraining] Running train_focus_model.py...')
    const focusStdout = await runPythonScript('train_focus_model.py')
    
    // Step 3: Train/re-calibrate the anomaly detector
    console.log('[WeeklyRetraining] Running train_anomaly_model.py...')
    await runPythonScript('train_anomaly_model.py')
    
    // Parse status line from train_focus_model stdout
    const statusLine = focusStdout.split('\n').find((line) => line.startsWith('RETRAIN_STATUS:'))
    if (!statusLine) {
      throw new Error('Retrain status line missing from train_focus_model.py stdout')
    }
    
    const jsonStr = statusLine.replace('RETRAIN_STATUS:', '').trim()
    const status = JSON.parse(jsonStr)
    
    const record: RetrainRecord = {
      timestamp: Date.now(),
      real_sessions: status.real_sessions,
      synthetic_sessions: status.synthetic_sessions,
      r2_score: status.test_r2,
      mae_score: status.test_mae,
      cv_r2_mean: status.cv_r2_mean,
      cv_mae_mean: status.cv_mae_mean,
      deployed: status.deployed === 1
    }
    
    // Log to the retrain_history table in database
    const db = getDatabase()
    db.prepare(`
      INSERT INTO retrain_history (
        timestamp, real_sessions, synthetic_sessions, r2_score, mae_score, cv_r2_mean, cv_mae_mean, deployed
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      record.timestamp,
      record.real_sessions,
      record.synthetic_sessions,
      record.r2_score,
      record.mae_score,
      record.cv_r2_mean,
      record.cv_mae_mean,
      record.deployed ? 1 : 0
    )
    
    console.log(`[WeeklyRetraining] Pipeline completed. Deployed=${record.deployed}. window=${record.real_sessions}R/${record.synthetic_sessions}S. CV R²=${record.cv_r2_mean.toFixed(4)}`)
    return record;
  },

  /**
   * Checked on application launch. Executes the pipeline if 7+ days have elapsed since last retrain.
   */
  async checkAndTriggerRetrain(force: boolean = false): Promise<void> {
    const lastRetrainTime = parseInt(settingsRepository.getSetting('last_retrain_time', '0'), 10)
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000
    
    const shouldRetrain = force || (Date.now() - lastRetrainTime >= sevenDaysMs)
    
    if (shouldRetrain) {
      try {
        const record = await this.runRetrainingPipeline()
        settingsRepository.setSetting('last_retrain_time', record.timestamp.toString())
      } catch (err) {
        console.error('[WeeklyRetraining] Retraining pipeline failed:', err)
      }
    } else {
      const daysLeft = ((sevenDaysMs - (Date.now() - lastRetrainTime)) / (24 * 60 * 60 * 1000)).toFixed(1)
      console.log(`[WeeklyRetraining] Retraining skipped. Last retrained at ${new Date(lastRetrainTime).toLocaleDateString()}. Next retrain in ${daysLeft} days.`)
    }
  },

  /**
   * Fetches the entire append-only log history of training runs.
   */
  getRetrainHistory(): RetrainRecord[] {
    const db = getDatabase()
    const rows = db.prepare(`
      SELECT id, timestamp, real_sessions, synthetic_sessions, r2_score, mae_score, cv_r2_mean, cv_mae_mean, deployed
      FROM retrain_history
      ORDER BY timestamp ASC
    `).all() as any[]
    
    return rows.map((r) => ({
      id: r.id,
      timestamp: r.timestamp,
      real_sessions: r.real_sessions,
      synthetic_sessions: r.synthetic_sessions,
      r2_score: r.r2_score,
      mae_score: r.mae_score,
      cv_r2_mean: r.cv_r2_mean,
      cv_mae_mean: r.cv_mae_mean,
      deployed: r.deployed === 1
    }))
  }
}

/**
 * Registers retraining IPC handlers.
 */
export function registerMLHandlers(): void {
  ipcMain.handle('ml:triggerRetrain', async () => {
    try {
      const record = await weeklyRetraining.runRetrainingPipeline()
      // Reset the weekly timer upon successful manual trigger
      settingsRepository.setSetting('last_retrain_time', record.timestamp.toString())
      return { success: true, data: record }
    } catch (err: any) {
      console.error('[IPC ml:triggerRetrain]', err)
      return { success: false, error: err.message || String(err) }
    }
  })

  ipcMain.handle('ml:getRetrainHistory', async () => {
    try {
      const history = weeklyRetraining.getRetrainHistory()
      return { success: true, data: history }
    } catch (err: any) {
      console.error('[IPC ml:getRetrainHistory]', err)
      return { success: false, error: err.message || String(err) }
    }
  })
}
