# Setting Up Error Collection

Automatic GitHub issue creation from Cloudflare Worker errors. Requires the **Standard** or **Full** tier Platform backend.

> **Note:** Platform SDKs are built for Cloudflare-hosted projects. You need a Cloudflare account with the Workers Paid plan, D1, KV, and Queues enabled. The error collection system runs as Cloudflare Workers within your account.

> **Using Claude Code?** The [Platform SDK Plugin](https://github.com/littlebearapps/platform-sdk-plugin) validates `tail_consumers` configuration and error-collector bindings automatically. Run `/platform-audit` to check your setup.

## Overview

The error-collector is a **tail worker** that receives log events from your application workers. When it sees an error, it:

1. **Classifies** the error using 125+ built-in patterns + AI-discovered dynamic patterns
2. **Fingerprints** the error (deduplicates identical errors into a single issue)
3. **Creates a GitHub issue** with priority label, stack trace, and worker metadata
4. **Stores** the occurrence in D1 for analytics

Transient errors (rate limits, timeouts, quota exhaustion) are batched into daily digest issues instead of individual tickets.

## Prerequisites

- **Standard or Full tier** Platform backend scaffolded and deployed via the Admin SDK ([`@littlebearapps/platform-admin-sdk`](https://www.npmjs.com/package/@littlebearapps/platform-admin-sdk)). If you haven't set this up yet, see the [Admin SDK Quickstart](../admin-sdk/quickstart.md).
- **Consumer SDK** ([`@littlebearapps/platform-consumer-sdk`](https://www.npmjs.com/package/@littlebearapps/platform-consumer-sdk)) installed in your application workers. See [Consumer SDK Getting Started](../consumer-sdk/getting-started.md).
- **GitHub App** or **GitHub token** with issue creation permissions
- **Cloudflare Workers Paid plan** (for tail consumers)

## How Tail Consumers Work

Cloudflare's [tail workers](https://developers.cloudflare.com/workers/observability/logs/tail-workers/) receive real-time log events from other workers. You configure which workers send events to the error-collector.

Add `tail_consumers` to each application worker's `wrangler.jsonc`:

```jsonc
{
  "name": "my-app-worker",
  "tail_consumers": [
    { "service": "my-platform-error-collector" }
  ]
}
```

> **Note:** The `service` value must match the error-collector worker's name exactly.

## Creating a GitHub App

The error-collector uses a GitHub App to create issues. This is more secure than a personal access token because permissions are scoped to specific repositories.

### 1. Create the app

Go to **GitHub Settings > Developer Settings > GitHub Apps > New GitHub App**:

- **Name**: `My Platform Error Collector` (or similar)
- **Homepage URL**: Your project URL (required, can be anything)
- **Webhook**: Uncheck "Active" (not needed)
- **Permissions**:
  - Repository > Issues: **Read & Write**
  - Repository > Metadata: **Read** (required by GitHub)
- **Where can this GitHub App be installed?**: Only on this account

### 2. Install the app

After creating, click **Install App** and select the repositories where issues should be created.

### 3. Get credentials

You need three values:

| Value | Where to Find |
|-------|---------------|
| **App ID** | GitHub App settings page (top of page) |
| **Private Key** | GitHub App settings > Generate a private key (downloads `.pem` file) |
| **Installation ID** | After installing, the URL contains the ID: `github.com/settings/installations/{ID}` |

### 4. Configure secrets

```bash
# Set secrets on the error-collector worker
npx wrangler secret put GITHUB_APP_ID -c wrangler.my-platform-error-collector.jsonc
npx wrangler secret put GITHUB_APP_PRIVATE_KEY -c wrangler.my-platform-error-collector.jsonc
npx wrangler secret put GITHUB_APP_INSTALLATION_ID -c wrangler.my-platform-error-collector.jsonc
```

For the private key, paste the entire `.pem` file contents (including `-----BEGIN RSA PRIVATE KEY-----`).

## Priority Levels

The error-collector assigns priorities based on error severity and frequency:

| Priority | Label | Behaviour |
|----------|-------|-----------|
| **P0** | `cf:priority:p0` | Immediate GitHub issue. Typically unhandled exceptions that crash the worker. |
| **P1** | `cf:priority:p1` | Immediate GitHub issue. Errors that affect user-visible functionality. |
| **P2** | `cf:priority:p2` | Immediate GitHub issue. Internal errors that degrade monitoring or background tasks. |
| **P3** | `cf:priority:p3` | Immediate GitHub issue. Low-severity errors with workarounds. |
| **P4** | `cf:priority:p4` | Batched into daily digest. Informational warnings. |

## Transient Error Patterns

Not every error needs a GitHub issue. Transient errors — rate limits, timeouts, quota exhaustion — are expected operational noise. The error-collector recognises these and handles them differently.

### Static patterns (built into the SDK)

125 regex patterns covering common Cloudflare and third-party errors:

```typescript
import { classifyErrorAsTransient } from '@littlebearapps/platform-consumer-sdk/patterns';

classifyErrorAsTransient('quotaExceeded: Daily limit reached');
// { isTransient: true, category: 'quota-exhausted' }
```

Categories include: `quota-exhausted`, `rate-limited`, `service-unavailable`, `timeout`, `connection-refused`, `d1-rate-limited`, `do-reset`, `r2-internal-error`, and more.

### Dynamic patterns (AI-discovered)

If you run the **Full tier**, the pattern-discovery worker uses AI to identify new transient error patterns from your unclassified errors. These go through a human-in-the-loop approval process before being activated.

Dynamic patterns are stored in KV under `PATTERNS:DYNAMIC:APPROVED` and loaded at runtime by the error-collector.

### Transient error handling

Transient errors are deduplicated: **one GitHub issue per error category per day**. The KV key `TRANSIENT:{script}:{category}:{date}` prevents duplicate issues.

## Customising Behaviour

### Muting known errors

Add the `cf:muted` label to a GitHub issue. The error-collector checks labels before creating new issues — muted fingerprints are silently recorded in D1 but won't create new issues.

### Daily digests

P4 errors and transient errors are batched into a daily digest issue, created by the error-collector's midnight cron. The digest includes:

- Error count by category
- Affected workers
- Sample messages
- Trending patterns

### Error deduplication

The error-collector uses a two-layer dedup system:

1. **KV lock**: `ISSUE_LOCK:{fingerprint}` with 60-second TTL (prevents rapid duplicates)
2. **GitHub search**: Falls back to GitHub issue search when KV misses (handles KV cache misses)

## Monitoring Error Collection

### Gatus heartbeat

If you use [Gatus](https://github.com/TwiN/gatus) for uptime monitoring, configure a heartbeat for the error-collector's cron jobs:

```yaml
endpoints:
  - name: error-collector-cron
    group: platform
    url: "https://status.example.com/api/v1/endpoints/heartbeats_error-collector/external"
    interval: 30m
    conditions:
      - "[CONNECTED] == true"
    alerts:
      - type: slack
```

The error-collector pings the heartbeat URL at the end of each successful cron run.

### Checking error stats

Query D1 for error collection statistics:

```sql
-- Errors in the last 24 hours
SELECT script_name, COUNT(*) as count, priority
FROM error_occurrences
WHERE created_at > datetime('now', '-1 day')
GROUP BY script_name, priority
ORDER BY count DESC;

-- Pending digest items
SELECT COUNT(*) as pending
FROM warning_digests
WHERE digested = 0;

-- Fingerprint decisions
SELECT decision, COUNT(*) as count
FROM fingerprint_decisions
GROUP BY decision;
```

## Testing Error Collection

To verify the error-collector is working:

1. **Deploy a worker with a deliberate error:**

```typescript
export default {
  async fetch() {
    throw new Error('Test error for error-collector');
  }
};
```

2. **Send a request to trigger the error:**

```bash
curl https://my-test-worker.your-domain.workers.dev
```

3. **Check for the GitHub issue** — it should appear within a few seconds, labelled `cf:error:unhandled` and `cf:priority:p0`.

4. **Clean up** — close the test issue and remove the deliberate error.
