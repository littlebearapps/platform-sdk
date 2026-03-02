# Changelog

## [1.4.0] - 2026-03-02

### Fixed
- **gap-detection.ts**: Added KV caching (1hr TTL) to prevent 96 D1 scans/day, configurable coverage threshold via `PlatformSettings.gapCoverageThresholdPct`, 7-day time filters on CTEs, and `do:platform-notifications` exclusion
- **budget-enforcement.ts**: `date('now', 'start of month')` replaced with pre-calculated `monthStart` bind param — enables index usage on `(project, snapshot_date)`
- **error-collector.ts**: Extracted `handleNewOrRecurringError()` shared function — eliminates ~480 lines of duplicated issue creation logic between `processSoftErrorLog` and `processEvent`
- **anomaly-detection.ts**: `MONITORED_PROJECTS` changed from LBA-specific `['all', 'platform']` to generic `['all']` with TODO for customisation
- **budget-enforcement.ts**: `MONTHLY_PROJECTS` changed from LBA-specific `['all', 'platform']` to generic `['all']` with TODO for customisation
- **pattern-discovery/storage.ts**: Added `LIMIT 500` safety net on `refreshDynamicPatternsCache` approved patterns query
- **sync-config.ts**: Updated type interfaces to match live platform — added 12 missing `BudgetLimit` fields, `CircuitBreakerConfig`, `FeatureOverride`, `GlobalLimits` interfaces, fixed `Project.tier` type (`string` → `number`), added `sources`, `primary_resource`, `runbook`, `infrastructure` fields

### Added
- **Barrel export**: `templates/full/workers/lib/pattern-discovery/index.ts` — re-exports all pattern-discovery modules for clean imports
- **Template validation test**: `tests/template-content.test.ts` — validates seed.sql INSERT columns match CREATE TABLE schema, catches column drift at CI time
- **KV key patterns documentation**: `docs/kv-key-patterns.md` — comprehensive reference for all ~43 KV key prefixes grouped by subsystem (circuit breaker, budget, settings, error collection, sentinel, pattern discovery, notifications, alert dedup)

## [1.3.0] - 2026-03-02

### Fixed
- **CRITICAL**: `seed.sql.hbs` referenced non-existent `tier` and `repository` columns in `project_registry` — every fresh install failed on `wrangler d1 migrations apply`. Fixed to use `repo_path` column matching `001_core_tables.sql` schema
- **CRITICAL**: `daily_usage_rollups` missing `vectorize_inserts` column — monthly budget queries (`SUM(vectorize_inserts)`) in `budget-enforcement.ts` would fail with SQL error at runtime
- **CRITICAL**: `platform-settings.ts` missing defensive floor on `d1WriteLimit` and `doGbSecondsDailyLimit` — stale/poisoned KV cache could disable circuit breakers (same root cause as January 2026 billing incident)
- **CRITICAL**: `budget-enforcement.ts` missing `Math.max(d1WriteLimit, 1000)` guard — defence-in-depth complement to platform-settings floor
- **PERF**: `rollups.ts` used `DATE(snapshot_hour) = ?` bypassing index — replaced with range queries (`snapshot_hour >= ? AND snapshot_hour < ?`) to enable index usage and prevent runaway D1 reads at scale
- **PERF**: `anomaly-detection.ts` used `datetime('now', ...)` in SQL preventing index usage — pre-calculate JS Date objects as bind params
- **PERF**: `platform-sentinel.ts` used `DATE(snapshot_hour) >= ?` in 2 queries — replaced with `snapshot_hour >= ?` with ISO timestamp bind params

### Added
- `gapCoverageThresholdPct` field on `PlatformSettings` interface (configurable gap detection threshold, default 90%)
- `gap_coverage_threshold_pct` key in `SETTING_KEY_MAP` and `EXPECTED_SETTINGS_KEYS`
- `vectorize_inserts INTEGER DEFAULT 0` column in `daily_usage_rollups` (migration `002_usage_warehouse.sql`)

## [1.2.0] - 2026-02-25

### Fixed
- **services.yaml template**: Only registered `usage` worker — missing all standard/full tier workers (error-collector, sentinel, pattern-discovery, alert-router, notifications, search, settings). New projects had incomplete service registries, breaking budget enforcement and topology discovery.
- **wrangler.usage.jsonc.hbs**: Comment incorrectly said "standard tier" when referring to `NOTIFICATIONS_API` (which is full tier)
- **wrangler.sentinel.jsonc.hbs**: Commented `"services"` block would create duplicate JSON key — changed to instruction to merge into existing array

