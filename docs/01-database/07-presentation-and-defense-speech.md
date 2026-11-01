# Module 01: Database Architecture & Schema — Presentation & Defense Speech

## 1. Presentation Metadata

- **Target Presentation Duration**: **10 Minutes** (Core foundational storage module)
- **Target Audience**: Database Administrators, Backend Architects, Technical Evaluators
- **Primary Objective**: Detail the high-performance local persistence layer of Focus Engine, explaining the rationale for embedded SQLite over client-server engines, Write-Ahead Logging (WAL) concurrency, relational schema across 14 tables, query optimization, and the complete data lifecycle from memory to disk.
- **Delivery Pace**: ~135 – 145 words per minute (~1,400 spoken words)

---

## 2. Minute-by-Minute Presentation Timeline

| Time Marker | Section Title | Core Technical Message | Visual / Slide Cue |
|---|---|---|---|
| **00:00 – 01:30** | The Storage Problem & Engine Selection | Why embedded SQLite with `better-sqlite3` was selected; zero-network latency and offline data privacy. | SQLite Architecture slide contrasting local embedded DB vs. remote cloud APIs. |
| **01:30 – 03:30** | Concurrency via Write-Ahead Logging (WAL) | Mechanics of WAL mode (`PRAGMA journal_mode = WAL`); lock-free concurrent readers and single writer. | WAL log file diagram showing shared memory (`-shm`) and WAL file (`-wal`). |
| **03:30 – 05:30** | Schema Tour: Core Entities & Relationships | The 14 relational tables: `sessions`, `distraction_events`, `buffer_snapshots`, `cv_metrics`, and indexes. | Full Entity-Relationship (ER) diagram highlighting foreign key constraints. |
| **05:30 – 07:30** | Query Performance & Prepared Statements | Synchronous C++ binding performance, parameterized queries against SQL injection, indexing strategy. | Benchmark comparison: `db.prepare()` vs. ad-hoc query string compilation. |
| **07:30 – 09:00** | Data Lifecycle, Retention & Integrity | Transaction safety, crash recovery, checkpointing, and local data sovereignty guarantees. | Data Lifecycle flowchart tracing a telemetry packet from memory to SQLite disk commit. |
| **09:00 – 10:00** | Conclusion & Evaluator Defense | Summary of storage reliability, zero corruption incidents, transition to technical Q&A. | Summary slide with database KPIs (<1ms queries, zero network footprint). |

---

## 3. Verbatim Spoken Presentation Track

### [00:00 – 01:30] Section 1: The Storage Problem & Engine Selection

> "Good morning. In this session, I will walk you through the database architecture and persistence engine of **Focus Engine**.
> 
> When architecting a desktop productivity system that continuously records real-time human interaction signals—active window switches, keystroke cadence, mouse velocity, computer vision facial landmarks, and dynamic buffer snapshots—the storage layer faces an intense workload. Every second, multi-modal telemetry must be captured without causing micro-stutter in the Electron user interface.
> 
> We evaluated three architectural paths: cloud database APIs like Firebase or PostgreSQL, flat JSON files, and embedded SQLite. 
> 
> Cloud databases were immediately disqualified: they introduce network latency, require user accounts, fail when working offline in airplanes or air-gapped environments, and violate our core privacy commitment: **your work telemetry must never leave your computer**. Flat JSON files fail under concurrent write operations and lack transactional integrity.
> 
> We chose **embedded SQLite** powered by the high-performance native C++ driver **`better-sqlite3`**. By running in-process inside Node.js, SQLite gives us sub-millisecond query execution, zero network overhead, ACID transaction guarantees, and complete data sovereignty in a single, portable database file."

---

### [01:30 – 03:30] Section 2: Concurrency via Write-Ahead Logging (WAL)

> "The central challenge with standard SQLite in high-throughput applications is locking: by default, writing to a database locks the entire file, blocking any concurrent reads. In Focus Engine, where telemetry writes arrive every second while the React UI continuously reads state for SVG gauges, traditional rollback journaling would lead to severe `database locked` exceptions.
> 
> To achieve lock-free high concurrency, we configure SQLite at startup with **Write-Ahead Logging (WAL)**:
> ```sql
> PRAGMA journal_mode = WAL;
> PRAGMA synchronous = NORMAL;
> PRAGMA foreign_keys = ON;
> PRAGMA cache_size = -64000;
> ```
> 
> In WAL mode, changes are appended to a separate `-wal` log file rather than overwriting the main database pages. This completely decouples readers from writers: **readers never block writers, and writers never block readers**. The React frontend can query historical session streaks or aggregate circadian heatmaps simultaneously while the main process commits buffer state transitions. 
> 
> Furthermore, `PRAGMA synchronous = NORMAL` provides full crash durability for WAL mode while eliminating redundant disk flushes on every single write transaction."

---

### [03:30 – 05:30] Section 3: Schema Tour: Core Entities & Relationships

