import { spawn, ChildProcess } from 'child_process'
import { activityTimestampTracker } from './activityTimestampTracker'

export class MouseTracker {
  private childProcess: ChildProcess | null = null
  private clickCount = 0
  private movementCount = 0

  /**
   * Starts global mouse tracking.
   * Spawns a background PowerShell child process on Windows.
   */
  public start(): void {
    this.stop() // Clear existing process first
    this.clickCount = 0
    this.movementCount = 0

    if (process.platform !== 'win32') {
      console.log('[MouseTracker] Non-Windows OS detected. Mouse telemetry deactivated.')
      return
    }

    // Inline C# wrapper loaded into PowerShell to hook low-level mouse activities safely
    const psScript = `
$code = @'
using System;
using System.Runtime.InteropServices;
using System.Threading;

public class MouseLogger {
    [DllImport("user32.dll")]
    public static extern bool GetCursorPos(out POINT lpPoint);
    
    [DllImport("user32.dll")]
    public static extern short GetAsyncKeyState(int vKey);
    
    public struct POINT {
        public int X;
        public int Y;
    }
    
    public static void Start() {
        POINT lastPos;
        GetCursorPos(out lastPos);
        bool leftDown = false;
        bool rightDown = false;
        
        while (true) {
            POINT currentPos;
            if (GetCursorPos(out currentPos)) {
                if (currentPos.X != lastPos.X || currentPos.Y != lastPos.Y) {
                    Console.WriteLine("MOVE");
                    lastPos = currentPos;
                }
            }
            
            // 0x01 = Left mouse button, 0x02 = Right mouse button
            short leftState = GetAsyncKeyState(0x01);
            if ((leftState & 0x8000) != 0) {
                if (!leftDown) {
                    Console.WriteLine("CLICK");
                    leftDown = true;
                }
            } else {
                leftDown = false;
            }
            
            short rightState = GetAsyncKeyState(0x02);
            if ((rightState & 0x8000) != 0) {
                if (!rightDown) {
                    Console.WriteLine("CLICK");
                    rightDown = true;
                }
            } else {
                rightDown = false;
            }
            
            Thread.Sleep(100);
        }
    }
}
'@

Add-Type -TypeDefinition $code
[MouseLogger]::Start()
`

    try {
      this.childProcess = spawn('powershell', ['-NoProfile', '-Command', psScript])

      // Parse stdout streams for events
      this.childProcess.stdout?.on('data', (data: Buffer) => {
        const text = data.toString()
        const lines = text.split(/\r?\n/)
        for (const line of lines) {
          const action = line.trim()
          if (action === 'MOVE') {
            // PRIVACY SAFEGUARD: Only increments event counter.
            // X/Y screen coordinates are NEVER captured, stored, or processed.
            this.movementCount++
            activityTimestampTracker.updateActivity()
          } else if (action === 'CLICK') {
            this.clickCount++
            activityTimestampTracker.updateActivity()
          }
        }
      })

      this.childProcess.on('error', (err) => {
        console.error('[MouseTracker] Subprocess error:', err)
      })

      console.log('[MouseTracker] Spawned background mouse tracker process.')
    } catch (err) {
      console.error('[MouseTracker] Failed to start subprocess:', err)
    }
  }

  /**
   * Stops tracking and terminates the PowerShell helper process.
   */
  public stop(): void {
    if (this.childProcess) {
      try {
        this.childProcess.kill()
      } catch (err) {
        console.error('[MouseTracker] Failed to terminate subprocess:', err)
      }
      this.childProcess = null
    }
    console.log('[MouseTracker] Mouse tracking stopped.')
  }

  /**
   * Retrieves active movement and click counts.
   */
  public getCounts(): { clicks: number; movements: number } {
    return {
      clicks: this.clickCount,
      movements: this.movementCount
    }
  }

  /**
   * Resets active counters and returns the values prior to reset.
   */
  public resetCounts(): { clicks: number; movements: number } {
    const previous = {
      clicks: this.clickCount,
      movements: this.movementCount
    }
    this.clickCount = 0
    this.movementCount = 0
    return previous
  }
}

// Export singleton instance
export const mouseTracker = new MouseTracker()
