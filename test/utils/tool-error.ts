import assert from "node:assert/strict";

/**
 * Awaits a tools/call and asserts it came back as an `isError: true` tool result
 * (not a JSON-RPC error). Returns the error text.
 */
export async function expectToolError(call: Promise<unknown>, pattern: RegExp): Promise<string> {
  const result = (await call) as { isError?: boolean; content?: Array<{ text?: string }> };
  assert.equal(
    result?.isError,
    true,
    `expected an isError tool result, got ${JSON.stringify(result)}`
  );
  const text = result.content?.[0]?.text ?? "";
  assert.match(text, pattern);
  return text;
}
