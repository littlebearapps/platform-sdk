# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Platform SDKs, please report it responsibly.

**Do NOT** open a public GitHub issue for security vulnerabilities.

Instead, please email **security@littlebearapps.com** with:

1. Description of the vulnerability
2. Steps to reproduce
3. Potential impact
4. Suggested fix (if any)

We will acknowledge receipt within 48 hours and aim to provide a fix within 7 days for critical issues.

## Scope

This policy covers:
- `@littlebearapps/platform-consumer-sdk` (npm package)
- `@littlebearapps/platform-admin-sdk` (npm package)
- Generated scaffold code (templates in `packages/admin-sdk/templates/`)

## Security Considerations

- The Consumer SDK accesses KV and Queue bindings. Ensure your `PLATFORM_CACHE` KV namespace and `TELEMETRY_QUEUE` are not publicly accessible.
- The Admin SDK scaffolds workers that may have access to D1, KV, and external APIs (GitHub, Slack). Protect wrangler secrets accordingly.
- Circuit breaker state in KV is not encrypted. Do not store sensitive data in feature IDs or budget configurations.