> "Let's examine the schema. Focus Engine's persistence layer is organized across **14 relational tables**, structured cleanly around the session lifecycle:
> 
> 1. At the core is the **`sessions`** table. It stores the session UUID, scheduled vs. actual duration, completion status, and the final aggregated `focus_score`.
> 2. Surrounding `sessions` are our time-series telemetry tables:
>    - **`buffer_snapshots`**: Captures the continuous 0 to 100 Focus Buffer value sampled once every 60 seconds.
>    - **`buffer_state_transitions`**: Records discrete shifts between `focused`, `warning`, `critical`, and `paused`, logging exact millisecond dwell times.
>    - **`window_activity_logs`**: Logs active window titles, process names, and productive vs. unproductive classifications.
>    - **`distraction_events`**: Stores discrete violations like `blacklist_visit` or `sustained_distraction`.
>    - **`cv_metrics`**: Stores facial attention scores, head pose pitch/yaw, and gaze classifications.
>    - **`app_kill_events`**: Records blacklisted applications terminated by our process watchdog.
> 3. Supporting configuration tables manage user rules: `blocked_domains`, `blocked_apps`, `preset_configs`, and `distraction_scores`.
> 
> Every child table maintains a strict foreign key referencing `sessions(session_id)` with cascading indexes on `(session_id, timestamp)` to ensure instant sub-millisecond query performance during post-session summary generation."

---

### [05:30 – 07:30] Section 4: Query Performance & Prepared Statements

> "On the implementation level in `src/main/database/db.ts`, we enforce two critical engineering rules:
> 
> First, **zero ad-hoc SQL string concatenation**. Every query in the codebase utilizes compiled prepared statements:
> ```typescript
> const stmt = db.prepare('SELECT * FROM sessions WHERE session_id = ?')
> return stmt.get(sessionId)
> ```
> This guarantees two benefits:
> 1. It completely eliminates SQL injection vulnerabilities across the application.
> 2. SQLite compiles and optimizes the VDBE byte-code once, allowing subsequent queries to execute in microseconds directly from memory.
> 
> Second, all bulk operations—such as initial schema bootstrapping or batch telemetry flushes—are wrapped in explicit transactions using `db.transaction()`. In SQLite, wrapping 1,000 inserts inside an explicit transaction reduces disk I/O from 1,000 individual disk commits to a single atomic flush, accelerating write throughput by over 50x."

---

### [07:30 – 09:00] Section 5: Data Lifecycle, Retention & Integrity

> "Let's trace how data moves through its lifecycle. 
> 
> When a session is active, high-frequency events (keystrokes and mouse movements) are aggregated in RAM. Once every minute, the orchestrator commits a structured snapshot into `buffer_snapshots`. Discrete infractions—such as an unauthorized application launch—are written immediately to disk within `distraction_events`.
> 
> When the session completes, the database transaction finalizes:
> 1. It writes the exact actual duration into `sessions.duration_actual_sec`.
> 2. It calculates the multi-factor focus score and updates `sessions.focus_score`.
> 3. The newly committed session immediately becomes visible to our downstream analytics queries in `src/main/analytics/`, which aggregate the 7x24 circadian heatmap and compute daily streaks.
> 
> Because SQLite is embedded, backups and migrations are trivial: the entire user history resides in `focus_engine.db`. Upgrades are managed through idempotent `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE` version checks at startup."

---

### [09:00 – 10:00] Section 6: Conclusion & Defense Readiness

> "To conclude: Focus Engine's database subsystem was built with uncompromising standards for local performance, ACID reliability, and data privacy. By pairing SQLite with `better-sqlite3`, WAL concurrency, and index-optimized relational schemas, we achieved a persistence layer that handles 1 Hz continuous telemetry with sub-millisecond overhead and zero database locking.
> 
> It is robust, secure, and ready for enterprise-grade developer workstations.
> 
> Thank you. I welcome your questions regarding our schema design, concurrency models, or query performance."

---

## 4. Technical Defense: Tough Evaluator Questions & Model Answers

### Question 1: "Why use `better-sqlite3` instead of the asynchronous `sqlite3` library or an ORM like Prisma or TypeORM?"
**Model Answer:**
> "`sqlite3` executes queries asynchronously on a Node threadpool worker, which introduces thread-switching overhead and callback latency. In desktop applications with local disk access, SQLite reads take mere microseconds—so the threadpool context-switching overhead in `sqlite3` actually makes it significantly slower than direct synchronous execution. `better-sqlite3` compiles directly against SQLite's native C API and executes synchronously on the V8 main thread without thread hopping. Furthermore, we deliberately rejected ORMs like Prisma or TypeORM: they add heavy abstraction bloat, slow down application startup by hundreds of milliseconds, and obscure the underlying SQL execution plans. Our hand-crafted repositories in `src/main/database/` provide 100% typed, transparent, and optimized queries."

### Question 2: "In WAL mode, what happens if the application crashes or the PC loses power before a checkpoint occurs?"
**Model Answer:**
> "ACID transactional integrity is fully preserved. In WAL mode, every committed transaction is written to the `-wal` file sequentially with checksum headers. If power is lost or the process is killed unexpectedly, uncommitted transactions are cleanly ignored. Upon restart, SQLite automatically opens the `-wal` file, inspects the transaction headers, replays all valid committed transactions into the main `.db` file, and resumes normal operation. Zero manual recovery or repair commands are ever required."

### Question 3: "How do you handle timestamps across timezones to ensure streaks and heatmaps don't break when traveling?"
**Model Answer:**
> "All raw timestamps in SQLite are stored as UTC epoch milliseconds (`Date.now()`). However, habit streaks and circadian heatmaps are strictly local human phenomena. When querying heatmaps or daily streaks in `heatmapRepository.ts` and `streakCalculator.ts`, we push timezone conversion down to SQLite's C-engine using the `'localtime'` modifier:
> `strftime('%w', start_time / 1000, 'unixepoch', 'localtime')`
> This rebases UTC timestamps to the user's current local clock on the fly without altering the underlying immutable UTC storage."

