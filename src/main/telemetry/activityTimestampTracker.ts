export class ActivityTimestampTracker {
  private lastActivityTime: number = Date.now()

  /**
   * Updates the timestamp of the last recorded user action.
   */
  public updateActivity(): void {
    this.lastActivityTime = Date.now()
  }

  /**
   * Retrieves the duration in seconds since the last active keystroke or mouse event.
   */
  public getIdleSeconds(): number {
    return Math.floor((Date.now() - this.lastActivityTime) / 1000)
  }
}

// Export singleton instance shared by keyboard and mouse hook servers
export const activityTimestampTracker = new ActivityTimestampTracker()
