# Observability Setup

How to add structured logging, distributed tracing, AI cost tracking, cross-worker correlation, and timeouts to your Cloudflare Workers using the Consumer SDK.

> **Using Claude Code?** The [Platform SDK Plugin](https://github.com/littlebearapps/platform-sdk-plugin) validates observability patterns automatically. Run `/platform-audit` to check your setup.

## Overview

The Consumer SDK includes observability features that require zero external dependencies — they work with Cloudflare's built-in Workers Observability (formerly Logpush). No need for Datadog, New Relic, or any third-party service.

| Feature | What It Does | Import From |
|---------|-------------|------------|
| **Structured logging** | JSON logs with correlation IDs, error categorisation, timed operations | Main package |
| **Distributed tracing** | W3C Traceparent propagation across service bindings | Main package |
| **Service client** | Cross-worker RPC with automatic header propagation | Main package |
| **AI Gateway tracking** | Automatic provider + model detection for AI API calls | Main package |
| **Timeouts** | Configurable timeouts with telemetry reporting | Main package |
| **Error categorisation** | 11 error types for consistent classification | Main package |

## Structured Logging

### Basic Setup

```typescript
import { createLoggerFromRequest } from '@littlebearapps/platform-consumer-sdk';

export default {
  async fetch(request: Request, env: Env) {
    const log = createLoggerFromRequest(request, env, 'my-worker', 'myapp:api:main');

    log.info('Request received', { path: new URL(request.url).pathname });
    log.warn('Slow query', new Error('Query took 5s'), { table: 'users' });
    log.error('Processing failed', new Error('DB connection lost'));

    return new Response('OK');
  }
};
```

### Log Output

Each log entry is a JSON object written to `console.log` / `console.warn` / `console.error` — which Cloudflare Workers Observability captures automatically:

```json
{
  "level": "info",
  "message": "Request received",
  "timestamp": "2026-02-25T10:30:00.000Z",
  "correlationId": "a1b2c3d4-...",
  "traceId": "0af7651916cd43dd8448eb211c80319c",
  "spanId": "b7ad6b7169203331",
  "featureId": "myapp:api:main",
  "worker": "my-worker",
  "context": { "path": "/api/users" }
}
```

### Correlation ID Extraction

`createLoggerFromRequest` automatically extracts correlation IDs from incoming headers in priority order:

1. `x-correlation-id`
2. `x-request-id`
3. `cf-ray`
4. Auto-generated UUID (if no header found)

This means requests flowing through multiple workers carry the same correlation ID.

### Timed Operations

Measure operation duration automatically:

```typescript
const result = await log.timed('database-query', async () => {
  return await db.prepare('SELECT * FROM users LIMIT 100').all();
}, { table: 'users' });

// Logs: { message: "database-query completed", durationMs: 45, level: "info", ... }
```

If the operation throws, the error is logged with `durationMs` and re-thrown.

### Child Loggers

Add request-scoped context without repeating yourself:

```typescript
const requestLog = log.child({ requestId: 'req-123', userId: 'user-456' });

requestLog.info('Processing');
// Inherits parent context + requestId + userId in every log entry
```

### Standalone Logger

If you're not in a fetch handler (e.g. cron, queue consumer, Durable Object):

```typescript
import { createLogger } from '@littlebearapps/platform-consumer-sdk';

const log = createLogger({
  worker: 'my-worker',
  featureId: 'myapp:cron:sync',
  correlationId: 'cron-' + Date.now(),
  minLevel: 'warn',  // Only log warn and above
});
```

## Distributed Tracing (W3C Traceparent)

### Why

When Worker A calls Worker B via a service binding, you need to know that a slow response in B was caused by a specific request in A. W3C Trace Context solves this by propagating a trace ID across all workers in a request chain.

### Setup

```typescript
import {
  createTraceContext,
  createTracedFetch,
  startSpan,
  endSpan,
  failSpan,
} from '@littlebearapps/platform-consumer-sdk';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    // Extract trace context from incoming request (or create new trace)
    const traceCtx = createTraceContext(request, env);

    const span = startSpan(traceCtx, 'handle-request');
    try {
      // Outgoing requests automatically propagate trace headers
      const tracedFetch = createTracedFetch(traceCtx);
      const response = await tracedFetch('https://api.example.com/data');

      endSpan(span);
      return response;
    } catch (error) {
      failSpan(span, error as Error);
      throw error;
    }
  }
};
```

### What Gets Propagated

When you use `createTracedFetch()` or `propagateTraceContext()`, these headers are added to outgoing requests:

| Header | Format | Example |
|--------|--------|---------|
| `traceparent` | `{version}-{traceId}-{spanId}-{flags}` | `00-0af7651916cd43dd-b7ad6b7169203331-01` |
| `tracestate` | Vendor-specific key-value pairs | `platform=myapp` |

### Manual Header Propagation

If you're making raw `fetch()` calls instead of using `createTracedFetch`:

```typescript
import { propagateTraceContext, addTraceHeaders } from '@littlebearapps/platform-consumer-sdk';

// Generate headers for outgoing request
const traceHeaders = propagateTraceContext(traceCtx);

// Or merge into existing headers
const enrichedHeaders = addTraceHeaders(existingHeaders, traceCtx);
```

### Span Utilities

```typescript
import { isSampled, shortTraceId, shortSpanId, formatTraceForLog } from '@littlebearapps/platform-consumer-sdk';

isSampled(traceCtx);          // true if traceFlags & 0x01
shortTraceId(traceCtx);       // First 8 chars (for log readability)
shortSpanId(traceCtx);        // First 8 chars
formatTraceForLog(traceCtx);  // { trace_id, span_id, trace_flags }
```

## Service Client (Cross-Worker Correlation)

When your workers communicate via service bindings, the service client ensures correlation IDs, trace context, and source metadata are propagated automatically.

### Wrapping a Service Binding

```typescript
import { wrapServiceBinding } from '@littlebearapps/platform-consumer-sdk';

// env.OTHER_SERVICE is a Fetcher (service binding in wrangler config)
const wrappedService = wrapServiceBinding(env.OTHER_SERVICE, env, 'my-worker');

// All calls automatically include:
//   x-correlation-id, x-source-service, x-target-service,
//   x-feature-id, traceparent, tracestate
const response = await wrappedService.fetch('http://other-service/api/data');
```

### Standalone Service Client

```typescript
import { createServiceClient } from '@littlebearapps/platform-consumer-sdk';

const client = createServiceClient(env, 'my-worker', { timeoutMs: 10000 });
const response = await client.fetch('https://other-worker.example.com/api/data');
```

### Extracting Incoming Context

In the receiving worker, extract the correlation chain from the incoming request:

```typescript
import { extractCorrelationChain } from '@littlebearapps/platform-consumer-sdk';

export default {
  async fetch(request: Request, env: Env) {
    const chain = extractCorrelationChain(request);
    // {
    //   correlationId: 'a1b2c3d4-...',
    //   sourceService: 'calling-worker',
    //   targetService: 'my-worker',
    //   featureId: 'myapp:api:main',
    //   traceId: '0af7...',
    //   spanId: '1b2c...',
    // }

    // Use chain.correlationId in your logger
    const log = createLogger({
      worker: 'receiving-worker',
      correlationId: chain.correlationId,
      traceId: chain.traceId,
    });
  }
};
```

## AI Gateway Integration

If you route AI calls through [Cloudflare AI Gateway](https://developers.cloudflare.com/ai-gateway/), the SDK can automatically detect the provider, model, and track usage per model.

### Basic Usage

```typescript
import { createAIGatewayFetch } from '@littlebearapps/platform-consumer-sdk';

const tracked = withFeatureBudget(env, 'myapp:ai:generate', { ctx });
const aiFetch = createAIGatewayFetch(tracked);

const response = await aiFetch(
  'https://gateway.ai.cloudflare.com/v1/ACCOUNT/my-gateway/google-ai-studio/v1/models/gemini-2.5-flash:generateContent',
  {
    method: 'POST',
    body: JSON.stringify({
      contents: [{ parts: [{ text: 'Summarise this document' }] }],
    }),
  }
);

// Automatically tracked:
//   aiRequests += 1
//   aiModelCounts['google-ai-studio/gemini-2.5-flash'] += 1
```

### Body Parsing (for OpenAI/Anthropic/DeepSeek)

Some providers put the model name in the request body, not the URL. Use `createAIGatewayFetchWithBodyParsing` for more accurate model tracking:

```typescript
import { createAIGatewayFetchWithBodyParsing } from '@littlebearapps/platform-consumer-sdk';

const aiFetch = createAIGatewayFetchWithBodyParsing(tracked);

const response = await aiFetch(
  'https://gateway.ai.cloudflare.com/v1/ACCOUNT/my-gateway/openai/v1/chat/completions',
  {
    method: 'POST',
    body: JSON.stringify({ model: 'gpt-4o', messages: [...] }),
  }
);
// Tracked: aiModelCounts['openai/gpt-4o'] += 1
```

### Supported Providers

`google-ai-studio` · `openai` · `deepseek` · `anthropic` · `workers-ai` · `azure-openai` · `bedrock` · `groq` · `mistral` · `perplexity`

Non-AI Gateway URLs pass through unchanged with no tracking overhead.

### URL Parsing Utility

```typescript
import { parseAIGatewayUrl } from '@littlebearapps/platform-consumer-sdk';

const info = parseAIGatewayUrl(
  'https://gateway.ai.cloudflare.com/v1/abc123/my-gw/openai/v1/chat/completions'
);
// {
//   provider: 'openai',
//   model: null,          // Model is in body for OpenAI
//   accountId: 'abc123',
//   gatewayId: 'my-gw'
// }
```

## Timeout Utilities

### Basic Timeout

Wrap any async operation with a timeout:

```typescript
import { withTimeout, DEFAULT_TIMEOUTS } from '@littlebearapps/platform-consumer-sdk';

const result = await withTimeout(
  () => fetchExternalAPI(url),
  DEFAULT_TIMEOUTS.medium, // 15 seconds
  'external-api-call'
);
```

Throws `TimeoutError` with `operation`, `timeoutMs`, and `actualMs` properties.

### Timeout Constants

```typescript
DEFAULT_TIMEOUTS.short  // 5,000ms  (5 seconds)
DEFAULT_TIMEOUTS.medium // 15,000ms (15 seconds)
DEFAULT_TIMEOUTS.long   // 30,000ms (30 seconds)
DEFAULT_TIMEOUTS.max    // 60,000ms (60 seconds)
```

### Tracked Timeout (Reports to Telemetry)

Reports timeout errors to the Platform telemetry automatically:

```typescript
import { withTrackedTimeout } from '@littlebearapps/platform-consumer-sdk';

const tracked = withFeatureBudget(env, 'myapp:api:main', { ctx });
const result = await withTrackedTimeout(tracked, () => fetchData(), 10000, 'fetch-data');
// On timeout: reports TIMEOUT error category + TIMEOUT_FETCH-DATA error code
```

### Handler-Level Timeout

Wrap an entire fetch handler to return 504 if it exceeds a duration:

```typescript
import { withRequestTimeout } from '@littlebearapps/platform-consumer-sdk';

const handler = async (request: Request, env: Env, ctx: ExecutionContext) => {
  // Your handler logic
  return new Response('OK');
};

export default {
  fetch: withRequestTimeout(handler, 30000, 'main-handler'),
  // Returns 504 Gateway Timeout if handler exceeds 30 seconds
};
```

## Error Categorisation

The SDK provides consistent error classification across all workers:

```typescript
import { categoriseError } from '@littlebearapps/platform-consumer-sdk';

const category = categoriseError(error);
// Returns one of 11 categories
```

| Category | When It's Used |
|----------|---------------|
| `VALIDATION` | Input validation failures |
| `NETWORK` | Network connectivity issues |
| `CIRCUIT_BREAKER` | Budget exhausted or kill switch active |
| `INTERNAL` | Unexpected internal errors |
| `AUTH` | Authentication/authorisation failures |
| `RATE_LIMIT` | Rate limiting from external APIs |
| `D1_ERROR` | D1 database errors |
| `KV_ERROR` | KV namespace errors |
| `QUEUE_ERROR` | Queue send/receive errors |
| `EXTERNAL_API` | Third-party API failures |
| `TIMEOUT` | Operation timeouts |

### Error Tracking in Telemetry

```typescript
import { withErrorTracking, trackError, reportError } from '@littlebearapps/platform-consumer-sdk';

// Option 1: Wrap a function (auto-catches and categorises errors)
const result = await withErrorTracking(tracked, 'fetch-users', async () => {
  return await tracked.DB.prepare('SELECT * FROM users LIMIT 100').all();
});

// Option 2: Manual tracking
try {
  await riskyOperation();
} catch (error) {
  trackError(tracked, error as Error);    // Adds to telemetry context
  reportError(tracked, error as Error);   // Logs + adds to telemetry
}
```

### Error Count Helpers

```typescript
import { hasErrors, getErrorCount } from '@littlebearapps/platform-consumer-sdk';

if (hasErrors(tracked)) {
  console.log(`${getErrorCount(tracked)} errors during this request`);
}
```

## Retry with Exponential Backoff

```typescript
import { withExponentialBackoff } from '@littlebearapps/platform-consumer-sdk/retry';

const result = await withExponentialBackoff(
  () => fetchUnreliableAPI(url),
  3  // attempts (default)
);
```

**Timing**: 1st attempt immediate, 2nd after 100ms, 3rd after 200ms. Maximum backoff capped at 1,000ms. Re-throws the last error on exhaustion.

## Putting It All Together

A fully observable worker:

```typescript
import {
  withFeatureBudget,
  completeTracking,
  CircuitBreakerError,
  createLoggerFromRequest,
  createTraceContext,
  createTracedFetch,
  startSpan,
  endSpan,
  failSpan,
  withTrackedTimeout,
} from '@littlebearapps/platform-consumer-sdk';
import { createAIGatewayFetchWithBodyParsing } from '@littlebearapps/platform-consumer-sdk';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const tracked = withFeatureBudget(env, 'myapp:api:main', { ctx });
    const log = createLoggerFromRequest(request, env, 'my-worker', 'myapp:api:main');
    const traceCtx = createTraceContext(request, env);

    const span = startSpan(traceCtx, 'handle-request');
    try {
      log.info('Request received', { path: new URL(request.url).pathname });

      // Database query with timeout
      const users = await withTrackedTimeout(
        tracked,
        () => tracked.DB.prepare('SELECT * FROM users LIMIT 100').all(),
        5000,
        'db-query'
      );

      // AI call through gateway with body parsing
      const aiFetch = createAIGatewayFetchWithBodyParsing(tracked);
      const summary = await log.timed('ai-summary', () =>
        aiFetch('https://gateway.ai.cloudflare.com/v1/ACCT/gw/openai/v1/chat/completions', {
          method: 'POST',
          body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: 'Summarise' }] }),
        })
      );

      endSpan(span);
      return Response.json({ users: users.results });
    } catch (e) {
      failSpan(span, e as Error);
      if (e instanceof CircuitBreakerError) {
        log.warn('Circuit breaker tripped', e);
        return Response.json({ error: 'Temporarily unavailable' }, { status: 503 });
      }
      log.error('Request failed', e as Error);
      return Response.json({ error: 'Internal error' }, { status: 500 });
    } finally {
      ctx.waitUntil(completeTracking(tracked));
    }
  }
};
```

## Further Reading

- [Consumer SDK Advanced Features](../consumer-sdk/advanced.md) — Full API reference for all observability exports
- [Telemetry Pipeline](../consumer-sdk/telemetry.md) — How metrics flow from SDK to Analytics Engine
- [Health Monitoring & Heartbeats](health-monitoring.md) — Health checks, Gatus heartbeats, budget alerts
- [Consumer SDK Troubleshooting](../consumer-sdk/troubleshooting.md) — Common issues
