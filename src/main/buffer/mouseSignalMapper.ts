/**
 * Maps user input idle duration (seconds since last mouse/keyboard interaction)
 * and active window category to a Focus Buffer mouse multiplier.
 * 
 * Rationale:
 * This catches extended absence from the computer. Active mouse movement is not 
 * heavily rewarded (kept at 1.0), but prolonged idle duration (> 2 minutes)
 * triggers a buffer decay.
 * 
 * Rules:
 * - distraction category -> 1.0 (to avoid double-penalizing).
 * - productive category:
 *   - < 120s -> 1.0 (normal focus).
 *   - 120s - 299s -> 0.85 (extended idle/reading warning).
 *   - >= 300s -> 0.60 (extended absence penalty).
 * - neutral/unknown category -> 1.0.
 */
export function mapMouseToMultiplier(idleDurationSec: number, category: string): number {
  if (category === 'distraction') {
    return 1.0 // Avoid double-penalizing
  }

  if (category === 'productive') {
    if (idleDurationSec < 120) {
      return 1.0
    }
    if (idleDurationSec < 300) {
      return 0.85
    }
    return 0.60
  }

  // neutral, unknown or empty categories are neutral
  return 1.0
}
