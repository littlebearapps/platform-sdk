# Platform SDK

**Automatic cost protection, circuit breaking, and error collection for Cloudflare Workers.**

[![npm version](https://img.shields.io/npm/v/@littlebearapps/platform-sdk)](https://www.npmjs.com/package/@littlebearapps/platform-sdk)
[![CI](https://github.com/littlebearapps/platform-sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/littlebearapps/platform-sdk/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## Why This Exists

In January 2026, a buggy deployment caused **$4,868 in unexpected Cloudflare charges** in 4 days. An infinite D1 write loop wrote 4.8 billion rows before anyone noticed.

We built this toolkit so it never happens again — and we're giving it away for free so it doesn't happen to you either.

**What it does:**
- **Circuit breakers** that automatically stop runaway workers before they drain your wallet
- **Feature-level budgets** with configurable daily limits per binding (D1, KV, R2, Queues)
- **Error collection** that creates GitHub issues from worker errors with AI-powered classification
- **Gap detection** that alerts you when your monitoring stops receiving data
- **Pattern discovery** that learns your error patterns and classifies them automatically

## Two Packages

### 1. Consumer SDK (`@littlebearapps/platform-sdk`)

Lightweight library you install in each Cloudflare Worker project. Zero infrastructure dependencies.

```bash
npm install @littlebearapps/platform-sdk
```

```typescript
import { withFeatureBudget, CircuitBreakerError } from '@littlebearapps/platform-sdk';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    try {
      const tracked = withFeatureBudget(env, 'myapp:api:main', { ctx });
      const result = await tracked.DB.prepare('SELECT * FROM users LIMIT 100').all();
      return Response.json(result);
    } catch (e) {
      if (e instanceof CircuitBreakerError) {
        return Response.json({ error: 'Feature temporarily disabled' }, { status: 503 });
      }
      throw e;
    }
  }
};
```

### 2. Admin Scaffolder (`@littlebearapps/create-platform`)

CLI tool that generates the backend infrastructure — workers, D1 migrations, config files. Run once, then you own the code.

```bash
npx @littlebearapps/create-platform my-platform
```

Three tiers:

| Tier | Workers | What You Get | Cost |
|------|---------|-------------|------|
| **Minimal** | 1 | Budget enforcement, circuit breakers, telemetry | ~$0/mo |
| **Standard** | 3 | + Error collection (GitHub issues), gap detection | ~$0/mo |
| **Full** | 8 | + AI pattern discovery, notifications, search, alerts | ~$5/mo |

## SDK Exports

### Main (`@littlebearapps/platform-sdk`)

| Export | Description |
|--------|------------|
| `withFeatureBudget()` | Wrap `fetch` handlers — proxies bindings with automatic tracking |
| `withCronBudget()` | Wrap `scheduled` handlers |
| `withQueueBudget()` | Wrap `queue` handlers |
| `CircuitBreakerError` | Thrown when a feature's budget is exhausted |
| `completeTracking()` | Flush pending metrics (call in `finally` or `ctx.waitUntil`) |
| `pingHeartbeat()` | Gatus/Uptime heartbeat integration |
| `withRetry()` | Retry with exponential backoff |

### Sub-path Exports (v0.2.0+)

| Export | Description |
|--------|------------|
| `@littlebearapps/platform-sdk/middleware` | Project-level circuit breaker middleware (Hono-compatible) |
| `@littlebearapps/platform-sdk/patterns` | 56 static transient error patterns for Cloudflare Workers |
| `@littlebearapps/platform-sdk/dynamic-patterns` | Runtime pattern loading from KV with ReDoS-safe DSL |

## Required Cloudflare Bindings

Add these to your `wrangler.jsonc`:

```jsonc
{
  "kv_namespaces": [
    { "binding": "PLATFORM_CACHE", "id": "YOUR_KV_NAMESPACE_ID" }
  ],
  "queues": {
    "producers": [
      { "binding": "TELEMETRY_QUEUE", "queue": "your-telemetry-queue" }
    ]
  }
}
```

## Consumer CI Workflow

Validate your SDK integration automatically in GitHub Actions:

```yaml
# .github/workflows/sdk-check.yml
jobs:
  sdk-check:
    uses: littlebearapps/platform-sdk/.github/workflows/consumer-check.yml@main
    with:
      project-name: my-project
```

Checks: SDK installation, wrangler config, budget wrapper usage, cost safety patterns, middleware migration.

## Configuration

The Platform uses config-driven infrastructure with two YAML files as the source of truth:

- **`services.yaml`** — Project registry, feature definitions, infrastructure mapping
- **`budgets.yaml`** — Daily limits, circuit breaker thresholds, cost tiers

Changes are synced to D1/KV via `npm run sync:config`.

## Architecture

```
Consumer Projects (your workers)
    |
    | SDK telemetry (via Queue)
    v
Platform Usage Worker (cron + queue consumer)
    |
    v
D1 Warehouse ─── KV Cache ─── Analytics Engine
    |
    ├── Error Collector (tail worker → GitHub issues)
    ├── Sentinel (gap detection → alerts)
    └── Pattern Discovery (AI → error classification)
```

## Documentation

- [Integration Checklist](https://docs.littlebearapps.com/platform-guides/sdk-integration-checklist/) — Full SDK setup guide
- [Claude Code Plugin](https://github.com/littlebearapps/platform-sdk-plugin) — Automated SDK enforcement

## License

MIT — Built by [Little Bear Apps](https://littlebearapps.com). Free to use, modify, and distribute.
