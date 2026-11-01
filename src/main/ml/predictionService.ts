import { spawn } from 'child_process'
import { getProcessSpawnConfig } from '../utils/paths'

export interface PredictionResult {
  success: boolean
  focus_score?: number
  is_anomaly?: boolean
  error?: string
}

export const predictionService = {
  /**
   * Spawns a single-call process to predict the current focus score and anomaly status.
   * Runs predict.py, inputs features via stdin, reads prediction from stdout, and exits.
   */
  getPrediction(features: Record<string, number>): Promise<PredictionResult> {
    return new Promise((resolve) => {
      try {
        const spawnConfig = getProcessSpawnConfig('ml', 'predict.py')

        const processInstance = spawn(spawnConfig.command, spawnConfig.args)

        let stdoutData = ''
        let stderrData = ''

        // Set up 5-second timeout to handle process hangs
        const timeoutId = setTimeout(() => {
          console.error('[PredictionService] Python prediction call timed out (5s). Killing process...')
          processInstance.kill()
          resolve({ success: false, error: 'Process timeout exceeded' })
        }, 5000)

        processInstance.stdout?.on('data', (chunk) => {
          stdoutData += chunk.toString()
        })

        processInstance.stderr?.on('data', (chunk) => {
          stderrData += chunk.toString()
        })

        processInstance.on('close', (code) => {
          clearTimeout(timeoutId)
          if (code !== 0) {
            console.error(`[PredictionService] Python process exited with code ${code}. Stderr: ${stderrData}`)
            resolve({ success: false, error: `Process exited with code ${code}: ${stderrData.trim()}` })
            return
          }

          try {
            const result = JSON.parse(stdoutData.trim())
            resolve(result)
          } catch (err: any) {
            console.error('[PredictionService] Failed to parse JSON prediction stdout:', stdoutData, err)
            resolve({ success: false, error: `Invalid JSON response: ${err.message || String(err)}` })
          }
        })

        processInstance.on('error', (err) => {
          clearTimeout(timeoutId)
          console.error('[PredictionService] Failed to spawn process:', err)
          resolve({ success: false, error: `Spawn error: ${err.message || String(err)}` })
        })

        // Write feature dict as a single JSON line to stdin and close it immediately
        processInstance.stdin?.write(JSON.stringify(features) + '\n')
        processInstance.stdin?.end()

      } catch (err: any) {
        console.error('[PredictionService] getPrediction exception:', err)
        resolve({ success: false, error: err.message || String(err) })
      }
    })
  }
}
