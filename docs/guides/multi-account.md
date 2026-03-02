# Multi-Account Setup

How to use Platform SDKs across multiple Cloudflare accounts.

> **Using Claude Code?** The [Platform SDK Plugin](https://github.com/littlebearapps/platform-sdk-plugin) validates wrangler bindings and SDK conventions per-project. Install it in each project that uses the Consumer SDK.

## Overview

If you run Cloudflare Workers across multiple accounts — whether for client projects, different business units, or compliance isolation — Platform SDKs work in all of them. The Consumer SDK is account-agnostic (it just needs a KV namespace and a queue), and the Admin SDK accepts per-call credentials for cross-account operations.

## Prerequisites

- **Workers Paid plan** on each Cloudflare account (required for KV, Queues, and D1)
- **API tokens** with appropriate permissions for each account (Admin SDK only)
- The Consumer SDK installed in each worker project

## Consumer SDK: Per-Account Setup

The Consumer SDK operates within a single Cloudflare account per worker. Each account needs its own resources:

### 1. Create resources in each account

```bash
# Account A
npx wrangler kv namespace create PLATFORM_CACHE
npx wrangler queues create my-telemetry

# Account B (switch accounts first: npx wrangler login)
npx wrangler kv namespace create PLATFORM_CACHE
npx wrangler queues create my-telemetry
```

### 2. Configure each worker's wrangler.jsonc

The SDK code is identical — only the binding IDs differ:

```jsonc
// Worker in Account A
{
  "kv_namespaces": [{ "binding": "PLATFORM_CACHE", "id": "ACCOUNT_A_KV_ID" }],
  "queues": { "producers": [{ "binding": "TELEMETRY_QUEUE", "queue": "my-telemetry" }] }
}
```

```jsonc
// Worker in Account B
{
  "kv_namespaces": [{ "binding": "PLATFORM_CACHE", "id": "ACCOUNT_B_KV_ID" }],
  "queues": { "producers": [{ "binding": "TELEMETRY_QUEUE", "queue": "my-telemetry" }] }
}
```

### 3. Use the SDK as normal

No code changes are needed. The SDK interacts with whichever KV namespace and queue are bound.

```typescript
import { withFeatureBudget, completeTracking } from '@littlebearapps/platform-consumer-sdk';

// Same code works regardless of which account the worker is deployed to
const tracked = withFeatureBudget(env, 'myapp:api:main', { ctx });
```

## Admin SDK: Cross-Account Operations

The Admin SDK's programmatic API accepts `accountId` and `apiToken` per call, enabling cross-account monitoring and control from a single script or worker.

### GraphQL Usage Monitoring

```typescript
import { queryUsage } from '@littlebearapps/platform-admin-sdk/graphql';

// Query Account A
const usageA = await queryUsage({
  accountId: 'ACCOUNT_A_ID',
  apiToken: 'ACCOUNT_A_TOKEN',
  products: 'all',
  since: new Date(Date.now() - 24 * 60 * 60 * 1000),
});

// Query Account B
const usageB = await queryUsage({
  accountId: 'ACCOUNT_B_ID',
  apiToken: 'ACCOUNT_B_TOKEN',
  products: ['d1', 'kv'],
  since: new Date(Date.now() - 24 * 60 * 60 * 1000),
});
```

### Kill Switch Across Accounts

```typescript
import { killSwitch } from '@littlebearapps/platform-admin-sdk/kill-switch';

// Emergency: disable a runaway worker in Account B
await killSwitch.disableRoutes({
  accountId: 'ACCOUNT_B_ID',
  apiToken: 'ACCOUNT_B_TOKEN',
  scriptName: 'runaway-worker',
});
```

### AI Gateway Configuration

```typescript
import { aiGateway } from '@littlebearapps/platform-admin-sdk/ai-gateway';

// Set rate limits on Account A's AI Gateway
await aiGateway.setRateLimit('ACCOUNT_A_ID', 'ACCOUNT_A_TOKEN', 'my-gateway', {
  requestsPerMinute: 100,
});
```

## Architecture Patterns

### Centralised (recommended for most setups)

One Cloudflare account hosts the Platform backend. Workers in other accounts send telemetry to it.

```
Account A (Platform host)     Account B              Account C
┌─────────────────────┐      ┌──────────────┐      ┌──────────────┐
│ Platform backend     │      │ Worker X     │      │ Worker Y     │
│ (platform-usage,     │◄─────│ (Consumer    │      │ (Consumer    │
│  error-collector,    │      │  SDK)        │      │  SDK)        │
│  sentinel)           │      └──────────────┘      └──────────────┘
│                      │             │                      │
│ D1 + KV + Queue      │◄────────────┘──────────────────────┘
└─────────────────────┘        (telemetry via queue)
```

> **Note:** Cross-account queue production requires the queue to be accessible. In Cloudflare, queues are account-scoped. For cross-account telemetry, use HTTP endpoints on the platform-usage worker instead of direct queue bindings.

### Federated

Each account runs its own Platform backend independently. Useful when accounts must be fully isolated (compliance, separate billing).

```
Account A                    Account B
┌─────────────────────┐      ┌─────────────────────┐
│ Workers + Platform   │      │ Workers + Platform   │
│ backend (self-       │      │ backend (self-       │
│ contained)           │      │ contained)           │
└─────────────────────┘      └─────────────────────┘
```

Scaffold a separate Platform backend in each account:

```bash
npx @littlebearapps/platform-admin-sdk platform-account-a --tier standard
npx @littlebearapps/platform-admin-sdk platform-account-b --tier minimal
```

### Hybrid

Shared error collection and budget enforcement, but per-account telemetry storage. Useful for large portfolios where you want centralised alerting but decentralised data.

## Dynamic Pattern Sync

If you use the Full tier with AI-discovered error patterns, you can share patterns across accounts:

```typescript
import { exportDynamicPatterns, importDynamicPatterns } from '@littlebearapps/platform-consumer-sdk/dynamic-patterns';

// Export from Account A
const patternsJson = await exportDynamicPatterns(accountA_KV);

// Import to Account B (validates patterns before writing)
await importDynamicPatterns(accountB_KV, patternsJson);
```

This is useful when one account has accumulated good transient error patterns that other accounts would benefit from.

## Troubleshooting Multi-Account Setups

**KV namespace bound to wrong account**
Verify the KV namespace ID in your `wrangler.jsonc` matches the account the worker is deployed to. KV namespaces are account-scoped — you can't use Account A's namespace from Account B.

**Queue consumer not receiving messages**
Queues are account-scoped. If your platform-usage worker is in Account A but the producer is in Account B, use HTTP instead of queue bindings for cross-account telemetry.

**Circuit breakers not syncing across accounts**
Circuit breaker state lives in KV, which is account-scoped. Each account's workers check their own PLATFORM_CACHE. To stop a feature globally across accounts, you need to set the status in each account's KV.

**Admin SDK API calls failing**
Each `queryUsage()` or `killSwitch.*()` call requires valid credentials for the target account. Verify the API token has the correct permissions (Account Settings > API Tokens).
