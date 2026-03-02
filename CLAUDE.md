# CLAUDE.md — Platform SDKs

## What This Is

Monorepo for two npm packages that protect Cloudflare Workers from bill shock:
- **Consumer SDK** (`packages/consumer-sdk/`) — Runtime library, zero dependencies, ships raw TypeScript
- **Admin SDK** (`packages/admin-sdk/`) — CLI scaffolder, generates backend infrastructure

## Key Commands

```bash
npm test                    # All tests
npm run typecheck           # TypeScript check
npm run build               # Build admin-sdk

# Per-package
cd packages/consumer-sdk && npm test
cd packages/admin-sdk && npm test
```

## Architecture

Consumer SDK wraps Cloudflare bindings (D1, KV, R2, AI, Vectorize, Queue, DO, Workflow) via Proxy objects. Each binding call is intercepted, tracked, and checked against circuit breaker state in KV. Metrics flush to a queue processed by the Admin SDK backend.

Three-tier circuit breakers: Global > Project > Feature. Feature IDs follow `project:category:feature` format.

## Conventions

- TypeScript strict, no `any`
- Australian English (licence, realise)
- Conventional commits
- Vitest for testing
- Consumer SDK ships `.ts` source (wrangler bundles)
- Admin SDK uses Handlebars templates in `templates/`

## Docs Structure

```
docs/consumer-sdk/  — 8 reference docs (concepts, circuit-breakers, feature-ids, middleware, telemetry, patterns, advanced, troubleshooting)
docs/admin-sdk/     — 4 reference docs (quickstart, tiers, upgrade-guide, ci-workflow)
docs/guides/        — 7 how-to guides (first-worker, health-monitoring, observability, managing-budgets, error-collection, multi-account, migrating-from-v0)
```
