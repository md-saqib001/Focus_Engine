# Session Review Notes & Guidelines

Use this document to flag sessions that were created purely for engineering testing and feature verification (e.g., during Phase 1-5 development), so they can be purged from the database prior to ML training.

## Heuristics / Patterns of Test Sessions

When reviewing `session_review.csv`, look for these indicators of test sessions:

1. **Short Durations**:
   - Focus sessions with `duration_actual_sec` under 120 seconds (2 minutes). Real sessions should be longer.
2. **Force Ended**:
   - Sessions with `end_reason='force_ended'` or `end_reason='abandoned'` in rapid succession (likely testing block triggers or Day 33 auto-pause/force-end logic).
3. **Distraction Spike / App Kill Densities**:
   - High numbers of distraction events or app kills in a short duration (e.g., 5+ distractions or app kills in a 3-minute session).
4. **Temporal Density**:
   - Multiple sessions started within minutes of each other (indicating consecutive code-test cycles).
5. **Score Zero**:
   - Average score is exactly 0% with no focus telemetry.
6. **Self-Memory**:
   - Any sessions you recall initiating deliberately to test specific telemetry code, key listeners, hosts modification, or gaze tracking.

---

## Session IDs Flagged for Deletion

List the session IDs you want to delete below (paste them one per line in `to_purge.txt` or edit the list in the purge script):

```txt
# Paste session IDs here, e.g.
# 723b43e5-77a7-449f-96f3-02d0ec1f00a6
```
