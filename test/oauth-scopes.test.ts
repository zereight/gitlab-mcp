import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { getOAuthScopes, oauthTokenNeedsReauthorization } from "../oauth.js";

describe("When a stored OAuth grant is reused", () => {
  describe("with the same scopes", () => {
    test("should keep the token", () => {
      assert.equal(oauthTokenNeedsReauthorization(["api"], ["api"]), false);
    });
  });

  describe("with the same scopes in a different order", () => {
    test("should keep the token", () => {
      assert.equal(oauthTokenNeedsReauthorization(["read_user", "api"], ["api", "read_user"]), false);
    });
  });

  describe("with an extra non-write scope", () => {
    test("should keep the token", () => {
      assert.equal(oauthTokenNeedsReauthorization(["api", "read_user"], ["api"]), false);
    });
  });

  describe("with an extra read_repository scope", () => {
    test("should keep the token", () => {
      assert.equal(
        oauthTokenNeedsReauthorization(["read_api", "read_repository"], ["read_api"]),
        false
      );
    });
  });

  describe("with an extra write_repository scope", () => {
    test("should require a new authorization", () => {
      assert.equal(
        oauthTokenNeedsReauthorization(["read_api", "write_repository"], ["read_api"]),
        true
      );
    });
  });

  describe("with an extra sudo scope", () => {
    test("should require a new authorization", () => {
      assert.equal(oauthTokenNeedsReauthorization(["read_api", "sudo"], ["read_api"]), true);
    });
  });

  describe("with an unapproved scope", () => {
    test("should require a new authorization", () => {
      assert.equal(
        oauthTokenNeedsReauthorization(["read_api", "not_a_gitlab_scope"], ["read_api"]),
        true
      );
    });
  });

  describe("with write_repository beside api", () => {
    test("should require a new authorization", () => {
      assert.equal(oauthTokenNeedsReauthorization(["api", "write_repository"], ["api"]), true);
    });
  });

  describe("with api still granted in readonly mode", () => {
    test("should require a new authorization", () => {
      assert.equal(oauthTokenNeedsReauthorization(["read_api", "api"], ["read_api"]), true);
    });
  });

  describe("with a different scope", () => {
    test("should require a new authorization", () => {
      assert.equal(oauthTokenNeedsReauthorization(["api"], ["read_api"]), true);
    });
  });

  describe("with no stored scopes", () => {
    test("should keep the legacy token", () => {
      assert.equal(oauthTokenNeedsReauthorization(undefined, ["api"]), false);
    });
  });

  describe("with no stored scopes while readonly mode wants read_api", () => {
    test("should keep the legacy token", () => {
      assert.equal(oauthTokenNeedsReauthorization(undefined, ["read_api"]), false);
    });
  });

  describe("with an empty scope list", () => {
    test("should keep the legacy token", () => {
      assert.equal(oauthTokenNeedsReauthorization([], ["read_api"]), false);
    });
  });
});

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
