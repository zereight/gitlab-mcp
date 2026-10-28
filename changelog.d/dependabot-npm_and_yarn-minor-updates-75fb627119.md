### Security

- HTTP `/mcp` and `/messages` JSON parse failures no longer write the raw request body to stderr under Express 5.3. The response is a JSON-RPC parse error (`-32700`) instead of Express's default text/HTML.
