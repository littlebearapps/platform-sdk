# Managing Budgets and Circuit Breakers

Day-to-day operations for checking status, resetting breakers, adjusting limits, and handling emergencies.

> **Using Claude Code?** Run `/platform-health` to check circuit breaker states and heartbeats, or `/platform-costs` to review code changes for billing impact. Requires the [Platform SDK Plugin](https://github.com/littlebearapps/platform-sdk-plugin).

## Checking Circuit Breaker Status

### Via wrangler CLI

```bash
# Check a feature's status
npx wrangler kv key get "CONFIG:FEATURE:myapp:api:main:STATUS" --namespace-id YOUR_KV_ID

# Check a project's status
npx wrangler kv key get "PROJECT:MYAPP:STATUS" --namespace-id YOUR_KV_ID

# Check the global kill switch
npx wrangler kv key get "GLOBAL_STOP_ALL" --namespace-id YOUR_KV_ID
```

**Expected values:**
- Feature level: `GO` (enabled) or `STOP` (disabled)
- Project level: `active`, `warning`, or `paused`
- Global: empty/missing (off) or `true` (all features stopped)

### Programmatically

```typescript
import { isFeatureEnabled } from '@littlebearapps/platform-consumer-sdk';
import { getCircuitBreakerStates, isGlobalStopActive } from '@littlebearapps/platform-consumer-sdk/middleware';

// Check a single feature
const enabled = await isFeatureEnabled('myapp:api:main', env.PLATFORM_CACHE);

// Check multiple projects at once
const states = await getCircuitBreakerStates(env.PLATFORM_CACHE);
// { 'PROJECT:MYAPP:STATUS': 'active', 'PROJECT:OTHER:STATUS': 'paused' }

// Check global kill switch
const globalStop = await isGlobalStopActive(env.PLATFORM_CACHE);
```

## Resetting a Tripped Circuit Breaker

When budget enforcement trips a circuit breaker, the feature is set to `STOP`. To re-enable it:

### Feature-level reset

```bash
npx wrangler kv key put "CONFIG:FEATURE:myapp:api:main:STATUS" "GO" --namespace-id YOUR_KV_ID
```

### Project-level reset

```bash
npx wrangler kv key put "PROJECT:MYAPP:STATUS" "active" --namespace-id YOUR_KV_ID
```

### Global stop removal

```bash
npx wrangler kv key delete "GLOBAL_STOP_ALL" --namespace-id YOUR_KV_ID
```

### Programmatically

```typescript
import { setCircuitBreakerStatus } from '@littlebearapps/platform-consumer-sdk';
import { setProjectStatus, setGlobalStop } from '@littlebearapps/platform-consumer-sdk/middleware';

// Re-enable a feature
await setCircuitBreakerStatus('myapp:api:main', 'GO', env.PLATFORM_CACHE, 'Manual reset');

// Re-enable a project
await setProjectStatus(env.PLATFORM_CACHE, 'PROJECT:MYAPP:STATUS', 'active');

// Remove global stop
await setGlobalStop(env.PLATFORM_CACHE, false);
```

> **Warning:** Resetting a circuit breaker that tripped due to budget exhaustion will allow the feature to resume spending. If the underlying issue (e.g., a bug causing excessive writes) hasn't been fixed, the breaker will trip again when the budget is re-exhausted.

## Adjusting Budget Limits

Budget limits are configured in `budgets.yaml` and synced to KV/D1.

### 1. Edit budgets.yaml

```yaml
features:
  myapp:
    api:
      main:
        limit: 500000          # Daily D1 row limit
        warning_threshold: 70  # Warn at 70%
        critical_threshold: 90 # Critical at 90%, hard stop at 100%
      search:
        limit: 100000
        warning_threshold: 80
        critical_threshold: 95
    cron:
      daily-sync:
        limit: 200000
```

> **Note:** YAML 1.2 parses underscored numbers (e.g., `1_000_000`) as strings, not numbers. The sync script normalises these automatically, but be aware if reading `budgets.yaml` directly.

### 2. Sync to D1/KV

```bash
npm run sync:config
```

This pushes the updated limits to both D1 (for reporting) and KV (for runtime enforcement).

### 3. Verify

```bash
npx wrangler kv key get "CONFIG:FEATURE:myapp:api:main:BUDGET" --namespace-id YOUR_KV_ID
```

## Budget Warning Thresholds

The budget enforcement system sends progressive warnings before tripping circuit breakers:

| Threshold | What Happens |
|-----------|-------------|
| **70%** (warning) | Slack/webhook alert. Feature continues running. |
| **90%** (critical) | Urgent Slack/webhook alert. Feature continues running. |
| **100%** (hard stop) | Circuit breaker trips. Feature returns `CircuitBreakerError`. |

Warning deduplication:
- Daily warnings: `BUDGET_WARN:{featureId}` KV key with 1-hour TTL
- Monthly warnings: `BUDGET_WARN_MONTHLY:{featureId}` KV key with 24-hour TTL

## Monthly Budget Tracking

Monthly budgets are checked at midnight UTC. The system queries `daily_usage_rollups` for the current month's cumulative usage.

Monthly budget keys in KV: `CONFIG:FEATURE:{id}:BUDGET_MONTHLY`

To check current month's usage for a feature, query the platform-usage worker or D1 directly:

```sql
SELECT SUM(value) as monthly_total
FROM daily_usage_rollups
WHERE feature_id = 'myapp:api:main'
  AND snapshot_date >= date('now', 'start of month');
```

## Emergency Procedures

### Stop everything immediately

```typescript
import { setGlobalStop } from '@littlebearapps/platform-consumer-sdk/middleware';

await setGlobalStop(env.PLATFORM_CACHE, true);
```

Or via CLI:

```bash
npx wrangler kv key put "GLOBAL_STOP_ALL" "true" --namespace-id YOUR_KV_ID
```

This stops all features across all workers that read from this KV namespace. Every `withFeatureBudget()` call will throw `CircuitBreakerError`.

### Stop a single feature

```bash
npx wrangler kv key put "CONFIG:FEATURE:myapp:ai:generate:STATUS" "STOP" --namespace-id YOUR_KV_ID
```

### Pause an entire project

```bash
npx wrangler kv key put "PROJECT:MYAPP:STATUS" "paused" --namespace-id YOUR_KV_ID
```

### Admin SDK kill switch (nuclear option)

If circuit breakers aren't enough — for example, a worker is burning through resources before the SDK even loads — use the Admin SDK to disable the worker at the Cloudflare level:

```typescript
import { killSwitch } from '@littlebearapps/platform-admin-sdk/kill-switch';

// Disable all routes for a specific worker
await killSwitch.disableRoutes({
  accountId: 'YOUR_ACCOUNT_ID',
  apiToken: 'YOUR_API_TOKEN',
  scriptName: 'runaway-worker',
});

// Nuclear option: delete the worker entirely
await killSwitch.deleteWorker('YOUR_ACCOUNT_ID', 'YOUR_API_TOKEN', 'runaway-worker');
```

> **Warning:** `deleteWorker` is irreversible. The worker code is gone. You'll need to redeploy from source. Use `disableRoutes` first if possible.

## Recovery Checklist

After an incident:

1. **Identify the root cause** — Check logs (`npx wrangler tail`) for the failing worker
2. **Fix the bug** — Deploy the fix before re-enabling the feature
3. **Reset the circuit breaker** — Feature, project, or global level as appropriate
4. **Verify recovery** — Watch logs for a few minutes to confirm normal operation
5. **Adjust budgets if needed** — If the budget was legitimately too low, increase it in `budgets.yaml`
6. **Review anomaly thresholds** — Consider adding anomaly detection if the spike was unexpected
