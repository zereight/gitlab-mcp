import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { redactUrlSecretsInText } from "../../utils/redact-url.js";

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
});
