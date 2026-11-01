# Contribution & Engineering Guidelines

## 1. Principles of Contribution

Welcome to the Focus Engine engineering team. Whether contributing to documentation, performance optimization, or future feature development, all team members must adhere to our core engineering principles:

1. **Maintain Codebase Integrity**: Never commit untested code. Preserve all existing comments, docstrings, and architectural patterns.
2. **Privacy First**: Any new feature involving user activity, telemetry, or cameras must run **100% locally on the user's machine**. No telemetry or user content may ever be sent to third-party cloud servers.
3. **Graceful Degradation**: If a hardware component (camera, network adapter, or OS hook) is absent or fails, the application must degrade gracefully without crashing.
4. **Zero Timer Drift**: Time calculations must always derive mathematically from epoch timestamps (`Date.now()`). Never use sequential counter increments for session timing.

---

## 2. Git Branching & Commit Conventions

### 1. Branch Naming Strategy
All new work should originate from a descriptive branch based on the four-engineer workstreams:
- `eng1/frontend-db-<feature>`: Frontend UI, timer engine, database schema, or analytics aggregations.
- `eng2/telemetry-buffer-<feature>`: Telemetry collectors, signal mappers, or Focus Buffer engine dynamics.
- `eng3/blocking-<feature>`: Hosts file blocker, process manager, main process IPC, or preload security.
- `eng4/cv-ml-<feature>`: Computer vision pipeline (OpenCV/MediaPipe) or machine learning models.

### 2. Conventional Commit Messages
Commits must follow the Conventional Commits format:
- `docs: add documentation for <module>`
- `feat: implement <feature>` (post-migration)
- `fix: resolve <bug>` (post-migration)
- `chore: update dependencies or build tooling`
- `test: add unit or integration tests`

---

## 3. Pull Request & Code Review Process

Every Pull Request (PR) must fulfill the following quality gates before merging:
1. **Automated Checks Pass**:
   - `npm run typecheck` passes with zero errors (`tsc --noEmit`).
   - `npm run lint` passes with zero ESLint warnings.
2. **Peer Review**:
   - At least one engineer from another workstream must review and approve the PR.
   - Cross-module touchpoints (e.g. changing an IPC channel name or altering a database column) require review by the respective module owner.
3. **Documentation Parity**:
   - Any architectural modification must be accompanied by corresponding updates in the `docs/` directory.

---

## 4. Code Style & Standards

- **TypeScript**: Strict mode enabled (`strict: true`). Avoid using `any` wherever possible; use explicit interfaces and union types.
- **React Components**: Functional components with hooks. Isolate stateful business logic into custom hooks (`src/renderer/hooks/`).
- **Child Processes**: Never use `child_process.exec()` with raw interpolated strings. Always use `execFile` or `spawn` with an array of sanitized arguments to prevent shell injection.
- **SQLite Queries**: Never concatenate raw strings into SQL statements. Always use parameterized queries (`db.prepare('... WHERE id = ?').get(id)`) to eliminate SQL injection vulnerabilities.
