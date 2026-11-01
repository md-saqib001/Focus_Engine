/**
 * Configurable list of specific high-risk distraction domains.
 * Visiting these results in a harsher multiplier penalty (0.25x)
 * than typical distracted domains (0.4x).
 */
export const HIGH_RISK_DOMAINS = [
  'youtube.com',
  'netflix.com',
  'instagram.com',
  'facebook.com',
  'twitter.com',
  'x.com',
  'twitch.tv',
  'reddit.com'
]

/**
 * Maps the active window classification category and domain
 * to a Focus Buffer multiplier.
 * 
 * Rules:
 * - Productive category -> 1.0 (Optimal)
 * - Neutral category -> 0.95
 * - Unknown category -> 0.90
 * - Distraction category -> 0.40 (Real penalty teeth)
 * - Specific High-Risk Domains -> 0.25 (Heavy penalization)
 */
export function mapWindowToMultiplier(category: string, domain: string): number {
  const cleanDomain = (domain || '').toLowerCase().trim()
  
  const isHighRisk = HIGH_RISK_DOMAINS.some((hd) => {
    return cleanDomain === hd || cleanDomain.endsWith('.' + hd) || cleanDomain.includes(hd)
  })

  if (isHighRisk) {
    return 0.25 // Heavy penalty for streaming/social media distraction
  }

  if (category === 'distraction') {
    return 0.40
  }

  if (category === 'productive') {
    return 1.00
  }

  if (category === 'neutral') {
    return 1.00 // Neutral, don't penalize
  }

  // category === 'unknown'
  return 1.00 // Unknown, don't penalize
}
