# AGENTS.md — Platform SDKs

> Automatic cost protection, circuit breaking, and observability for Cloudflare Workers.

## Project Overview

Platform SDKs protect Cloudflare Workers from bill shock. A single bug — infinite loop, retry storm, misconfigured cron — can rack up thousands in charges. Cloudflare offers no built-in spending limits or circuit breakers. These SDKs fill that gap.

**Monorepo** with two published packages:
- **Consumer SDK** (`@littlebearapps/platform-consumer-sdk`) — Zero-dependency TypeScript library. Install in each Worker for automatic metric collection, circuit breaking, and budget enforcement.
- **Admin SDK** (`@littlebearapps/platform-admin-sdk`) — CLI scaffolder. Generates backend infrastructure (1-8 workers depending on tier) for telemetry processing, error collection, and pattern discovery.

## Tech Stack

- **Language**: TypeScript (strict mode)
- **Runtime**: Cloudflare Workers
- **Testing**: Vitest
- **Build**: tsc (admin-sdk), raw source shipped (consumer-sdk — wrangler bundles at deploy time)
- **Package Manager**: npm workspaces
- **CI**: GitHub Actions

## Repository Structure

```
packages/
├── consumer-sdk/     # Runtime library (zero dependencies)
│   └── src/          # Raw TypeScript source files
├── admin-sdk/        # CLI scaffolder
│   ├── src/          # CLI source
│   └── templates/    # Handlebars templates for scaffolding
docs/
├── consumer-sdk/     # Consumer SDK reference (8 docs)
├── admin-sdk/        # Admin SDK reference (4 docs)
└── guides/           # How-to guides (7 guides)
.github/workflows/    # CI, version bumps, consumer-check reusable workflow
```

## Key Commands

```bash
npm test                    # Run all tests (both packages)
npm run typecheck           # TypeScript check (both packages)
npm run build               # Build (admin-sdk only — consumer ships raw .ts)
```

Per-package:
```bash
cd packages/consumer-sdk && npm test           # Consumer SDK tests
cd packages/admin-sdk && npm test              # Admin SDK tests
npx @littlebearapps/platform-admin-sdk my-app  # Scaffold new backend
```

## Core Concepts

### Consumer SDK — How It Works

1. Wrap your Worker handler with `withFeatureBudget(env, 'project:category:feature', { ctx })`
2. All Cloudflare binding calls (D1, KV, R2, AI, Vectorize, Queue, DO, Workflow) are automatically proxied and tracked
3. Circuit breakers check KV state on each request — if budget is exhausted, `CircuitBreakerError` is thrown
4. Metrics are flushed to a telemetry queue via `completeTracking()` in a `finally` block
5. The backend (Admin SDK) processes the queue, enforces budgets, and creates alerts

### Admin SDK — Three Tiers

| Tier | Workers | Key Features |
|------|---------|-------------|
| Minimal | 1 | Budget enforcement, circuit breakers, usage telemetry |
| Standard | 3 | + Error collection (auto GitHub issues), gap detection |
| Full | 8 | + AI pattern discovery, notifications, search, alerts |

### Feature IDs

Format: `project:category:feature` (kebab-case, colon-separated)
Examples: `myapp:api:main`, `myapp:cron:daily-sync`, `payments:webhook:stripe`

### Circuit Breaker Hierarchy

Global kill switch (`GLOBAL_STOP_ALL`) > Project level (`PROJECT:{SLUG}:STATUS`) > Feature level (`CONFIG:FEATURE:{id}:STATUS`)

## Key Files

| File | Purpose |
|------|---------|
| `packages/consumer-sdk/src/index.ts` | Main exports (withFeatureBudget, completeTracking, health, logging, tracing) |
| `packages/consumer-sdk/src/middleware.ts` | Hono-compatible circuit breaker middleware |
| `packages/consumer-sdk/src/patterns.ts` | 125+ static transient error patterns |
| `packages/consumer-sdk/src/dynamic-patterns.ts` | AI-discovered patterns from KV |
| `packages/consumer-sdk/src/costs.ts` | Cloudflare pricing tiers and cost calculation |
| `packages/admin-sdk/src/index.ts` | CLI entry point (scaffold, upgrade, adopt) |
| `packages/admin-sdk/templates/` | Handlebars templates for worker scaffolding |

## Coding Conventions

- TypeScript strict mode, no `any`
- Australian English in prose (licence, realise, colour)
- Conventional commits: `feat:`, `fix:`, `docs:`, `chore:`
- Import order: external packages, types, internal (@/), relative (./)

## Companion Plugin

The [Platform SDK Plugin](https://github.com/littlebearapps/platform-sdk-plugin) is an optional Claude Code plugin that enforces SDK conventions via rules, skills, agents, and hooks. Not required to use the SDKs.
