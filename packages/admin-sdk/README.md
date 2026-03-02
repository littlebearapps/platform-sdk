# Platform Admin SDK

**`@littlebearapps/platform-admin-sdk`** — Scaffold backend infrastructure for Cloudflare Workers cost protection.

Generates workers, D1 migrations, and config files. Run once, then you own the code.

> **Using Claude Code?** Install the [Platform SDK Plugin](https://github.com/littlebearapps/platform-sdk-plugin) for automated SDK convention enforcement — it validates wrangler bindings, budget wrappers, and cost safety patterns in real time.

## Prerequisites

- **Node.js 20+** and npm
- **wrangler CLI** installed and authenticated (`npx wrangler whoami`)
- **Cloudflare Workers Paid plan** (required for KV, Queues, and D1)
- **GitHub organisation** (Standard/Full tiers — for error collection GitHub issues)
- **Gatus instance** (optional — for heartbeat monitoring)

## Usage

```bash
npx @littlebearapps/platform-admin-sdk my-platform
```

The CLI prompts for:
- **Project name** and slug
- **GitHub organisation** (for error collection GitHub issues)
- **Tier** — how much infrastructure to generate
- **Gatus URL** (optional) — for heartbeat monitoring
- **Default assignee** — GitHub username for error issues

### CLI Commands

#### `scaffold` (default)

```bash
npx @littlebearapps/platform-admin-sdk my-platform
npx @littlebearapps/platform-admin-sdk my-platform --tier full --github-org myorg --skip-prompts
```

| Flag | Description |
|------|------------|
| `--tier <tier>` | Infrastructure tier (`minimal`, `standard`, `full`) |
| `--github-org <org>` | GitHub organisation for error issues |
| `--gatus-url <url>` | Gatus status page URL |
| `--default-assignee <user>` | Default GitHub issue assignee |
| `--skip-prompts` | Fail if required flags missing (for CI/automation) |

#### `upgrade`

```bash
npx @littlebearapps/platform-admin-sdk upgrade
npx @littlebearapps/platform-admin-sdk upgrade --dry-run
npx @littlebearapps/platform-admin-sdk upgrade --tier standard
```

| Flag | Description |
|------|------------|
| `--dry-run` | Preview changes without writing files |
| `--tier <tier>` | Upgrade to a higher tier |

#### `adopt`

```bash
npx @littlebearapps/platform-admin-sdk adopt . --tier minimal --project-name my-platform --skip-prompts
```

Creates a `.platform-scaffold.json` manifest for projects scaffolded before v1.1.0. See [Upgrade vs Adopt](#upgrade-vs-adopt).

## Tiers

| Tier | Workers | What You Get | Est. Cost |
|------|---------|-------------|-----------|
| **Minimal** | 1 | Budget enforcement, circuit breakers, usage telemetry | ~$0/mo |
| **Standard** | 3 | + Error collector (auto GitHub issues), gap detection sentinel | ~$0/mo |
| **Full** | 8 | + AI pattern discovery, alert router, notifications, search, settings | ~$5/mo |

See [Tier Comparison](../../docs/admin-sdk/tiers.md) for a detailed breakdown of what each tier generates.

## What Gets Generated

### All tiers

```
my-platform/
├── platform/config/
│   ├── services.yaml          # Project registry, feature definitions
│   └── budgets.yaml           # Daily limits, circuit breaker thresholds
├── storage/d1/migrations/     # D1 schema (4 core migrations + seed)
├── workers/
│   ├── platform-usage.ts      # Data warehouse worker (cron + queue consumer)
│   └── lib/                   # Shared libraries (billing, analytics, budgets)
├── scripts/
│   └── sync-config.ts         # Sync YAML config to D1/KV
├── wrangler.*.jsonc           # Worker configs with binding placeholders
├── package.json
├── tsconfig.json
└── README.md
```

### Key generated files

| File | Purpose |
|------|---------|
| `platform/config/services.yaml` | Project registry — feature definitions, connections, metadata |
| `platform/config/budgets.yaml` | Daily limits, circuit breaker thresholds, warning percentages |
| `storage/d1/migrations/001_*.sql` | Core tables: project registry, resource snapshots, daily rollups |
| `workers/platform-usage.ts` | Central data warehouse — receives queue telemetry, stores in D1 |
| `scripts/sync-config.ts` | Syncs YAML config to D1 + KV (run after config changes) |

### Standard tier adds

| File | Purpose |
|------|---------|
| `workers/error-collector.ts` | Tail worker — creates GitHub issues from worker errors |
| `workers/platform-sentinel.ts` | Gap detection, cost monitoring, alerts |
| `workers/lib/error-collector/` | Fingerprinting, deduplication, digest generation |
| `workers/lib/sentinel/` | Per-project gap detection |
| `storage/d1/migrations/005_error_collection.sql` | Error tables: occurrences, fingerprint decisions, digests |

### Full tier adds

| File | Purpose |
|------|---------|
| `workers/pattern-discovery.ts` | AI-assisted transient error pattern discovery |
| `workers/platform-alert-router.ts` | Unified alert normalisation and routing |
| `workers/platform-notifications.ts` | In-app notification API |
| `workers/platform-search.ts` | Full-text search (FTS5) |
| `workers/platform-settings.ts` | Settings management API |
| `workers/lib/pattern-discovery/` | Clustering, AI prompts, validation, shadow evaluation |
| `storage/d1/migrations/006_pattern_discovery.sql` | Pattern tables |
| `storage/d1/migrations/007_notifications_search.sql` | Notification and search tables |

## Post-Scaffold Steps

### 1. Install dependencies

```bash
cd my-platform
npm install
```

### 2. Create Cloudflare resources

**All tiers:**

```bash
npx wrangler d1 create my-platform-metrics
npx wrangler kv namespace create PLATFORM_CACHE
npx wrangler queues create my-platform-telemetry
npx wrangler queues create my-platform-telemetry-dlq
```

**Standard tier** — also create:

```bash
npx wrangler kv namespace create PLATFORM_ALERTS
```

**Full tier** — also create:

```bash
npx wrangler kv namespace create SERVICE_REGISTRY
```

Update the resource IDs in each `wrangler.*.jsonc` file.

### 3. Configure secrets

```bash
# Standard tier — error-collector (GitHub App for auto-issue creation)
npx wrangler secret put GITHUB_APP_ID -c wrangler.my-platform-error-collector.jsonc
npx wrangler secret put GITHUB_APP_PRIVATE_KEY -c wrangler.my-platform-error-collector.jsonc
npx wrangler secret put GITHUB_APP_INSTALLATION_ID -c wrangler.my-platform-error-collector.jsonc

# Standard tier — sentinel (Cloudflare API for cost monitoring)
npx wrangler secret put CLOUDFLARE_API_TOKEN -c wrangler.my-platform-sentinel.jsonc

# Optional — Slack alerts (any worker with SLACK_WEBHOOK_URL)
npx wrangler secret put SLACK_WEBHOOK_URL -c wrangler.my-platform-sentinel.jsonc

# Full tier — alert-router (GitHub token for issue creation)
npx wrangler secret put GITHUB_TOKEN -c wrangler.my-platform-alert-router.jsonc
npx wrangler secret put SLACK_WEBHOOK_URL -c wrangler.my-platform-alert-router.jsonc
```

### 4. Apply migrations and deploy

```bash
# Sync config to D1/KV
npm run sync:config

# Apply D1 migrations
npx wrangler d1 migrations apply my-platform-metrics --remote

# Deploy workers (order matters — deploy usage first, then tail consumers)
npx wrangler deploy -c wrangler.my-platform-usage.jsonc

# Standard tier
npx wrangler deploy -c wrangler.my-platform-error-collector.jsonc
npx wrangler deploy -c wrangler.my-platform-sentinel.jsonc

# Full tier
npx wrangler deploy -c wrangler.my-platform-notifications.jsonc
npx wrangler deploy -c wrangler.my-platform-search.jsonc
npx wrangler deploy -c wrangler.my-platform-settings.jsonc
npx wrangler deploy -c wrangler.my-platform-pattern-discovery.jsonc
npx wrangler deploy -c wrangler.my-platform-alert-router.jsonc
```

See [Quickstart Guide](../../docs/admin-sdk/quickstart.md) for a detailed walkthrough.

## The Manifest File

When you scaffold or upgrade, the SDK writes a `.platform-scaffold.json` file. **Commit this to git** — it's how `upgrade` knows what to update.

The manifest contains:
- **`sdkVersion`** — Version of the Admin SDK that generated the files
- **`tier`** — Infrastructure tier (minimal/standard/full)
- **`context`** — Project name, slug, organisation, and other scaffold-time settings
- **`files`** — SHA-256 hash of each generated file as originally written
- **`highestScaffoldMigration`** — Highest D1 migration number generated

The `files` hash map is the basis for the three-way merge during `upgrade`: if your current disk content matches the original hash, the file is "unmodified" and can be safely updated. If the disk content differs, you've customised it and `upgrade` skips it with a warning.

## Updating Your Platform

### Upgrade (v1.1.0+)

```bash
cd my-platform
npx @littlebearapps/platform-admin-sdk upgrade
```

The upgrade command:
- **Creates** new files added in the SDK update
- **Updates** files you haven't modified (compares content hashes from manifest)
- **Skips** files you've customised (with a warning showing which files were skipped)
- **Renumbers** new D1 migrations above your highest existing migration

Preview changes without writing:

```bash
npx @littlebearapps/platform-admin-sdk upgrade --dry-run
```

Upgrade to a higher tier:

```bash
npx @littlebearapps/platform-admin-sdk upgrade --tier standard
```

### Upgrade vs Adopt

```
Do you have .platform-scaffold.json in your project?
│
├── YES → Run: npx @littlebearapps/platform-admin-sdk upgrade
│         (three-way merge using manifest hashes)
│
└── NO  → Run: npx @littlebearapps/platform-admin-sdk adopt . --tier <your-tier>
          (creates manifest by hashing existing files as baseline)
          Then run: npx @littlebearapps/platform-admin-sdk upgrade
```

Projects scaffolded before v1.1.0 don't have a manifest. The `adopt` command hashes your existing SDK-generated files as the "original" state, creating a baseline for future upgrades.

See [Upgrade Guide](../../docs/admin-sdk/upgrade-guide.md) for detailed instructions.

## Data Safety

- The scaffolder **refuses to overwrite** existing directories
- All generated migrations are **idempotent** (`ON CONFLICT DO NOTHING`)
- The scaffolder **never modifies** existing Cloudflare resources (D1, KV, Queues)
- Re-applying migrations to an existing database is safe

## What's Not Included

The scaffolder generates core infrastructure only. It does **not** create:

- Dashboards or admin UIs
- Email workers or notification templates
- Data connectors (Stripe, GA4, Plausible, etc.)
- Test suites
- CI/CD workflows (use the [consumer-check.yml](../../docs/admin-sdk/ci-workflow.md) reusable workflow)

These are project-specific — build them as you need them.

## Consumer SDK Integration

The generated backend workers use `@littlebearapps/platform-consumer-sdk` internally. To connect your application workers, install the Consumer SDK and add the required bindings:

```bash
npm install @littlebearapps/platform-consumer-sdk
```

Add to each application worker's `wrangler.jsonc`:

```jsonc
{
  "kv_namespaces": [
    { "binding": "PLATFORM_CACHE", "id": "YOUR_KV_NAMESPACE_ID" }
  ],
  "queues": {
    "producers": [
      { "binding": "TELEMETRY_QUEUE", "queue": "my-platform-telemetry" }
    ]
  },
  // Standard/Full tier — route errors to error-collector
  "tail_consumers": [
    { "service": "my-platform-error-collector" }
  ]
}
```

See the [Consumer SDK README](../consumer-sdk/README.md) for integration details and the [First Worker tutorial](../../docs/guides/first-worker.md) for a complete walkthrough.

## Multi-Account Support

The Admin SDK's programmatic API accepts `accountId` and `apiToken` per call, enabling cross-account monitoring and emergency control from a single script or worker. See the [Multi-Account Setup guide](../../docs/guides/multi-account.md) for architecture patterns.

## Licence

MIT — Made with ❤️ by [Little Bear Apps](https://littlebearapps.com) 🐶
