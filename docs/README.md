# 📚 Platform SDKs Documentation

> **New here?** Two paths depending on where you're starting:
>
> **Setting up from scratch?** Start with [Your First Protected Worker](guides/first-worker.md) — a 20-minute tutorial covering both admin backend + consumer SDK end to end.
>
> **Already have a Platform backend?** Jump straight to [Consumer SDK Getting Started](consumer-sdk/getting-started.md) to add tracking to an existing worker.

---

## 🚀 Getting Started

| I want to... | Start here |
|--------------|-----------|
| Set up everything from scratch (backend + app worker) | [Your First Protected Worker](guides/first-worker.md) |
| **Scaffold the admin backend** (command centre) | [Admin SDK Quickstart](admin-sdk/quickstart.md) |
| **Add the consumer SDK** to an existing worker | [Consumer SDK Getting Started](consumer-sdk/getting-started.md) |
| Migrate from the old package name | [Migrating from v0](guides/migrating-from-v0.md) |

**npm packages:**
- Admin SDK (backend scaffolder): [`@littlebearapps/platform-admin-sdk`](https://www.npmjs.com/package/@littlebearapps/platform-admin-sdk)
- Consumer SDK (per-worker library): [`@littlebearapps/platform-consumer-sdk`](https://www.npmjs.com/package/@littlebearapps/platform-consumer-sdk)
- Claude Code Plugin (optional): [`platform-sdk-plugin`](https://github.com/littlebearapps/platform-sdk-plugin)

---

## Tutorials — Learn by doing

Step-by-step walkthroughs for getting started.

| Guide | Time | What You'll Build |
|-------|------|-------------------|
| [Your First Protected Worker](guides/first-worker.md) | ~20 min | Full end-to-end: admin backend + app worker with tracking and circuit breakers |
| [Consumer SDK Getting Started](consumer-sdk/getting-started.md) | ~10 min | Add tracking to an existing worker (assumes backend already deployed) |
| [Admin SDK Quickstart](admin-sdk/quickstart.md) | ~15 min | Scaffold and deploy the Platform backend (command centre) |
| [Migrating from v0](guides/migrating-from-v0.md) | ~5 min | Update from old `@littlebearapps/platform-sdk` package name |

---

## How-To Guides — Accomplish a task

Task-oriented guides for common operations.

| Guide | What It Covers |
|-------|---------------|
| [Multi-Account Setup](guides/multi-account.md) | Using Platform SDKs across multiple Cloudflare accounts |
| [Managing Budgets and Circuit Breakers](guides/managing-budgets.md) | Checking status, resetting breakers, adjusting limits, emergency procedures |
| [Setting Up Error Collection](guides/error-collection-setup.md) | Automatic GitHub issue creation from worker errors (Standard tier) |

---

## Reference — Look something up

Detailed technical reference for each SDK component.

### Consumer SDK

| Topic | What's In It |
|-------|-------------|
| [Concepts](consumer-sdk/concepts.md) | How the proxy system works (three-layer stack) |
| [Circuit Breakers](consumer-sdk/circuit-breakers.md) | Three-tier protection hierarchy (global > project > feature) |
| [Feature IDs](consumer-sdk/feature-ids.md) | Naming conventions (`project:category:feature`) and budget registration |
| [Middleware](consumer-sdk/middleware.md) | Project-level circuit breakers for Hono apps |
| [Telemetry](consumer-sdk/telemetry.md) | Metrics format, flush lifecycle, Analytics Engine |
| [Patterns](consumer-sdk/patterns.md) | Static and dynamic transient error classification |
| [Advanced](consumer-sdk/advanced.md) | Tracing, logging, service client, AI Gateway, DO heartbeat |
| [Troubleshooting](consumer-sdk/troubleshooting.md) | Common issues and fixes |

### Admin SDK

| Topic | What's In It |
|-------|-------------|
| [Quickstart](admin-sdk/quickstart.md) | Scaffold to deploy in 15 minutes |
| [Tiers](admin-sdk/tiers.md) | What each tier generates (Minimal, Standard, Full) |
| [Upgrade Guide](admin-sdk/upgrade-guide.md) | Three-way merge, adopt, and tier upgrades |
| [CI Workflow](admin-sdk/ci-workflow.md) | `consumer-check.yml` deep dive |

---

## Explanation — Understand the concepts

Background knowledge and architectural decisions.

- [Architecture Concepts](consumer-sdk/concepts.md) — How the proxy system intercepts binding calls
- [Circuit Breaker Hierarchy](consumer-sdk/circuit-breakers.md) — Why three tiers, and how they interact
- [Error Pattern System](consumer-sdk/patterns.md) — Static regex patterns + AI-discovered dynamic patterns
- [Telemetry Pipeline](consumer-sdk/telemetry.md) — Queue-based async metrics, Analytics Engine integration

---

## Companion Tools

| Tool | Purpose | Link |
|------|---------|------|
| **Claude Code Plugin** | Automated SDK convention enforcement | [platform-sdk-plugin](https://github.com/littlebearapps/platform-sdk-plugin) |
| **Consumer CI Workflow** | GitHub Actions SDK validation | [ci-workflow.md](admin-sdk/ci-workflow.md) |
| **Integration Checklist** | Full SDK setup guide | [docs.littlebearapps.com](https://docs.littlebearapps.com/platform-guides/sdk-integration-checklist/) |
