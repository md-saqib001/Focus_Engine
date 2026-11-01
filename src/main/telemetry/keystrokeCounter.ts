// @ts-ignore
import { GlobalKeyboardListener } from 'node-global-key-listener'
import { activityTimestampTracker } from './activityTimestampTracker'

export class KeystrokeCounter {
  private listener: any = null
  private count = 0

  /**
   * Starts the global keyboard listener.
   */
  public start(): void {
    this.stop() // Clear any existing listener first
    this.count = 0

    try {
      this.listener = new GlobalKeyboardListener()
      
      // Bind listener callback
      this.listener.addListener((e: any) => {
        // We only trigger increment on key down events
        if (e.state === 'DOWN') {
          // PRIVACY SAFEGUARD: We increment the numeric count only.
          // The key code, character value, or name (e.g. e.name) is NEVER
          // assigned, stored, logged, or processed to guarantee zero keylogging capability.
          this.count++
          activityTimestampTracker.updateActivity()
        }
      })
      console.log('[KeystrokeCounter] Global key hook registered.')
    } catch (error) {
      console.error('[KeystrokeCounter] Failed to register global key hook:', error)
    }
  }

  /**
   * Stops the global keyboard listener and kills the background binary subprocess.
   */
  public stop(): void {
    if (this.listener) {
      try {
        // Kills the underlying Keylogger background binary execution
        this.listener.kill()
      } catch (error) {
        console.error('[KeystrokeCounter] Failed to kill global key listener process:', error)
      }
      this.listener = null
    }
    console.log('[KeystrokeCounter] Global key hook stopped.')
  }

  /**
   * Returns current accumulated keystrokes.
   */
  public getCurrentCount(): number {
    return this.count
  }

  /**
   * Resets the counter to 0 and returns the count prior to reset.
   */
  public resetCount(): number {
    const previous = this.count
    this.count = 0
    return previous
  }
}

export const keystrokeCounter = new KeystrokeCounter()
