# Copilot Instructions — Platform SDKs

## Project

Monorepo for `@littlebearapps/platform-consumer-sdk` and `@littlebearapps/platform-admin-sdk`. Protects Cloudflare Workers from bill shock with automatic metric collection, circuit breaking, and budget enforcement.

## Code Style

- TypeScript strict mode, no `any` (use `unknown`)
- Australian English in prose (licence, realise, colour)
- Import order: external → types → internal → relative
- camelCase for variables/functions, PascalCase for types, SCREAMING_SNAKE for constants

## Testing

- Vitest for all tests
- Consumer SDK: `cd packages/consumer-sdk && npm test`
- Admin SDK: `cd packages/admin-sdk && npm test`

## Key Patterns

- Consumer SDK ships raw `.ts` files — wrangler bundles them at deploy time
- All Cloudflare bindings are proxied via `Proxy` objects for transparent metric collection
- Circuit breaker state stored in KV with prefix `CONFIG:FEATURE:{id}:STATUS`
- Feature IDs: `project:category:feature` format (kebab-case, colon-separated)
- Always call `completeTracking()` in a `finally` block or `ctx.waitUntil()`
