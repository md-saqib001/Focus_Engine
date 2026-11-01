import { app } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import { spawn, ChildProcess } from 'child_process'

let watchdogProcess: ChildProcess | null = null

const WATCHDOG_SCRIPT = `
const fs = require('fs');

const parentPid = parseInt(process.argv[2], 10);
const hostsPath = process.argv[3];
const BLOCK_START_MARKER = '# FOCUS_ENGINE_BLOCK_START';
const BLOCK_END_MARKER = '# FOCUS_ENGINE_BLOCK_END';

function stripBlockingBlock(content) {
  const startIndex = content.indexOf(BLOCK_START_MARKER);
  const endIndex = content.indexOf(BLOCK_END_MARKER);

  if (startIndex !== -1 && endIndex !== -1) {
    const before = content.substring(0, startIndex);
    const after = content.substring(endIndex + BLOCK_END_MARKER.length);
    return before.trimEnd() + '\\n' + after.trimStart();
  }

  return content
    .replace(new RegExp(\`\\\\n?\${BLOCK_START_MARKER}[\\\\s\\\\S]*?\${BLOCK_END_MARKER}\\\\n?\`, 'g'), '\\n')
    .replace(new RegExp(\`\\\\n?\${BLOCK_START_MARKER}.*\`, 'g'), '')
    .replace(new RegExp(\`.*\${BLOCK_END_MARKER}\\\\n?\`, 'g'), '');
}

function checkParent() {
  try {
    // kill(pid, 0) throws an error if the process does not exist
    process.kill(parentPid, 0);
  } catch (e) {
    // Parent process is dead. Clean up hosts file.
    try {
      if (fs.existsSync(hostsPath)) {
        const content = fs.readFileSync(hostsPath, 'utf8');
        if (content.includes(BLOCK_START_MARKER)) {
          const cleaned = stripBlockingBlock(content);
          fs.writeFileSync(hostsPath, cleaned, 'utf8');
        }
      }
    } catch (err) {
      // Fail silently in watchdog
    }
    process.exit(0);
  }
}

// Poll every 1000ms
setInterval(checkParent, 1000);
`

/**
 * Generates the watchdog script and spawns it as a detached child process.
 */
export function startWatchdog(hostsPath: string): void {
  // Stop existing watchdog if any
  stopWatchdog()

  const scriptPath = path.join(app.getPath('userData'), 'watchdog.js')
  
  try {
    // Write the watchdog logic to disk
    fs.writeFileSync(scriptPath, WATCHDOG_SCRIPT.trim(), 'utf8')

    // Spawn the watchdog using the bundled Electron executable, but tell it to run as standard Node
    watchdogProcess = spawn(
      process.execPath,
      [scriptPath, process.pid.toString(), hostsPath],
      {
        env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
        detached: true,
        stdio: 'ignore'
      }
    )

    // Unref the process so it doesn't prevent the main app from quitting
    watchdogProcess.unref()
    console.log('[WatchdogManager] Started detached watchdog process.')
  } catch (error) {
    console.error('[WatchdogManager] Failed to start watchdog:', error)
  }
}

/**
 * Kills the currently running watchdog process.
 */
export function stopWatchdog(): void {
  if (watchdogProcess) {
    try {
      watchdogProcess.kill()
      console.log('[WatchdogManager] Stopped watchdog process.')
    } catch (e) {
      // Ignore if already dead
    }
    watchdogProcess = null
  }
}
