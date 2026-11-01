# Database Engineering Decisions

This document explains why the database is designed the way it is — covering choices, trade-offs, alternatives considered, and known limitations.

---

## Decision 1: SQLite Over a Client-Server Database

**Decision**: Use SQLite (via `better-sqlite3`) as the sole persistence layer.

**Rationale**:
- Focus Engine is a single-user desktop application. There is no network, no concurrent users, and no external API clients.
- SQLite requires zero installation, no background service, and no configuration — aligning with the app's fully offline, privacy-first architecture.
- The database file is stored in the OS user-data directory and is naturally isolated per user account.

**Alternative considered**: PostgreSQL or MySQL with a local server.
- **Rejected because**: A local server database adds setup complexity, requires a background daemon, and is unnecessary for single-user write volumes.

**Alternative considered**: IndexedDB (browser storage via Electron's renderer).
- **Rejected because**: IndexedDB runs in the renderer process, which would expose raw session data to the Chromium environment. Moving database access to the main process is a stronger security boundary — if the renderer is compromised, it cannot directly query session history.

---

## Decision 2: Synchronous `better-sqlite3` Over Async Alternatives

**Decision**: Use `better-sqlite3`'s synchronous API.

**Rationale**:
- The main process has a single-writer architecture. There is no benefit to async writes when only one thread ever writes.
- Synchronous code is simpler to reason about and test.
- `ipcMain.handle()` supports `async` handlers, so if truly needed, async could be adopted. But `better-sqlite3` sync calls complete in microseconds for Focus Engine's write volume.

**Trade-off**: On very long sessions with massive telemetry buffers, a single large transaction could briefly block the main event loop. At Focus Engine's write frequency (12 window records per flush, 1 buffer snapshot per minute), this is not a practical concern.

---

## Decision 3: Write Session Only Once at Termination

**Decision**: The `sessions` table is written with a single INSERT when the session ends, not progressively.

**Rationale**:
- This avoids mid-session desync where the database has a partial state that doesn't match what the timer shows.
- The session ID is generated client-side (`crypto.randomUUID()`) before anything is written, so all telemetry records can reference it immediately.
- All volatile session state (elapsed time, buffer value, paused state) lives in React refs and state — these are correct by design and need no database sync.

**Consequence**: A hard crash (power loss, OS kill) during an active session loses that session's data. The telemetry records (window_focus, keyboard_metrics, etc.) referenced by the session_id are still written (they're written incrementally), but there is no sessions row to join against.

**Alternative considered**: Checkpoint writes every N seconds.
- **Not implemented**: Would require UPDATE logic and a mechanism to handle partial/orphaned sessions on next launch.

---

## Decision 4: Inline Migrations in `db.ts`

**Decision**: Schema migrations are done inline in `getDatabase()` using `PRAGMA table_info()` checks and `ALTER TABLE ADD COLUMN`.

**Rationale**:
- The project is maintained by a small team (training exercise). A full migration framework (e.g., Knex migrations with version table) adds overhead disproportionate to the benefit.
- SQLite `ALTER TABLE ADD COLUMN` is safe and idempotent.
- Running checks on every startup is cheap: `PRAGMA table_info()` reads SQLite's internal schema table, which is always cached.

**Known limitation**: SQLite (prior to 3.35) does not support `ALTER TABLE DROP COLUMN` or `ALTER TABLE RENAME COLUMN`. If a column needs to be removed or renamed, the only option is to drop and recreate the table, which loses data (as done for `blacklisted_apps` when the `is_enabled` column was added).

**Alternative considered**: Knex.js migrations.
- **Not implemented**: Would require a migration version tracking table, sequential migration files, and rollback mechanisms. This overhead is justified in production multi-developer projects but not here.

---

## Decision 5: Batch Inserts for Window Focus Telemetry

**Decision**: `TelemetryPoller` buffers up to 12 records in memory before flushing to SQLite in a single transaction.

**Rationale**:
- 12 records × 5s interval = 1 disk flush per minute instead of 12 individual flushes.
- SQLite performs best with larger transactions. Individual inserts each require a WAL write, lock acquisition, and fsync. A single transaction with 12 inserts does this once.
- Memory cost is negligible: 12 small objects ≈ a few kilobytes.

**Trade-off**: If the app crashes between flushes, up to ~60 seconds of window telemetry is lost. This is acceptable because window focus history is supplementary data, not primary session data.

---

## Decision 6: No Foreign Key Enforcement

**Decision**: `PRAGMA foreign_keys = ON` is never called in `db.ts`. Foreign key relationships are enforced only by convention.

**Rationale**:
- SQLite foreign key enforcement is opt-in. Without enabling it, `REFERENCES` declarations in `CREATE TABLE` are syntax-only — no constraint is actually applied.
- Focus Engine's write patterns are controlled: telemetry records are always written after a session_id is established, and cleanup is not performed (no deletes), so orphan records are not a practical risk.

**Risk**: If a bug caused orphan telemetry records (records referencing a non-existent session_id), they would silently persist. Analytics queries using JOINs might return unexpected results.

**Recommendation for future work**: Enable `PRAGMA foreign_keys = ON` and add proper `ON DELETE CASCADE` clauses. This would catch bugs earlier at the cost of slightly stricter insert ordering requirements.

---

## Decision 7: Timestamps as Unix Milliseconds (with one exception)

**Decision**: All timestamps are stored as `INTEGER` in Unix milliseconds (`Date.now()` from JavaScript).

**Exception**: `app_kill_events.killed_at` uses SQLite's `DATETIME DEFAULT CURRENT_TIMESTAMP`, which produces a string like `"2026-11-01 10:30:00"`.

**Rationale for Unix ms**:
- JavaScript's `Date.now()` is the natural timestamp source. Storing ms avoids unit conversion.
- Integer comparisons are faster than string datetime comparisons in SQLite.
- Cross-timezone queries are correct without timezone conversion.

**Why the exception exists**: `app_kill_events` was likely added quickly and used SQLite's default DATETIME behavior rather than the project convention. This inconsistency means `killed_at` cannot be used in range queries alongside `INTEGER` timestamps without conversion.

**Recommendation**: Change `killed_at` to `INTEGER NOT NULL DEFAULT (unixepoch()*1000)` in a future migration.

---

## Known Limitations

| Limitation | Impact | Severity |
|------------|--------|---------|
| No data purge mechanism | Database grows indefinitely | Medium |
| No FK enforcement | Orphan records possible on bugs | Low |
| Crash during session loses session row | Session data lost on hard crash | Medium |
| `app_kill_events.killed_at` uses DATETIME | Cannot be used in range queries | Low |
| Inline migrations cannot rename/drop columns | Schema refactoring is destructive | Medium |
| No backup/export mechanism | User data cannot be migrated | Medium |
| No encryption | Database is readable by any process with file access | Low (local only) |
