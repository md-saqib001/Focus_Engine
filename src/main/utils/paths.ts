import { app } from 'electron'
import { join } from 'path'

export interface SpawnConfig {
  command: string
  args: string[]
}

/**
 * Returns the spawn command and initial arguments, adjusting automatically
 * between development mode (running python scripts via the virtual environment interpreter)
 * and production mode (executing pre-compiled standalone binary executables).
 * 
 * @param area 'cv' or 'ml' script domain
 * @param scriptName Name of the python script (e.g. 'predict.py' or 'main_loop.py')
 */
export function getProcessSpawnConfig(area: 'cv' | 'ml', scriptName: string): SpawnConfig {
  const isWindows = process.platform === 'win32'
  const isPackaged = app.isPackaged
  const exeExt = isWindows ? '.exe' : ''

  if (isPackaged) {
    // In production, execute the compiled standalone binary directly from resources/bin/
    const binaryBaseName = scriptName.replace(/\.py$/, '')
    const command = join(process.resourcesPath, 'bin', `${binaryBaseName}${exeExt}`)
    return {
      command,
      args: [] // Standalone binaries package their own arguments, no script path needed
    }
  } else {
    // In development, run via the local virtual environment's python interpreter
    const pythonExe = isWindows
      ? join(app.getAppPath(), 'python', 'cv_env', 'Scripts', 'python.exe')
      : join(app.getAppPath(), 'python', 'cv_env', 'bin', 'python')

    const scriptPath = area === 'cv'
      ? join(app.getAppPath(), 'python', 'cv_engine', scriptName)
      : join(app.getAppPath(), 'python', 'ml', scriptName)

    return {
      command: pythonExe,
      args: [scriptPath]
    }
  }
}

/**
 * Resolves the path to the trained ML models directory, automatically adjusting
 * for development mode vs production packaging.
 */
export function getModelsPath(...paths: string[]): string {
  const isPackaged = app.isPackaged
  const basePath = isPackaged
    ? join(process.resourcesPath, 'bin', 'models')
    : join(app.getAppPath(), 'python', 'ml', 'models')
  return join(basePath, ...paths)
}
