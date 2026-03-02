<p align="center">
  <strong>Platform SDKs</strong><br/>
  <sub>Automatic cost protection, circuit breaking, and error collection for Cloudflare Workers.</sub>
</p>

<p align="center">
  Cloudflare doesn't offer usage limits or billing protection for Workers.<br/>
  A single bug can rack up thousands in charges before you notice.<br/>
  <strong>Platform SDKs fill that gap.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@littlebearapps/platform-consumer-sdk"><img src="https://img.shields.io/npm/v/@littlebearapps/platform-consumer-sdk?label=consumer-sdk" alt="Consumer SDK"></a>
  <a href="https://www.npmjs.com/package/@littlebearapps/platform-admin-sdk"><img src="https://img.shields.io/npm/v/@littlebearapps/platform-admin-sdk?label=admin-sdk" alt="Admin SDK"></a>
  <a href="https://github.com/littlebearapps/platform-sdks/actions/workflows/ci.yml"><img src="https://github.com/littlebearapps/platform-sdks/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/Licence-MIT-blue.svg" alt="Licence: MIT"></a>
</p>

<p align="center">
  <a href="#-quick-start">Quick Start</a> · <a href="#-features">Features</a> · <a href="#-packages">Packages</a> · <a href="#-multi-account-support">Multi-Account</a> · <a href="#-claude-code-plugin">Plugin</a> · <a href="#-documentation">Docs</a> · <a href="#-contributing">Contributing</a>
</p>

---

## ⚡ Quick Start

**1. Install the Consumer SDK:**

```bash
npm install @littlebearapps/platform-consumer-sdk
```

**2. Add two bindings** to your `wrangler.jsonc`:

```jsonc
{
  "kv_namespaces": [{ "binding": "PLATFORM_CACHE", "id": "YOUR_KV_NAMESPACE_ID" }],
  "queues": { "producers": [{ "binding": "TELEMETRY_QUEUE", "queue": "your-telemetry-queue" }] }
}
```

**3. Wrap your handler** (one import, three lines changed):

```typescript
import { withFeatureBudget, completeTracking, CircuitBreakerError } from '@littlebearapps/platform-consumer-sdk';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const tracked = withFeatureBudget(env, 'myapp:api:main', { ctx });
    try {
      // All binding access is now automatically tracked
      const result = await tracked.DB.prepare('SELECT * FROM users LIMIT 100').all();
      return Response.json(result);
    } catch (e) {
      if (e instanceof CircuitBreakerError) {
        return Response.json({ error: 'Feature temporarily disabled' }, { status: 503 });
      }
      throw e;
    } finally {
      ctx.waitUntil(completeTracking(tracked));
    }
  }
};
```

That's it. Every D1, KV, R2, AI, Vectorize, Queue, Durable Object, and Workflow call is now tracked, budgeted, and protected by circuit breakers.

> **tsconfig requirement**: Set `"moduleResolution": "bundler"` in your `tsconfig.json`. The SDK ships raw `.ts` source files that wrangler bundles at deploy time.

---

## 🛡️ Born from Bill Shock

In January 2026, a buggy deployment caused **$4,868 in unexpected Cloudflare charges** in 4 days. An infinite D1 write loop wrote 4.8 billion rows before anyone noticed.

Cloudflare has no built-in spending limits, budget alerts, or circuit breakers for Workers. If your code goes wrong — whether it's an infinite loop, a retry storm, or a misconfigured cron — you find out when the invoice arrives.

**We built Platform SDKs so it never happens again.** And we're giving them away for free so it doesn't happen to you either.

| Scenario | Without SDK | With Platform SDK |
|----------|-------------|-------------------|
| Bug causes infinite D1 writes | $4,868 bill after 4 days | Circuit breaker trips after budget limit. $0 extra. |
| Cron job retries in a tight loop | Thousands of queue messages per minute | Budget enforcement stops the feature automatically |
| AI calls spike unexpectedly | Uncapped model costs accumulate | Per-feature budget with 70%/90% warnings before hard stop |
| Worker calls itself recursively | Stack of billable subrequests | `X-Recursion-Depth` header guard prevents loops |
| Deploy breaks on Friday night | Errors pile up until Monday | Automatic GitHub issues from error-collector (Standard tier) |
| Need to kill everything NOW | Log into Cloudflare dashboard, find the worker... | `setGlobalStop(kv, true)` — one KV write stops all features |

