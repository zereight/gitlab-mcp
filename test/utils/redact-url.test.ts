import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { redactGitLabUrlCredentials, redactUrlSecretsInText } from "../../utils/redact-url.js";

describe("When redactUrlSecretsInText runs", () => {
  describe("with userinfo", () => {
    it("should replace the user and password", () => {
      assert.equal(
        redactUrlSecretsInText("https://user:pass@gitlab.example/api/v4"),
        "https://[REDACTED]@gitlab.example/api/v4"
      );
    });
  });

  describe("with user-only userinfo", () => {
    it("should replace the username", () => {
      assert.equal(
        redactUrlSecretsInText("https://onlyuser@gitlab.example/api/v4"),
        "https://[REDACTED]@gitlab.example/api/v4"
      );
    });
  });

  describe("with query tokens", () => {
    it("should redact each sensitive parameter and keep the rest", () => {
      assert.equal(
        redactUrlSecretsInText(
          "https://gitlab.example/api/v4?access_token=a&private_token=b&job_token=c&password=d&token=e&page=1"
        ),
        "https://gitlab.example/api/v4?access_token=[REDACTED]&private_token=[REDACTED]&job_token=[REDACTED]&password=[REDACTED]&token=[REDACTED]&page=1"
      );
    });
  });

  describe("with multiple URLs", () => {
    it("should redact credentials in every URL", () => {
      assert.equal(
        redactUrlSecretsInText(
          "https://user:pass@a.example/api/v4, https://b.example/api/v4?token=sekrit"
        ),
        "https://[REDACTED]@a.example/api/v4, https://b.example/api/v4?token=[REDACTED]"
      );
    });
  });

  describe("with a URL that has no secrets", () => {
    it("should leave the URL unchanged", () => {
      assert.equal(
        redactUrlSecretsInText("https://gitlab.example/api/v4"),
        "https://gitlab.example/api/v4"
      );
    });
  });

  describe("with a percent-encoded query name", () => {
    it("should redact the value and keep the encoded name", () => {
      assert.equal(
        redactUrlSecretsInText("https://gitlab.example/api/v4?access%5Ftoken=sekrit&page=1"),
        "https://gitlab.example/api/v4?access%5Ftoken=[REDACTED]&page=1"
      );
    });
  });

  describe("with a fully encoded token name", () => {
    it("should redact the value and keep the encoded name", () => {
      assert.equal(
        redactUrlSecretsInText("https://gitlab.example/api/v4?%74oken=sekrit"),
        "https://gitlab.example/api/v4?%74oken=[REDACTED]"
      );
    });
  });

  describe("with an encoded name that is not sensitive", () => {
    it("should leave the query unchanged", () => {
      assert.equal(
        redactUrlSecretsInText("https://gitlab.example/api/v4?not%5Ftoken=keep"),
        "https://gitlab.example/api/v4?not%5Ftoken=keep"
      );
    });
  });

  describe("with whitespace inside userinfo", () => {
    it("should redact the user and password", () => {
      assert.equal(
        redactUrlSecretsInText(
          "GITLAB_API_URL contains an invalid URL: https://user:pa ss@gitlab.example:bad/api/v4"
        ),
        "GITLAB_API_URL contains an invalid URL: https://[REDACTED]@gitlab.example:bad/api/v4"
      );
    });
  });

  describe("with a host and a later email", () => {
    it("should leave a numeric port untouched", () => {
      assert.equal(
        redactUrlSecretsInText("https://registry:5000 a@b.com"),
        "https://registry:5000 a@b.com"
      );
    });

    it("should leave a localhost port untouched", () => {
      assert.equal(
        redactUrlSecretsInText("https://localhost:bad a@b.com"),
        "https://localhost:bad a@b.com"
      );
    });

    it("should leave a dotted host untouched", () => {
      assert.equal(
        redactUrlSecretsInText("https://gitlab.example:443 a@b.com"),
        "https://gitlab.example:443 a@b.com"
      );
    });
  });

  describe("with prose after a URL", () => {
    it("should leave the mention unchanged", () => {
      assert.equal(
        redactUrlSecretsInText("see https://gitlab.example/api failed, ping @oncall"),
        "see https://gitlab.example/api failed, ping @oncall"
      );
    });
  });
});

describe("When redactGitLabUrlCredentials runs", () => {
  describe("with a percent-encoded query name", () => {
    it("should redact the value and keep the encoded name", () => {
      assert.equal(
        redactGitLabUrlCredentials("https://gitlab.example/api/v4?access%5Ftoken=sekrit"),
        "https://gitlab.example/api/v4?access%5Ftoken=[REDACTED]"
      );
    });
  });

  describe("with whitespace inside userinfo", () => {
    it("should redact the user and password", () => {
      assert.equal(
        redactGitLabUrlCredentials("https://user:pa ss@gitlab.example:bad/api/v4"),
        "https://[REDACTED]@gitlab.example:bad/api/v4"
      );
    });
  });
});
