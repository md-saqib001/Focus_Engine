import { DistractionEventRow } from '../database/distractionEventsRepository'

/**
 * Calculates the total subtractive distraction penalty for a set of events
 * occurring in the current tick.
 * 
 * Event Penalties:
 * - sustained_distraction -> 8
 * - excessive_switching -> 5
 * - blacklist_visit -> 10
 * - extended_idle -> 3
 * 
 * Deduplication Rationale:
 * If both sustained_distraction and blacklist_visit fire for the same domain
 * within the same tick range, we apply only the larger penalty (blacklist_visit = 10)
 * rather than summing both (10 + 8 = 18). Staying on a blacklisted domain long enough
 * to trigger a sustained distraction warning is a continuation of the initial
 * blacklist visit behavior. Double-penalizing would apply a massive -18 subtractive drop,
 * draining the user's focus energy buffer instantly and causing excessive sensitivity.
 */
export function calculatePenalty(events: DistractionEventRow[]): number {
  let totalPenalty = 0

  const domainEventsMap = new Map<string, string[]>()
  const nonDomainEvents: string[] = []

  for (const event of events) {
    let domain: string | null = null
    try {
      const parsedData = JSON.parse(event.event_data)
      domain = parsedData.domain || null
    } catch {
      // ignore
    }

    if (domain) {
      const cleanDomain = domain.toLowerCase().trim()
      if (!domainEventsMap.has(cleanDomain)) {
        domainEventsMap.set(cleanDomain, [])
      }
      domainEventsMap.get(cleanDomain)!.push(event.event_type)
    } else {
      nonDomainEvents.push(event.event_type)
    }
  }

  // Calculate penalties for domain events with deduplication
  for (const [_, types] of domainEventsMap.entries()) {
    const hasBlacklist = types.includes('blacklist_visit')
    const hasSustained = types.includes('sustained_distraction')

    if (hasBlacklist && hasSustained) {
      // Deduplicate: Apply larger penalty (blacklist_visit = 10) instead of both (10 + 8 = 18)
      totalPenalty += 10

      // Add any other types if present (excluding the deduplicated pair)
      for (const t of types) {
        if (t !== 'blacklist_visit' && t !== 'sustained_distraction') {
          totalPenalty += getPenaltyValue(t)
        }
      }
    } else {
      // Apply normal individual penalties
      for (const t of types) {
        totalPenalty += getPenaltyValue(t)
      }
    }
  }

  // Calculate penalties for non-domain events (like extended_idle or excessive_switching)
  for (const t of nonDomainEvents) {
    totalPenalty += getPenaltyValue(t)
  }

  return totalPenalty
}

function getPenaltyValue(type: string): number {
  switch (type) {
    case 'sustained_distraction':
      return 8
    case 'excessive_switching':
      return 5
    case 'blacklist_visit':
      return 10
    case 'extended_idle':
      return 3
    default:
      return 0
  }
}
