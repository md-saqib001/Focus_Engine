/**
 * Maps a real-time computer vision attention score and face presence state to
 * a numeric multiplier for the Focus Buffer.
 * 
 * Mapping criteria:
 * - face_present is false -> 0.3
 * - attention_score 0.8 to 1.0 -> 1.0
 * - attention_score 0.4 to 0.79 -> 0.85
 * - attention_score 0.0 to 0.39 -> 0.5
 * - attention_score is null (warmup/disabled) -> 1.0 (neutral)
 */
export function mapCVToMultiplier(
  attentionScore: number | null | undefined,
  facePresent: boolean | null | undefined
): number {
  if (attentionScore === null || attentionScore === undefined || facePresent === null || facePresent === undefined) {
    return 1.0 // CV disabled, warmup, or neutral state (don't penalize)
  }

  if (!facePresent) {
    return 0.80 // Face not present, takes 30s of total absence to empty buffer
  }

  if (attentionScore >= 0.8) {
    return 1.0
  }
  
  if (attentionScore >= 0.4) {
    return 0.85
  }
  
  return 0.80 // Gaze distraction, takes 30s of distraction to empty buffer
}
