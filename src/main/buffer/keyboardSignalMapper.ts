/**
 * Maps keyboard typing activity (KPM) and current active window category
 * to a Focus Buffer multiplier.
 * 
 * Rationale for conservative design:
 * Keystrokes are a weaker signal of focus than direct eye contact or camera pose.
 * A user can be deeply focused on a task while typing nothing (e.g. reading a
 * document, studying code, or reviewing a website). Therefore, we never penalize
 * the user below 0.9.
 * 
 * Rules:
 * - distraction category -> 1.0 (to avoid double-penalizing, since the window focus
 *   or distraction penalty systems will already flag it).
 * - productive category:
 *   - 0-5 KPM -> 0.9 (very mild decay, assuming they might be reading/studying).
 *   - 5+ KPM -> 1.0 (fully active focus).
 * - neutral/unknown category -> 1.0 (no effect).
 */
export function mapKPMToMultiplier(kpm: number, category: string): number {
  if (category === 'distraction') {
    return 1.0 // Avoid double-penalizing
  }

  if (category === 'productive') {
    if (kpm < 5) {
      return 0.9 // Mild decay during idle reading
    }
    return 1.0 // Fully focused typing
  }

  // neutral, unknown or empty categories are neutral
  return 1.0
}
