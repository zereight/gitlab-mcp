/**
 * Unit tests for isAuthInvalidTokenResponse.
 *
 * Pure-function tests — no env vars or external services needed.
 * Importing ../oauth.js only constructs a logger; it does not touch the
 * network or start any server.
 */

import { describe, test } from "node:test";
import assert from "node:assert";
import { isAuthInvalidTokenResponse } from "../oauth.js";

describe("isAuthInvalidTokenResponse", () => {
  test("400 invalid_grant is auth-invalid", () => {
    assert.strictEqual(isAuthInvalidTokenResponse(400, '{"error":"invalid_grant"}'), true);
  });

  test("400 invalid_token is auth-invalid", () => {
    assert.strictEqual(isAuthInvalidTokenResponse(400, '{"error":"invalid_token"}'), true);
  });

  test("401 invalid_grant is auth-invalid", () => {
    assert.strictEqual(isAuthInvalidTokenResponse(401, '{"error":"invalid_grant"}'), true);
  });

  test("400 invalid_client is not auth-invalid (config error)", () => {
    assert.strictEqual(isAuthInvalidTokenResponse(400, '{"error":"invalid_client"}'), false);
  });

  test("400 invalid_request is not auth-invalid (config error)", () => {
    assert.strictEqual(isAuthInvalidTokenResponse(400, '{"error":"invalid_request"}'), false);
  });

  test("500 server_error is not auth-invalid (transient)", () => {
    assert.strictEqual(isAuthInvalidTokenResponse(500, '{"error":"server_error"}'), false);
  });

  test("429 is not auth-invalid (rate limited)", () => {
    assert.strictEqual(isAuthInvalidTokenResponse(429, '{"error":"invalid_grant"}'), false);
  });

  test("non-JSON body is not auth-invalid", () => {
    assert.strictEqual(isAuthInvalidTokenResponse(400, "gateway timeout"), false);
  });
});
