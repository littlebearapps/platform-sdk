# Health Monitoring & Heartbeats

How to verify your workers are running, your circuit breakers are responsive, and your cron jobs are executing on schedule.

> **Using Claude Code?** Run `/platform-health` to check circuit breaker states and heartbeat freshness. Requires the [Platform SDK Plugin](https://github.com/littlebearapps/platform-sdk-plugin).

## Overview

Platform SDKs provide three complementary health mechanisms:

| Mechanism | What It Checks | How It Works |
|-----------|---------------|-------------|
| **Health API** | KV connectivity + queue delivery | Dual-plane probe from inside the worker |
| **Gatus heartbeats** | Cron job execution | External uptime monitor pinged after each cron run |
| **DO heartbeat mixin** | Durable Object liveness | Alarm-based heartbeat sent to telemetry queue |

## Health API (`health()`)

The `health()` function performs a **dual-plane check** — verifying both the control plane (KV circuit breaker reads) and data plane (queue message delivery):

```typescript
import { health } from '@littlebearapps/platform-consumer-sdk';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      const status = await health(env, 'myapp:api:main');
      return Response.json(status, {
        status: status.status === 'GO' ? 200 : 503,
      });
    }

    // ... your handler logic
  }
};
```

### Health Response

```json
{
  "status": "GO",
  "circuitBreaker": {
    "level": "feature",
    "status": "GO"
  },
  "timestamp": "2026-02-25T10:30:00.000Z"
}
```

Possible statuses:

| Status | Meaning |
|--------|---------|
| `GO` | KV reachable, circuit breaker open, queue accepts messages |
| `STOP` | Circuit breaker has tripped (feature, project, or global level) |
| `UNKNOWN` | KV unreachable or unexpected error |

### Health with Heartbeat Probe

Pass `{ probe: true }` to also send a heartbeat message to the telemetry queue. This verifies end-to-end data flow:

```typescript
const status = await health(env, 'myapp:api:main', { probe: true });
// Sends a heartbeat message to TELEMETRY_QUEUE in addition to KV check
```

### Using Health Checks with Gatus

If you run [Gatus](https://github.com/TwiN/gatus) for uptime monitoring, point it at your `/health` endpoint:

```yaml
# gatus config
endpoints:
  - name: myapp-api
    url: "https://my-worker.example.com/health"
    interval: 5m
    conditions:
      - "[STATUS] == 200"
      - "[BODY].status == GO"
```

## Gatus Heartbeats for Cron Jobs

Cron handlers don't have an HTTP endpoint to monitor. Instead, they **ping a Gatus heartbeat URL** after each successful execution:

```typescript
import { withCronBudget, completeTracking } from '@littlebearapps/platform-consumer-sdk';
import { pingHeartbeat } from '@littlebearapps/platform-consumer-sdk/heartbeat';

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    const tracked = withCronBudget(env, 'myapp:cron:daily-sync', {
      ctx,
      cronExpression: event.cron,
    });

    try {
      // Your cron logic
      await processData(tracked);

      // Ping heartbeat on success
      pingHeartbeat(
        ctx,
        env.GATUS_HEARTBEAT_URL,  // e.g. https://status.example.com/api/v1/endpoints/heartbeats_daily-sync/external
        env.GATUS_TOKEN,
        true // success
      );
    } catch (error) {
      // Ping heartbeat with failure
      pingHeartbeat(ctx, env.GATUS_HEARTBEAT_URL, env.GATUS_TOKEN, false);
      throw error;
    } finally {
      ctx.waitUntil(completeTracking(tracked));
    }
  }
};
```

### Heartbeat Behaviour

- **Non-blocking**: Uses `ctx.waitUntil()` so it never delays your handler.
- **Fail-safe**: If the URL or token is falsy, it no-ops silently. If the ping fails, errors are caught and ignored.
- **Frequency validation**: Pass an optional `frequency` parameter (`'hourly'`, `'daily'`, `'weekly'`) to validate you're not pinging too frequently.

### Setting Up Gatus Heartbeats

1. **Add a heartbeat endpoint** in your Gatus config:

```yaml
endpoints:
  - name: heartbeats_daily-sync
    url: ""  # Heartbeats don't poll — they wait for pings
    interval: 25h  # Alert if no heartbeat received in 25 hours
    conditions:
      - "[CONNECTED] == true"
```

2. **Add wrangler secrets** for the heartbeat URL and token:

```bash
wrangler secret put GATUS_HEARTBEAT_URL
# Paste: https://status.example.com/api/v1/endpoints/heartbeats_daily-sync/external

wrangler secret put GATUS_TOKEN
# Paste: your Gatus API token
```

3. **Add the variables** to your wrangler config:

```jsonc
{
  "vars": {
    "GATUS_HEARTBEAT_URL": ""  // Set via secret, or use vars for non-sensitive URLs
  }
}
```

## Durable Object Heartbeat Mixin

For long-running Durable Objects, use the `withHeartbeat()` mixin. It sends periodic heartbeat messages to the telemetry queue using the DO alarm API:

```typescript
import { withHeartbeat } from '@littlebearapps/platform-consumer-sdk';

export class MyDurableObject extends withHeartbeat(DurableObject, {
  featureKey: 'myapp:do:my-object',
  intervalMs: 5 * 60 * 1000, // 5 minutes (default)
  enabled: true,              // default
}) {
  async fetch(request: Request) {
    // Your DO logic — heartbeat runs automatically via alarm
    return new Response('Hello from DO');
  }
}
```

### How It Works

1. Schedules the first alarm in the constructor
2. On each alarm, sends a heartbeat telemetry message to `TELEMETRY_QUEUE`
3. Reschedules the next alarm
4. Calls `super.alarm()` if the parent class has one (safe for chaining)
5. **Fails open** — errors are logged but never thrown, so heartbeat issues never break your DO

### Manual Control

```typescript
// Send heartbeat immediately (outside alarm cycle)
await this.sendHeartbeatNow();

// Reschedule next alarm
await this.rescheduleHeartbeat();
```

**Required binding**: `TELEMETRY_QUEUE` must be in your wrangler config for the DO worker.

## Budget Warning Alerts

The Platform backend (Admin SDK) automatically sends budget warning alerts at configurable thresholds. These run as part of the `platform-usage` cron job:

| Threshold | Level | Action |
|-----------|-------|--------|
| **70%** of daily budget | Warning | Slack/webhook notification |
| **90%** of daily budget | Critical | Slack/webhook notification |
| **100%** of daily budget | Stop | Circuit breaker trips, feature disabled |

### Configuring Alert Destinations

Budget alerts are sent via the notification system scaffolded by the Admin SDK. Configure destinations in your `budgets.yaml`:

```yaml
features:
  myapp:api:main:
    daily_limit: 50000
    monthly_limit: 1000000
    warning_threshold: 0.7   # 70% (default)
    critical_threshold: 0.9  # 90% (default)
```

For Slack alerts, set the `SLACK_WEBHOOK_URL` secret on your `platform-usage` worker:

```bash
wrangler secret put SLACK_WEBHOOK_URL -c wrangler.myproject-usage.jsonc
# Paste your Slack incoming webhook URL
```

### Monthly Budget Tracking

Monthly budgets are checked at midnight UTC. The system queries `daily_usage_rollups` for the current month and compares against `monthly_limit`. Deduplication via KV prevents alert storms (one alert per feature per 24 hours).

## Putting It All Together

A fully monitored worker looks like this:

```typescript
import { withFeatureBudget, withCronBudget, completeTracking, health, CircuitBreakerError } from '@littlebearapps/platform-consumer-sdk';
import { pingHeartbeat } from '@littlebearapps/platform-consumer-sdk/heartbeat';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    // Health endpoint
    if (new URL(request.url).pathname === '/health') {
      const status = await health(env, 'myapp:api:main', { probe: true });
      return Response.json(status, { status: status.status === 'GO' ? 200 : 503 });
    }

    // Main handler with budget tracking
    const tracked = withFeatureBudget(env, 'myapp:api:main', { ctx });
    try {
      const result = await tracked.DB.prepare('SELECT * FROM items LIMIT 100').all();
      return Response.json(result);
    } catch (e) {
      if (e instanceof CircuitBreakerError) {
        return Response.json({ error: 'Temporarily unavailable' }, { status: 503 });
      }
      throw e;
    } finally {
      ctx.waitUntil(completeTracking(tracked));
    }
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    const tracked = withCronBudget(env, 'myapp:cron:sync', { ctx, cronExpression: event.cron });
    try {
      await syncData(tracked);
      pingHeartbeat(ctx, env.GATUS_URL, env.GATUS_TOKEN, true);
    } catch (error) {
      pingHeartbeat(ctx, env.GATUS_URL, env.GATUS_TOKEN, false);
      throw error;
    } finally {
      ctx.waitUntil(completeTracking(tracked));
    }
  }
};
```

## Further Reading

- [Managing Budgets and Circuit Breakers](managing-budgets.md) — Day-to-day CB operations and emergency procedures
- [Consumer SDK Advanced Features](../consumer-sdk/advanced.md) — DO heartbeat mixin API reference
- [Consumer SDK Troubleshooting](../consumer-sdk/troubleshooting.md) — Common issues
