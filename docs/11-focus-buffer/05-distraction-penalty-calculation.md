# Distraction Penalty Calculation and Deduplication

## 1. Architectural Purpose

In the Focus Engine energy reservoir model, cognitive decay happens along two mathematical axes:
1. **Continuous Multiplicative Friction**: Slow passive drain caused by eye glances, low keystroke frequency, or mouse inactivity via multiplier coefficients ($m_{\text{cv}}, m_{\text{kb}}, m_{\text{mouse}}, m_{\text{win}}$).
2. **Discrete Subtractive Penalties**: Direct, immediate deductions applied to the buffer value ($P_{\text{penalty}}$) triggered by high-severity behavioral infractions.

The **Distraction Penalty Calculator** (`src/main/buffer/distractionPenaltyCalculator.ts`) evaluates distraction event rows emitted by the telemetry pipeline during the preceding tick, translates them into quantitative point deductions, and applies deduplication logic to prevent punitive cascading drain.

---

## 2. Penalty Calibration Matrix

Each infraction type is assigned an empirical point weight calibrated against user stamina:

| Event Type | Point Penalty | Behavioral Trigger | Rationale |
|---|---|---|---|
| **`blacklist_visit`** | **`-10`** | Active foreground window navigates to a prohibited URL or launches a blacklisted executable | Direct breach of explicit focus intentions. Immediate drop shifts buffer towards warning state. |
| **`sustained_distraction`** | **`-8`** | Gaze directed away from screen continuously for $>10$ seconds or prolonged neutral app usage | Reflects sustained loss of cognitive presence while not on an explicitly banned app. |
| **`excessive_switching`** | **`-5`** | Switching active application windows more than 6 times within 10 seconds | Indicative of frantic multitasking, attention fragmentation, or distraction hunting. |
| **`extended_idle`** | **`-3`** | Zero keyboard and mouse events for $>120$ seconds without active reading context | Indicates abandonment of the workstation or non-work interruption. |

---

## 3. The Deduplication Problem and Rationale

### The Cascading Penalty Trap
A naive penalty aggregator would simply calculate:
$$P = \sum_{e \in \text{events}} \text{penalty}(e.\text{type})$$

However, telemetry events often exhibit strong causal correlation. For instance:
- A user opens `reddit.com` (a blacklisted domain).
- The telemetry engine immediately emits a `blacklist_visit` event.
- If the user stays on Reddit for 10 seconds, the window detector simultaneously emits a `sustained_distraction` event for `reddit.com`.

If both penalties fire in the same calculation cycle or window:
$$\text{Naive Penalty} = 10 (\text{blacklist}) + 8 (\text{sustained}) = 18 \text{ points}$$

An 18-point instantaneous subtractive drop drains nearly one-fifth of the user's total focus capacity instantly. If coupled with multiplicative decay, the buffer drops from $100 \rightarrow 72 \rightarrow 48$ within 2 seconds, triggering panic warnings and damaging trust in the system. Staying on a blacklisted domain is a continuation of the initial breach, not two distinct independent failures.

### Deduplication Rule
When both `blacklist_visit` and `sustained_distraction` occur for the **same domain** within the evaluation tick:
$$\text{Deduplicated Domain Penalty} = \max(\text{Penalty}_{\text{blacklist}}, \text{Penalty}_{\text{sustained}}) = 10$$

Other non-colliding events (such as `excessive_switching` or events on independent domains) remain additive.

---

## 4. Implementation Analysis

```typescript
export function calculatePenalty(events: DistractionEventRow[]): number {
  let totalPenalty = 0

  const domainEventsMap = new Map<string, string[]>()
  const nonDomainEvents: string[] = []

  // 1. Group events by domain vs non-domain
  for (const event of events) {
    let domain: string | null = null
    try {
      const parsedData = JSON.parse(event.event_data)
      domain = parsedData.domain || null
    } catch {
      // ignore JSON parse failures on raw logs
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

  // 2. Evaluate domain events with deduplication
  for (const [_, types] of domainEventsMap.entries()) {
    const hasBlacklist = types.includes('blacklist_visit')
    const hasSustained = types.includes('sustained_distraction')

    if (hasBlacklist && hasSustained) {
      // Deduplicate: Apply larger penalty (10) instead of summing (10 + 8 = 18)
      totalPenalty += 10

      // Add other non-conflicting types for this domain if present
      for (const t of types) {
        if (t !== 'blacklist_visit' && t !== 'sustained_distraction') {
          totalPenalty += getPenaltyValue(t)
        }
      }
    } else {
      for (const t of types) {
        totalPenalty += getPenaltyValue(t)
      }
    }
  }

  // 3. Add non-domain events (extended_idle, excessive_switching)
  for (const t of nonDomainEvents) {
    totalPenalty += getPenaltyValue(t)
  }

  return totalPenalty
}

function getPenaltyValue(type: string): number {
  switch (type) {
    case 'sustained_distraction': return 8
    case 'excessive_switching':   return 5
    case 'blacklist_visit':       return 10
    case 'extended_idle':         return 3
    default:                      return 0
  }
}
```

---

## 5. Interaction with Additive Recovery

Subtractive penalties interact directly with the recovery gate inside `FocusBuffer.tick()`:

```typescript
const isPureFocus =
  cvMultiplier >= 0.95 &&
  keyboardMultiplier >= 0.95 &&
  mouseMultiplier >= 0.95 &&
  windowMultiplier >= 0.95 &&
  distractionPenalty === 0

if (isPureFocus) {
  this.currentValue = Math.min(100, this.currentValue + 0.5)
} else {
  const combinedMultiplier = cvMultiplier * keyboardMultiplier * mouseMultiplier * windowMultiplier
  this.currentValue = Math.max(0, (this.currentValue * combinedMultiplier) - distractionPenalty)
}
```

### Consequences:
1. **Immediate Invalidation of Recovery**: If `distractionPenalty > 0`, the system is mathematically forbidden from entering the $+0.5/\text{sec}$ additive recovery branch, even if peripheral keyboard or mouse metrics are pristine.
2. **Strict Clamping**: Deductions can never push the buffer into negative territory ($0.0 \le V \le 100.0$).
3. **Recovery Lag**: Recovering from a single `blacklist_visit` ($-10$) requires 20 seconds of continuous pristine focus ($20 \times 0.5 = 10$), creating a balanced psychological disincentive against tab-hopping.
