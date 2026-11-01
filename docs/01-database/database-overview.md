# Database Overview

## Technology

Focus Engine uses **SQLite** via the `better-sqlite3` npm package (v12.11.1).

The database is a single file stored in the OS user-data directory:
- **Windows**: `C:\Users\{username}\AppData\Roaming\focus-engine-temp\focus-engine.db`
- **macOS**: `~/Library/Application Support/focus-engine-temp/focus-engine.db`
- **Linux**: `~/.config/focus-engine-temp/focus-engine.db`

The path is resolved at runtime using Electron's `app.getPath('userData')`.

---

## Why SQLite?

| Requirement | How SQLite Satisfies It |
|-------------|------------------------|
| Local-only storage (privacy) | Single file, no server, no network |
| Simple schema evolution | `ALTER TABLE ADD COLUMN` migrations inline in `db.ts` |
| High-frequency small writes (telemetry) | WAL mode enables concurrent reads during writes |
| Analytics queries over session history | Full SQL support for aggregations and joins |
| Zero configuration | No install, no daemon, no port |
| Electron compatibility | `better-sqlite3` has pre-built binaries for Electron via `electron-builder install-app-deps` |

---

## Connection Management

**Source**: `src/main/database/db.ts`

The database uses a **singleton pattern**:

```typescript
let db: Database.Database | null = null

export function getDatabase(): Database.Database {
  if (db) return db
  // ... initialize once
  return db
}

export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}
```

- `getDatabase()` is called once at startup (`src/main/index.ts:68`).
- All repository modules call `getDatabase()` to obtain the shared instance.
- `closeDatabase()` is called in the `before-quit` handler to flush WAL and release the file lock.

**WAL Mode**:
```typescript
db.pragma('journal_mode = WAL')
```
Write-Ahead Logging allows reads to proceed concurrently with writes. Since the telemetry poller writes every 5 seconds while the renderer may be reading analytics data, WAL prevents read-blocks.

---

## Schema Summary

| Table | Purpose | Retention |
|-------|---------|-----------|
| `sessions` | One row per completed focus session | Permanent |
| `window_focus` | Active window snapshot every 5s | Permanent |
| `keyboard_metrics` | KPM readings every 10s | Permanent |
| `mouse_metrics` | Mouse activity readings every 10s | Permanent |
| `distraction_events` | Detected distraction incidents | Permanent |
| `cv_metrics` | Raw per-frame CV readings | Permanent (no purge implemented) |
| `cv_metrics_summary` | Per-session CV aggregate | Permanent |
| `buffer_snapshots` | Focus buffer value every 60s | Permanent |
| `buffer_state_transitions` | State machine changes | Permanent |
| `blocked_domains` | User's website blocklist | User-managed |
| `blacklisted_apps` | User's app blocklist | User-managed |
| `app_kill_events` | Record of each app termination | Permanent |
| `app_settings` | Key-value configuration store | Permanent |
| `retrain_history` | ML retraining run log | Permanent |

---

## Inline Migration Strategy

Focus Engine does not use a formal migration framework (e.g., Flyway, Knex migrations). Instead, `db.ts` uses **inline defensive migrations** with `PRAGMA table_info()`:

```typescript
// Example: adding auto_paused_count to sessions
const columns = db.pragma("table_info(sessions)") as { name: string }[]
const hasAutoPaused = columns.some((c) => c.name === 'auto_paused_count')
if (!hasAutoPaused) {
  db.exec('ALTER TABLE sessions ADD COLUMN auto_paused_count INTEGER NOT NULL DEFAULT 0;')
}
```

**Advantages**:
- No migration version tracking needed for a single-developer project.
- Idempotent: safe to run on every startup.
- Backward compatible: existing data is preserved.

**Disadvantages**:
- No rollback capability.
- Migrations cannot rename or remove columns (SQLite limitation: `ALTER TABLE DROP COLUMN` requires SQLite 3.35+).
- The special-case migration for `blacklisted_apps` (drops and recreates the table when `is_enabled` is missing) is destructive — existing blacklisted app records are lost.

---

## Repository Pattern

Each table is encapsulated in a dedicated **repository module** under `src/main/database/`:

| Repository File | Table(s) Managed |
|-----------------|-----------------|
| `sessionRepository.ts` | `sessions` |
| `windowFocusRepository.ts` | `window_focus` |
| `keyboardMetricsRepository.ts` | `keyboard_metrics` |
| `mouseMetricsRepository.ts` | `mouse_metrics` |
| `distractionEventsRepository.ts` | `distraction_events` |
| `cvMetricsRepository.ts` | `cv_metrics`, `cv_metrics_summary` |
| `bufferSnapshotsRepository.ts` | `buffer_snapshots` |
| `bufferStateTransitionsRepository.ts` | `buffer_state_transitions` |
| `blockedDomainsRepository.ts` | `blocked_domains` |
| `blacklistedAppsRepository.ts` | `blacklisted_apps` |
| `settingsRepository.ts` | `app_settings` |
| `telemetryAggregator.ts` | Cross-table aggregation queries |

Each repository calls `getDatabase()` to obtain the shared connection and uses prepared statements for efficiency.

---

## See Also

- [database-schema.md](./database-schema.md) — Full column-level schema for every table
- [data-models.md](./data-models.md) — TypeScript interfaces and their database mappings
- [database-operations.md](./database-operations.md) — Key queries explained
- [data-lifecycle.md](./data-lifecycle.md) — How data flows in and out of the database
- [database-decisions.md](./database-decisions.md) — Engineering decisions and trade-offs
