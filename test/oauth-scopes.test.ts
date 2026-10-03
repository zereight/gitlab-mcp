import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { getOAuthScopes } from "../oauth.js";

describe("When requesting OAuth scopes", () => {
  describe("with readonly permission mode", () => {
    test("should request only read_api", () => {
      assert.deepEqual(getOAuthScopes("readonly"), ["read_api"]);
    });
  });

  describe("with modify permission mode", () => {
    test("should request api", () => {
      assert.deepEqual(getOAuthScopes("modify"), ["api"]);
    });
  });

  describe("with full permission mode", () => {
    test("should request api", () => {
      assert.deepEqual(getOAuthScopes("full"), ["api"]);
    });
  });
});
