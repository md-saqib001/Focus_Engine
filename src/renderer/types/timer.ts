export type SessionMode = 'pomodoro' | 'standard'

export type SessionType = 'focus' | 'shortBreak' | 'longBreak'
// Note: SessionType is only meaningful in pomodoro mode.
// Standard mode sessions don't have a "type" (they are open-ended).

export type TimerState = 'idle' | 'running' | 'paused' | 'completed'

export interface TimerDurations {
  focus: number
  shortBreak: number
  longBreak: number
}
