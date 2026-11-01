# Focus Buffer Architecture Decisions & Trade-Offs

## 1. Architectural Decision Records (ADRs)

### ADR-01: Continuous Energy Reservoir vs. Discrete Infraction Counter
- **Context**: Productivity trackers historically take one of two approaches: either strict binary blockers that fail immediately on distraction, or passive tally systems that count infractions at the end of a session.
- **Decision**: Model attention as an active, continuous dynamic energy reservoir (`FocusBuffer`, $0.0 - 100.0$) governed by fluid mechanics (exponential decay, additive recovery, subtractive penalties).
- **Rationale**:
  - Attention is not binary; cognitive state fluctuates continuously.
  - A dynamic reservoir provides real-time ambient feedback (visual glow, timer status) that encourages users to course-correct *before* failing a session.
  - Gives the user a sense of agency: momentum can be lost, but it can also be earned back through focused presence.
- **Trade-Off**: Higher telemetry processing overhead (1 Hz evaluation loop) compared to static logging. Mitigated by lightweight arithmetic and decoupled SQLite batching.

---

### ADR-02: Additive Recovery vs. Multiplicative Recovery
- **Context**: Deciding how the buffer should regain vitality when the user is in pure focus ($m_i \ge 0.95$ and $P_{\text{penalty}} = 0$).
- **Alternatives Considered**:
  1. *Multiplicative Growth* ($V_{t+1} = V_t \times 1.02$): Compounding growth.
  2. *Additive Recovery* ($V_{t+1} = \min(100, V_t + 0.5)$): Linear constant growth.
- **Decision**: Adopt constant additive recovery ($+0.5$ points per second, or $+30$ points per minute).
- **Rationale**:
  - Under multiplicative recovery, a user whose buffer dropped to $10.0$ would only gain $+0.2$ points on their first second, requiring several minutes to escape the critical zone. Conversely, at $80.0$, they would gain $+1.6$ points/sec. This unfairly punishes users when they need encouragement most.
  - Additive recovery guarantees a predictable, fair contract: regaining $10$ points of lost buffer requires exactly $20$ seconds of continuous focus, regardless of starting score.

---

### ADR-03: Contextual Signal Overrides (Reading Mode & Typing Dominance)
- **Context**: A common failure of peripheral activity tracking is false distraction penalties during legitimate work patterns (e.g., reading a documentation page without touching the keyboard/mouse, or typing a long paragraph without moving the mouse).
- **Decision**: Implement cross-signal contextual overrides:
  1. **Reading Flow Override**: If $m_{\text{cv}} == 1.0$ (eye gaze confirmed steady on-screen), all peripheral keyboard and mouse idle penalties are neutralized to zero.
  2. **Typing Dominance Override**: If typing activity is confirmed ($KPM \ge 5$), the mouse idle penalty is neutralized to zero.
- **Rationale**:
  - Developers spend large fractions of their day reading diffs, architecture diagrams, and stack traces. Penalizing them for mouse or keyboard inactivity when their eyes are locked on the monitor creates user frustration and disables tracking.
  - Writers and coders keep hands on the keyboard home row; requiring mouse movement during active typing is hostile to ergonomic productivity.

---

### ADR-04: Grace Periods and Warmup Mechanics
- **Context**: Sessions often begin with minor adjustments (rearranging windows, setting up terminals). Additionally, humans naturally glance away briefly to check reference material or second monitors.
- **Decision**:
  1. **10-Second Warmup Period**: All multipliers are clamped to $1.0$ for the first 10 seconds of every session.
  2. **10-Second Look-Away Grace Period**: Brief glances away from the camera do not trigger CV penalty decay until gaze has been averted continuously for $>10$ seconds.
- **Rationale**:
  - Prevents immediate buffer drops during session initialization.
  - Eliminates micro-stutter penalties caused by natural eye blinks, dual-monitor workflows, or consulting handwritten engineering notes.

---

### ADR-05: Deduplication of Co-Occurring Infractions
- **Context**: A user opening a blacklisted website triggers both an active window blacklist event and a sustained distraction event if they remain there.
- **Decision**: Deduplicate co-occurring domain events in the same tick by applying $\max(\text{Penalty}_{\text{blacklist}}, \text{Penalty}_{\text{sustained}}) = 10$, rather than summing them ($10 + 8 = 18$).
- **Rationale**:
  - Double-penalizing for the same causal incident causes a cataclysmic drop in buffer vitality, pushing the user directly from focused to critical in a matter of seconds.
  - Deduplication preserves strong negative reinforcement while avoiding catastrophic demotivation.

---

### ADR-06: Decoupled 60-Second Snapshot Archival
- **Context**: How frequently should buffer values be written to disk for end-of-session aggregation and post-mortem charts?
- **Decision**: Evaluate the buffer in memory at 1 Hz, but persist snapshots to SQLite (`buffer_snapshots`) at 60-second intervals. State transitions (`buffer_state_transitions`) are persisted immediately on change.
- **Rationale**:
  - Writing to SQLite every second for an 8-hour session generates 28,800 database inserts, inflating disk I/O and database size.
  - A 60-second snapshot interval generates only 480 points for an 8-hour session, which provides high fidelity for UI line graphs while maintaining sub-millisecond database writes.
  - Critical discrete events (state transitions and penalties) are logged instantaneously upon occurrence, ensuring zero data loss for KPIs.