---

## 🎯 Features

### Cost Protection
- **Three-tier circuit breakers** — Global kill switch > project-level > feature-level. Any level can stop expensive operations instantly.
- **Automatic budget enforcement** — Daily and monthly limits with progressive warnings at 70%, 90%, and hard stop at 100%.
- **Per-invocation request limits** — Cap D1 writes, KV operations, or AI calls per single request.
- **Anomaly detection** — Flags unusual resource spikes without blocking (configurable thresholds).
- **D1 storage guard** — Monitors database size via PRAGMA to catch unbounded growth.
- **Cost estimation** — Real-time USD cost calculation from metrics using current Cloudflare pricing.

### Observability
- **Automatic telemetry** — Every binding call (D1, KV, R2, AI, Vectorize, Queue, DO, Workflow) tracked without code changes.
- **W3C distributed tracing** — Full `traceparent` propagation across service bindings.
- **Structured logging** — JSON logs with correlation IDs that follow requests across workers.
- **Transient error classification** — 125 built-in patterns + AI-discovered dynamic patterns for operational noise reduction.
- **Heartbeat monitoring** — Gatus integration for cron health verification.

### Developer Experience
- **Zero production dependencies** — Raw TypeScript source, bundled by wrangler. Nothing extra in your worker.
- **One-line integration** — Wrap your handler with `withFeatureBudget()`, done.
- **Hono middleware** — Project-level circuit breakers as middleware for Hono apps.
- **Service client** — Cross-worker correlation chain propagation with automatic trace context.
- **AI Gateway integration** — Automatic model and provider tracking for AI Gateway URLs.
- **Exponential backoff** — Built-in retry helper with configurable attempts and backoff.

---

## 📦 Packages

### Consumer SDK

