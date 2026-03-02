# Getting Started with the Consumer SDK

Install the Consumer SDK into an existing Cloudflare Worker project to add automatic cost tracking, circuit breakers, and budget enforcement. This guide assumes you already have a Platform backend deployed (see [Admin SDK Quickstart](../admin-sdk/quickstart.md) if you haven't set that up yet).

> **Using Claude Code?** Install the [Platform SDK Plugin](https://github.com/littlebearapps/platform-sdk-plugin) and run `/platform-integrate` — it automates every step below.

## Prerequisites

- An existing Cloudflare Worker project
- A Platform backend deployed via the Admin SDK ([`@littlebearapps/platform-admin-sdk`](https://www.npmjs.com/package/@littlebearapps/platform-admin-sdk))
- The KV namespace ID and telemetry queue name from your Platform backend

## 1. Install the SDK

```bash
npm install @littlebearapps/platform-consumer-sdk
```

The SDK ships raw TypeScript source — wrangler bundles it at deploy time. **Zero production dependencies.**

**npm:** [`@littlebearapps/platform-consumer-sdk`](https://www.npmjs.com/package/@littlebearapps/platform-consumer-sdk)

## 2. Configure tsconfig

Ensure your `tsconfig.json` uses bundler module resolution:

```json
{
  "compilerOptions": {
    "moduleResolution": "bundler"
  }
}
```

This is the default for new wrangler projects. If you see TypeScript errors after installing, this is almost always the fix.

## 3. Add Wrangler Bindings

Add two bindings to your `wrangler.jsonc`:

```jsonc
{
  // ... your existing config ...

  "kv_namespaces": [
    // Your existing KV namespaces...
    { "binding": "PLATFORM_CACHE", "id": "YOUR_KV_NAMESPACE_ID" }
  ],
  "queues": {
    "producers": [
      // Your existing queue producers...
      { "binding": "TELEMETRY_QUEUE", "queue": "your-platform-telemetry" }
    ]
  },

  // Optional (Standard/Full tier): route errors to the error-collector
  "tail_consumers": [
    { "service": "your-platform-error-collector" }
  ],

  // Recommended: enable Cloudflare observability
  "observability": { "enabled": true }
}
```

**Where do I get these values?**

| Value | Where to Find |
|-------|---------------|
| KV namespace ID | `npx wrangler kv namespace list` — look for `PLATFORM_CACHE` |
| Queue name | `npx wrangler queues list` — look for your telemetry queue |
| Error collector service name | The `name` field in your error-collector's wrangler config |

## 4. Update Your Env Type

Add the Platform bindings to your TypeScript `Env` interface:

```typescript
import type { TelemetryMessage } from '@littlebearapps/platform-consumer-sdk';

interface Env {
  // Your existing bindings...
  DB: D1Database;
  MY_KV: KVNamespace;

  // Platform SDK bindings
  PLATFORM_CACHE: KVNamespace;
  TELEMETRY_QUEUE: Queue<TelemetryMessage>;
}
```

## 5. Wrap Your Handlers

### Fetch handler

```typescript
import { withFeatureBudget, completeTracking, CircuitBreakerError } from '@littlebearapps/platform-consumer-sdk';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const tracked = withFeatureBudget(env, 'myproject:api:main', { ctx });
    try {
      // Use tracked.DB, tracked.MY_KV, etc. instead of env.DB, env.MY_KV
      const result = await tracked.DB.prepare('SELECT * FROM items LIMIT 100').all();
      return Response.json(result.results);
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

### Cron handler

```typescript
import { withCronBudget, completeTracking } from '@littlebearapps/platform-consumer-sdk';

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    const tracked = withCronBudget(env, 'myproject:cron:daily-sync', {
      ctx,
      cronExpression: event.cron,
    });
    try {
      // Your cron logic using tracked.DB, tracked.MY_KV, etc.
    } finally {
      ctx.waitUntil(completeTracking(tracked));
    }
  }
};
```

### Queue handler

```typescript
import { withQueueBudget, completeTracking } from '@littlebearapps/platform-consumer-sdk';

export default {
  async queue(batch: MessageBatch, env: Env, ctx: ExecutionContext) {
    for (const msg of batch.messages) {
      const tracked = withQueueBudget(env, 'myproject:queue:processor', {
        message: msg.body,
        queueName: 'my-queue',
      });
      try {
        // Process using tracked.DB, tracked.MY_KV, etc.
        msg.ack();
      } finally {
        ctx.waitUntil(completeTracking(tracked));
      }
    }
  }
};
```

## 6. Choose Feature IDs

Feature IDs follow the format `project:category:feature` — three colon-separated kebab-case parts:

| Feature ID | When to Use |
|-----------|-------------|
| `myproject:api:main` | Primary API handler |
| `myproject:api:users` | User-specific API route (if budget differs) |
| `myproject:cron:daily-sync` | Daily sync cron job |
| `myproject:queue:processor` | Queue message processing |
| `myproject:ai:generate` | AI content generation |

See [Feature IDs reference](feature-ids.md) for detailed naming conventions.

## 7. Register Budgets

In your Platform backend's `platform/config/budgets.yaml`, add entries for each feature:

```yaml
features:
  myproject:api:main:
    daily_limit:
      d1_reads: 100000
      d1_writes: 10000
      kv_reads: 50000
    circuit_breaker:
      threshold_percent: 100
      warning_percent: 70
      critical_percent: 90
      auto_reset_hours: 24

  myproject:cron:daily-sync:
    daily_limit:
      d1_reads: 50000
      d1_writes: 25000
    circuit_breaker:
      threshold_percent: 100
```

Then sync the config:

```bash
cd path/to/your-platform-backend
npm run sync:config
```

## 8. Test Locally

```bash
npx wrangler dev
```

In local development, the telemetry queue may not be connected. That's fine — the SDK **fails open** and your worker operates normally. Tracking data is silently dropped if the queue is unavailable.

## 9. Deploy and Verify

```bash
npx wrangler deploy
```

Make several requests, then check that telemetry arrived in D1:

```bash
cd path/to/your-platform-backend
npx wrangler d1 execute your-platform-metrics --remote \
  --command "SELECT feature_key, SUM(d1_reads) FROM daily_usage_rollups WHERE feature_key LIKE 'myproject:%' GROUP BY feature_key"
```

## 10. Verify Circuit Breaker Protection

Manually test the circuit breaker to confirm it works:

```bash
# Disable the feature
npx wrangler kv key put "CONFIG:FEATURE:myproject:api:main:STATUS" "STOP" --namespace-id YOUR_KV_ID

# Request should return 503
curl https://my-worker.my-subdomain.workers.dev/

# Re-enable
npx wrangler kv key put "CONFIG:FEATURE:myproject:api:main:STATUS" "GO" --namespace-id YOUR_KV_ID
```

## What's Tracked Automatically

Once you wrap your handler, every binding call is tracked without code changes:

| Binding | Metrics |
|---------|---------|
| D1 | Reads, writes, rows read, rows written |
| KV | Reads, writes, deletes, lists |
| R2 | Class A ops (put/delete/list), Class B ops (get/head) |
| Workers AI | Requests, per-model breakdown |
| Vectorize | Queries, inserts |
| Queues | Messages sent |
| Durable Objects | Requests, latency percentiles |
| Workflows | Invocations |

## What's Next

- [Circuit Breakers](circuit-breakers.md) — Understand the three-tier protection hierarchy
- [Middleware](middleware.md) — Add project-level circuit breakers for Hono apps
- [Advanced Features](advanced.md) — Tracing, logging, service client, AI Gateway, DO heartbeat
- [Troubleshooting](troubleshooting.md) — Common issues and fixes
- [Managing Budgets](../guides/managing-budgets.md) — Day-to-day operations
- [Error Collection](../guides/error-collection-setup.md) — Automatic GitHub issues from worker errors
