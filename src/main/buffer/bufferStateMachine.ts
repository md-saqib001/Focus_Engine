import { FocusState } from './focusBuffer'

export interface StateHistoryEntry {
  state: FocusState
  startTime: number
  endTime: number | null
}

export class BufferStateMachine {
  private currentState: FocusState = 'focused'
  private stateStartTime: number = Date.now()
  private history: StateHistoryEntry[] = []

  constructor(initialValue: number = 100) {
    this.currentState = this.determineState(initialValue)
    this.stateStartTime = Date.now()
    this.history.push({
      state: this.currentState,
      startTime: this.stateStartTime,
      endTime: null
    })
  }

  /**
   * Resolves the focus buffer score (0-100) to corresponding discrete states.
   */
  private determineState(value: number): FocusState {
    if (value >= 75) return 'focused'
    if (value >= 40) return 'warning'
    if (value >= 10) return 'critical'
    return 'paused'
  }

  /**
   * Evaluates the buffer score and handles state transitions.
   * Returns a transition package containing change state flags.
   */
  public evaluate(value: number): {
    state: FocusState
    changed: boolean
    previousState: FocusState | null
    durationInPreviousState: number
  } {
    const targetState = this.determineState(value)
    const now = Date.now()
    const changed = targetState !== this.currentState

    let previousState: FocusState | null = null
    let durationInPreviousState = 0

    if (changed) {
      previousState = this.currentState
      durationInPreviousState = now - this.stateStartTime

      // Close history node
      const lastEntry = this.history[this.history.length - 1]
      if (lastEntry) {
        lastEntry.endTime = now
      }

      this.currentState = targetState
      this.stateStartTime = now
      
      this.history.push({
        state: targetState,
        startTime: now,
        endTime: null
      })
    }

    return {
      state: this.currentState,
      changed,
      previousState,
      durationInPreviousState
    }
  }

  public getStateHistory(): StateHistoryEntry[] {
    return [...this.history]
  }

  public getTimeInState(state: FocusState): number {
    let total = 0
    const now = Date.now()
    for (const h of this.history) {
      if (h.state === state) {
        const end = h.endTime || now
        total += (end - h.startTime)
      }
    }
    return total
  }
}
