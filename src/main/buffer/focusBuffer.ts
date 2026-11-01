export interface FocusMultipliers {
  cv: number
  keyboard: number
  mouse: number
  window: number
}

export type FocusState = 'focused' | 'warning' | 'critical' | 'paused'

export interface BufferHistoryEntry {
  timestamp: number
  value: number
}

export class FocusBuffer {
  private currentValue: number = 100
  private history: BufferHistoryEntry[] = []
  private readonly maxHistorySize: number = 120 // 2 minutes at 1Hz

  constructor() {
    this.reset()
  }

  /**
   * Updates the focus buffer value based on multipliers and distraction penalties.
   * If all multipliers are >= 0.95 and there is no penalty, uses additive recovery (+0.5/sec).
   * Otherwise, applies multiplicative decay and subtracts distraction penalties.
   * Clamps the value between 0 and 100.
   */
  public update(multipliers: FocusMultipliers, distractionPenalty: number): number {
    const isHighlyFocused =
      multipliers.cv >= 0.95 &&
      multipliers.keyboard >= 0.95 &&
      multipliers.mouse >= 0.95 &&
      multipliers.window >= 0.95 &&
      distractionPenalty === 0

    if (isHighlyFocused) {
      // Option B: Additive recovery term (+0.5 per update, capped at 100)
      this.currentValue = Math.min(100, this.currentValue + 0.5)
    } else {
      // Standard multiplicative decay with subtraction penalty
      this.currentValue =
        this.currentValue *
          multipliers.cv *
          multipliers.keyboard *
          multipliers.mouse *
          multipliers.window -
        distractionPenalty
      this.currentValue = Math.max(0, this.currentValue)
    }

    // Round to 2 decimal places to avoid floating point drift
    this.currentValue = Math.round(this.currentValue * 100) / 100

    this.history.push({
      timestamp: Date.now(),
      value: this.currentValue
    })

    if (this.history.length > this.maxHistorySize) {
      this.history.shift()
    }

    return this.currentValue
  }

  /**
   * Returns the current focus buffer value (0-100).
   */
  public getCurrentValue(): number {
    return this.currentValue
  }

  /**
   * Returns the rolling buffer history of the last 120 seconds.
   */
  public getHistory(): BufferHistoryEntry[] {
    return [...this.history]
  }

  /**
   * Determines the categorical focus state of the buffer:
   * - 75-100: 'focused'
   * - 40-74: 'warning'
   * - 10-39: 'critical'
   * - 0-9: 'paused'
   */
  public getState(): FocusState {
    const val = this.currentValue
    if (val >= 75) return 'focused'
    if (val >= 40) return 'warning'
    if (val >= 10) return 'critical'
    return 'paused'
  }

  /**
   * Sets the current value of the focus buffer.
   */
  public setValue(value: number): void {
    this.currentValue = Math.min(100, Math.max(0, value))
  }

  /**
   * Resets the buffer to 100 and clears history.
   */
  public reset(): void {
    this.currentValue = 100
    this.history = []
  }
}
