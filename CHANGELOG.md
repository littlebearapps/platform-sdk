# Changelog

All notable changes to this project are documented in this file.

This is the **monorepo changelog** covering both packages. For per-package details, see:
- [`packages/consumer-sdk/CHANGELOG.md`](packages/consumer-sdk/CHANGELOG.md)
- [`packages/admin-sdk/CHANGELOG.md`](packages/admin-sdk/CHANGELOG.md)

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Version numbers track the Consumer SDK (the primary runtime package).

---

## [1.1.1] - 2026-02-25

### Fixed
- **Consumer SDK**: Fix flaky `timed()` test on CI runners

### Changed
- **Admin SDK**: v1.2.0 — complete service registry generation for all scaffold tiers

### Documentation
- Comprehensive documentation overhaul for both SDKs (PR #1)

## [1.1.0] - 2026-02-25

### Added
- **Admin SDK**: Complete service registry for all tiers (minimal, standard, full)

## [1.0.3] - 2026-02-24

### Fixed
- **Admin SDK**: Add missing wrangler bindings found by completeness audit
- **Admin SDK**: Compute `highestScaffoldMigration` from SDK templates instead of hardcoding
- **Consumer SDK**: Bind Durable Object proxy methods to preserve `this` context

### Documentation
- Expand Admin SDK post-scaffold steps with tier-specific resources and secrets

## [1.0.0] - 2026-02-23

### Breaking Changes
- **Renamed packages** — npm package names changed:
  - `@littlebearapps/platform-sdk` to `@littlebearapps/platform-consumer-sdk`
  - `@littlebearapps/create-platform` to `@littlebearapps/platform-admin-sdk`
- Directories renamed: `packages/sdk` to `packages/consumer-sdk`, `packages/create-platform` to `packages/admin-sdk`
- Both packages reset to v1.0.0

### Added
- **Admin SDK**: `upgrade` and `adopt` commands with content-hash manifest
- **Admin SDK**: CLI flags for non-interactive scaffolding
- READMEs for both packages
- Worker source templates extracted into Admin SDK

### Testing
- Added tests for costs, timeout, tracing, and service-client modules
- CI coverage threshold set to 85% line coverage (Consumer SDK)

## [0.4.0] - 2026-02-22

### Added
- Comprehensive READMEs and initial per-package changelogs
- Update guides, troubleshooting, and data safety documentation

## [0.3.0] - 2026-02-22

### Added
- Rebrand packages with new naming convention
- Extract worker source templates for scaffolding

## [0.2.0] - 2026-02-22

### Added
- Initial public release as standalone repository
- **Consumer SDK**: Runtime library wrapping Cloudflare bindings (D1, KV, R2, AI, Vectorize, Queue, DO, Workflow)
- **Consumer SDK**: Three-tier circuit breakers (Global > Project > Feature)
- **Consumer SDK**: Automatic usage tracking via Proxy objects
- **Admin SDK**: CLI scaffolder (`create-platform`) generating 1-8 workers across three tiers
- Plugin link and MIT licence

[1.1.1]: https://github.com/littlebearapps/platform-sdks/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/littlebearapps/platform-sdks/compare/v1.0.3...v1.1.0
[1.0.3]: https://github.com/littlebearapps/platform-sdks/compare/v1.0.0...v1.0.3
[1.0.0]: https://github.com/littlebearapps/platform-sdks/compare/v0.4.0...v1.0.0
[0.4.0]: https://github.com/littlebearapps/platform-sdks/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/littlebearapps/platform-sdks/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/littlebearapps/platform-sdks/releases/tag/v0.2.0
