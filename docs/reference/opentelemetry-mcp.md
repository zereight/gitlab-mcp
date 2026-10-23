# OpenTelemetry MCP semantics

This page records the [OpenTelemetry GenAI MCP conventions](https://github.com/open-telemetry/semantic-conventions-genai/blob/main/docs/gen-ai/mcp.md) this server will follow **if** tracing is added later.

**This package does not ship an OpenTelemetry SDK.** Local stdio stays quiet: logs go to stderr, and stdout stays JSON-RPC. Do not set `OTEL_*` for a default desktop install.

## Why local stdio is not instrumented

- A stdio MCP server must keep **stdout** as JSON-RPC only. Logs already go to stderr. An OTLP exporter that writes to stdout would break the client handshake.
- Default local installs should not require a collector.
- Remote Streamable HTTP is the right place to add traces later. That work is not in this package yet.

## Conventions to follow later

Status of the spec: **Development**. Use the names below if a future HTTP-only build enables tracing.

### Transport

| MCP transport   | `network.transport` | Other attributes                                           |
| --------------- | ------------------- | ---------------------------------------------------------- |
| stdio           | `pipe`              | No `network.protocol.*`. Never export on stdout.           |
| Streamable HTTP | `tcp` (or `quic`)   | `network.protocol.name=http`                               |
| HTTP with SSE   | `tcp` (or `quic`)   | `network.protocol.name=http`; older `mcp.protocol.version` |

### Span attributes

| Attribute              | When                                                          |
| ---------------------- | ------------------------------------------------------------- |
| `mcp.method.name`      | JSON-RPC method (`initialize`, `tools/list`, `tools/call`, …) |
| `mcp.session.id`       | Session id when the transport has one                         |
| `mcp.protocol.version` | Negotiated MCP protocol version                               |
| `mcp.resource.uri`     | Resource methods only                                         |
| `jsonrpc.request.id`   | Request id                                                    |

Well-known `mcp.method.name` values include `initialize`, `tools/list`, `tools/call`, `resources/list`, `resources/read`, `prompts/list`, `prompts/get`, and `ping`. Prefer those literals over a custom string.

### Context propagation

Propagate W3C Trace Context on `params._meta` ([SEP-414](https://modelcontextprotocol.io/specification/2025-11-25/basic#_meta)): `traceparent`, `tracestate`, and optional `baggage`. Write those keys **unprefixed**, even though other `_meta` keys are DNS-prefixed.

The MCP client span is the parent of the MCP server span on every transport, including stdio.

### Stdio exporter rule

If a future build enables OpenTelemetry, exporters must use stderr, a file, or a network collector. **Never write telemetry to stdout on the stdio transport.**

### Environment variables (not implemented)

Do not add `OTEL_SDK_DISABLED`, `OTEL_EXPORTER_OTLP_ENDPOINT`, or other `OTEL_*` variables to a local `mcp.json`. They have no effect in this package. A later HTTP-only implementation may honor them; that change would be a separate PR.

## Out of scope

- No demo GIF for the 30-second install path (asset cost). The official listing and one-liner live in the README.
- No forced tracing dependency for `npx` / Homebrew / local IDE stdio.