### Added
- **Tier-conditional service registry**: `services.yaml` template now registers workers and features appropriate to the selected tier (minimal/standard/full)
- `isStandard` and `isFull` Handlebars context flags for tier-conditional template sections
- Feature definitions for error-collection (tail-processing, daily-digest, gap-alerts), monitoring (sentinel), pattern-discovery (ai-discovery, shadow-evaluation), notifications, search, and settings

## [1.1.1] - 2026-02-24

### Fixed
- **CRITICAL**: `wrangler.alert-router.jsonc.hbs` missing `SERVICE_REGISTRY` KV, `PLATFORM_TELEMETRY` queue, `NOTIFICATIONS_API` service binding, and `GITHUB_TOKEN` secret — would cause runtime errors
- `wrangler.pattern-discovery.jsonc.hbs` missing `NOTIFICATIONS_API` service binding — dashboard notifications silently failed
- `wrangler.error-collector.jsonc.hbs` Gatus var names mismatched Env interface (`GATUS_HEARTBEAT_URL` vs `GATUS_HEARTBEAT_URL_15M` / `GATUS_HEARTBEAT_URL_DIGEST`)
- Added `GATUS_TOKEN` secret comment to error-collector wrangler template
- Added commented `NOTIFICATIONS_API` service binding hints to error-collector and sentinel wrangler templates (for full-tier users)

## [1.1.0] - 2026-02-23

### Added
- **`upgrade` command**: Incremental upgrades with content-hash comparison — creates new files, updates unmodified files, skips user-modified files
- **`adopt` command**: Retroactively add upgrade support to pre-v1.1.0 projects
- **Scaffold manifest** (`.platform-scaffold.json`): Tracks SDK version, tier, context, file hashes, and migration numbers
- **Migration renumbering**: New SDK migrations auto-renumber after user-created migrations to avoid conflicts
- **Tier upgrades**: `upgrade --tier standard` adds standard-tier files to a minimal project
- **Dry-run mode**: `upgrade --dry-run` previews changes without writing
- `src/manifest.ts` — Manifest read/write/build with SHA-256 content hashing
- `src/migrations.ts` — Migration numbering utilities (findHighest, renumber, plan)
- `src/upgrade.ts` — Upgrade orchestrator with three-way file comparison
- `src/adopt.ts` — Baseline manifest generator for existing projects
- 38 new tests (59 total): manifest (7), migrations (16), upgrade (9), adopt (6)

### Changed
- CLI restructured to Commander subcommands (`scaffold`, `upgrade`, `adopt`)
- Backward compatible: bare `platform-admin-sdk my-project` still scaffolds
- `scaffold` now writes `.platform-scaffold.json` alongside generated files
- SDK_VERSION constant is single source of truth (in `templates.ts`)
- Scaffold detects existing manifests and suggests `upgrade` instead of failing

## [1.0.0] - 2026-02-23

### Changed
- **BREAKING**: Package renamed from `@littlebearapps/create-platform` to `@littlebearapps/platform-admin-sdk`
- **BREAKING**: Binary renamed from `create-platform` to `platform-admin-sdk`
- All template references updated to use `@littlebearapps/platform-consumer-sdk`
- Repository renamed from `platform-sdk` to `platform-sdks`
- Directory renamed from `packages/create-platform` to `packages/admin-sdk`

### Added
- **CLI flags**: Non-interactive scaffolding via `--tier`, `--github-org`, `--gatus-url`, `--default-assignee`, `--skip-prompts`
- Commander-based flag parsing (replaces raw `process.argv`)
- 14 CLI flag tests (21 total)

### Migration
```bash
# Old:
npx @littlebearapps/create-platform my-project
# New:
npx @littlebearapps/platform-admin-sdk my-project
```

## [0.1.0] - 2026-02-23

### Added
- **Rebranding**: Display name updated to "Platform Admin SDK"
- **Worker extraction**: 62 worker `.ts` files extracted into scaffolder templates
- **Three-tier architecture**:
  - Minimal (97 files): platform-usage worker + 8 root libs + 3 cross-boundary shims + usage framework
  - Standard (+14 files): error-collector + sentinel + error-collector libs + slack-alerts
  - Full (+18 files): pattern-discovery + alert-router + notifications + search + settings + pattern-discovery libs
- Templates manifest (`templates.ts`) with all entries
- 8 unit tests including worker file counts per tier and template file existence validation
- Interactive CLI with project name, slug, GitHub org, tier selection, Gatus URL, assignee prompts
- Handlebars templating for wrangler configs and YAML files
- D1 migrations (5 shared + 1 standard + 2 full = 8 total)
- Post-scaffold steps documentation

## [0.1.0] - 2026-02-20

### Added
- Initial scaffolder with basic template generation
- Minimal tier only
- CLI prompts for project configuration