**[`@littlebearapps/platform-consumer-sdk`](https://www.npmjs.com/package/@littlebearapps/platform-consumer-sdk)** — Lightweight library you install in each Cloudflare Worker project. Zero production dependencies. Ships raw TypeScript.

```bash
npm install @littlebearapps/platform-consumer-sdk
```

**What it tracks automatically:**

| Binding | Metrics |
|---------|---------|
| D1 | Reads, writes, rows read, rows written |
| KV | Reads, writes, deletes, lists |
| R2 | Class A ops (put/delete/list), Class B ops (get/head) |
| Workers AI | Requests, per-model breakdown |
| Vectorize | Queries, inserts |
| Queues | Messages sent |
| Durable Objects | Requests, latency percentiles (avg/max/p99) |
| Workflows | Invocations |

**Key exports:**

| Export | Purpose |
|--------|---------|
| `withFeatureBudget()` | Wrap fetch handlers with tracking + circuit breakers |
| `withCronBudget()` | Wrap scheduled handlers |
| `withQueueBudget()` | Wrap queue handlers |
| `completeTracking()` | Flush metrics (call in `finally` / `waitUntil`) |
| `CircuitBreakerError` | Catch when a feature is disabled |
| `health()` | Dual-plane health check (KV + queue) |

**Sub-path imports:** [`/middleware`](packages/consumer-sdk/README.md#littlebearappsplatform-consumer-sdkmiddleware) · [`/patterns`](packages/consumer-sdk/README.md#littlebearappsplatform-consumer-sdkpatterns) · [`/dynamic-patterns`](packages/consumer-sdk/README.md#littlebearappsplatform-consumer-sdkdynamic-patterns) · [`/costs`](packages/consumer-sdk/README.md#littlebearappsplatform-consumer-sdkcosts) · [`/heartbeat`](packages/consumer-sdk/README.md#littlebearappsplatform-consumer-sdkheartbeat) · [`/retry`](packages/consumer-sdk/README.md#littlebearappsplatform-consumer-sdkretry)

[Full Consumer SDK reference →](packages/consumer-sdk/README.md)

---

### Admin SDK

**[`@littlebearapps/platform-admin-sdk`](https://www.npmjs.com/package/@littlebearapps/platform-admin-sdk)** — CLI scaffolder that generates your backend infrastructure. Run once, then you own the code.

```bash
npx @littlebearapps/platform-admin-sdk my-platform
```

| Tier | Workers | What You Get | Est. Cost |
|------|---------|-------------|-----------|
| **Minimal** | 1 | Budget enforcement, circuit breakers, usage telemetry | ~$0/mo |
| **Standard** | 3 | + Error collection (auto GitHub issues), gap detection | ~$0/mo |
| **Full** | 8 | + AI pattern discovery, notifications, search, alerts | ~$5/mo |

[Full Admin SDK reference →](packages/admin-sdk/README.md)

---

### How They Fit Together

The **Consumer SDK** (library) sends telemetry to the **Admin SDK** (backend). Install the Consumer SDK in each application worker. The Admin SDK scaffolds the backend that processes that telemetry, enforces budgets, and creates GitHub issues from errors.

```mermaid
graph TD
    subgraph Your Workers
        W1[Worker A<br/>Consumer SDK]
        W2[Worker B<br/>Consumer SDK]
        W3[Worker C<br/>Consumer SDK]
    end

    subgraph Platform Backend — Admin SDK scaffolded
        Usage[platform-usage<br/>Queue consumer + cron]
        EC[error-collector<br/>Tail worker]
        Sentinel[platform-sentinel<br/>Gap detection]
    end

    subgraph Storage
        D1[(D1 Warehouse)]
        KV[KV Cache<br/>Circuit breakers]
        AE[(Analytics Engine)]
    end

    W1 -->|TELEMETRY_QUEUE| Usage
    W2 -->|TELEMETRY_QUEUE| Usage
    W3 -->|TELEMETRY_QUEUE| Usage
    W1 -.->|tail events| EC
    W2 -.->|tail events| EC
    W3 -.->|tail events| EC

    Usage --> D1
    Usage --> AE
    EC -->|GitHub issues| D1
    Sentinel -->|gap alerts| D1

    KV -->|circuit breaker state| W1
    KV -->|circuit breaker state| W2
    KV -->|circuit breaker state| W3
```

---

## 🌐 Multi-Account Support

Platform SDKs work across single or multiple Cloudflare accounts. If you manage workers spread across different accounts, you can protect all of them.

**Consumer SDK**: Works in any Cloudflare account. Each account needs its own KV namespace and telemetry queue — the SDK code is identical.

**Admin SDK**: Accepts `accountId` and `apiToken` per API call, so you can monitor usage and trigger kill switches across accounts from a single control plane.

**Architecture options:**

| Pattern | How It Works | Best For |
|---------|-------------|----------|
| **Centralised** | One account hosts the Platform backend. Other accounts send telemetry to it. | Most setups — simple to manage |
| **Federated** | Each account runs its own Platform backend independently. | Compliance isolation, separate billing |
| **Hybrid** | Shared error collection + budget enforcement, per-account telemetry storage. | Large multi-account portfolios |

[Multi-account setup guide →](docs/guides/multi-account.md)

---

## 🤖 Claude Code Plugin

> **Note:** The [Platform SDK Plugin](https://github.com/littlebearapps/platform-sdk-plugin) is a **companion Claude Code plugin** designed specifically for use with the Platform Consumer and Admin SDKs. It enforces SDK conventions automatically as you write code.
>
> The plugin is **not required** to use the SDKs — it's an optional productivity tool for [Claude Code](https://claude.ai/claude-code) users.

**What it does:**

| Component | What It Enforces |
|-----------|-----------------|
| **3 rules** (always loaded) | SDK usage patterns, cost safety (D1 batch inserts, `ON CONFLICT`, `LIMIT`), wrangler bindings |
| **8 skills** (on-demand) | Deep reference for integration, circuit breakers, observability, heartbeats, error collection, cost traps, wrangler config, Platform APIs |
| **4 agents** (autonomous) | SDK integration wizard, audit scorer (100/100 rubric), runtime debugger, cost reviewer |
| **4 hooks** (automatic) | Session startup check, pre-deploy validation, post-write SDK compliance, wrangler config validation |

**Install:**

```
/plugin marketplace add littlebearapps/lba-plugins
/plugin install platform-sdk@lba-plugins
```

**Commands:**

| Command | What It Does |
|---------|-------------|
| `/platform-integrate` | Guided SDK integration wizard |
| `/platform-audit` | Score your project against 100/100 rubric |
| `/platform-health` | Check circuit breaker states and heartbeats |
| `/platform-costs` | Review code changes for billing impact |

[Plugin repository →](https://github.com/littlebearapps/platform-sdk-plugin)

---

## ✅ CI Integration

Validate your SDK integration automatically in GitHub Actions:

```yaml
# .github/workflows/sdk-check.yml
name: SDK Check
on: [push, pull_request]
jobs:
  sdk-check:
    uses: littlebearapps/platform-sdks/.github/workflows/consumer-check.yml@main
    with:
      project-name: my-project
```

| Check | What It Verifies |
|-------|-----------------|
| SDK Installation | `@littlebearapps/platform-consumer-sdk` is installed |
| Wrangler Config | `PLATFORM_CACHE` KV, `platform-telemetry` queue, `observability.enabled`, `tail_consumers` |
| Budget Wrappers | `withFeatureBudget` / `withCronBudget` / `withQueueBudget` calls exist |
| Feature IDs | IDs match `{project-name}:*:*` format |
| Cost Safety | No `.run()` inside loops, `INSERT` has `ON CONFLICT`, `SELECT` has `LIMIT` |
| Middleware | Circuit breaker middleware uses SDK import (not a local copy) |

[CI workflow reference →](docs/admin-sdk/ci-workflow.md)

---

## 📚 Documentation

### Getting Started

| I want to... | Start here |
|--------------|-----------|
| Set up everything from scratch | [Your First Protected Worker](docs/guides/first-worker.md) (~20 min) |
| Scaffold the admin backend (command centre) | [Admin SDK Quickstart](docs/admin-sdk/quickstart.md) (~15 min) |
| Add the consumer SDK to an existing worker | [Consumer SDK Getting Started](docs/consumer-sdk/getting-started.md) (~10 min) |
| Migrate from the old package name | [Migrating from v0](docs/guides/migrating-from-v0.md) (~5 min) |

### How-To Guides

- [Multi-Account Setup](docs/guides/multi-account.md) — Using SDKs across multiple Cloudflare accounts
- [Managing Budgets and Circuit Breakers](docs/guides/managing-budgets.md) — Day-to-day operations
- [Setting Up Error Collection](docs/guides/error-collection-setup.md) — Automatic GitHub issues from worker errors

### Reference

**Consumer SDK:** [Concepts](docs/consumer-sdk/concepts.md) · [Circuit Breakers](docs/consumer-sdk/circuit-breakers.md) · [Feature IDs](docs/consumer-sdk/feature-ids.md) · [Middleware](docs/consumer-sdk/middleware.md) · [Telemetry](docs/consumer-sdk/telemetry.md) · [Patterns](docs/consumer-sdk/patterns.md) · [Advanced](docs/consumer-sdk/advanced.md) · [Troubleshooting](docs/consumer-sdk/troubleshooting.md)

**Admin SDK:** [Quickstart](docs/admin-sdk/quickstart.md) · [Tiers](docs/admin-sdk/tiers.md) · [Upgrade Guide](docs/admin-sdk/upgrade-guide.md) · [CI Workflow](docs/admin-sdk/ci-workflow.md)

### Explanation

- [Architecture Concepts](docs/consumer-sdk/concepts.md) — How the proxy system works
- [Error Pattern System](docs/consumer-sdk/patterns.md) — Static and dynamic transient error classification

---

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, code style, and how to submit changes.

> **Using Claude Code?** Install the [Platform SDK Plugin](https://github.com/littlebearapps/platform-sdk-plugin) for real-time SDK convention validation while you develop.

---

## 📄 Licence

MIT — Made with ❤️ by [Little Bear Apps](https://littlebearapps.com) 🐶
