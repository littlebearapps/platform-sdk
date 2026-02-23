# Changelog

## [1.0.0] - 2026-02-23

### Added
- **Rebranding**: Display name updated to "Platform Admin SDK" (npm package name unchanged)
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
