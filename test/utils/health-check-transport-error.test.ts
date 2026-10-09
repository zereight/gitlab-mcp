import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { classifyHealthCheckTransportError } from "../../utils/health-check-transport-error.js";

const TLS_CODES_WITHOUT_PREFIX = [
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "UNABLE_TO_GET_ISSUER_CERT",
  "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
  "SELF_SIGNED_CERT_IN_CHAIN",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
];

describe("When classifyHealthCheckTransportError runs", () => {
  describe("with a TLS code on the error", () => {
    test("should classify known OpenSSL verify failures as tls", () => {
      for (const code of TLS_CODES_WITHOUT_PREFIX) {
        const result = classifyHealthCheckTransportError({
          message: "certificate verify failed",
          code,
        });
        assert.equal(result.kind, "tls");
        assert.equal(result.code, code);
      }
    });

    test("should tell the user which CA env vars must include intermediates", () => {
      const result = classifyHealthCheckTransportError({
        message: "unable to verify the first certificate",
        code: "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
      });

      assert.match(result.hint ?? "", /NODE_EXTRA_CA_CERTS/);
      assert.match(result.hint ?? "", /GITLAB_CA_CERT_PATH/);
      assert.match(result.hint ?? "", /intermediate/i);
    });
  });

  describe("with a TLS code on the cause", () => {
    test("should read cause.code when the outer error has no code", () => {
      const result = classifyHealthCheckTransportError({
        name: "TypeError",
        message: "fetch failed",
        cause: { message: "self-signed certificate", code: "DEPTH_ZERO_SELF_SIGNED_CERT" },
      });

      assert.equal(result.kind, "tls");
      assert.equal(result.code, "DEPTH_ZERO_SELF_SIGNED_CERT");
    });
  });

  describe("with a TLS code prefix", () => {
    test("should classify CERT_ codes as tls", () => {
      const result = classifyHealthCheckTransportError({
        message: "certificate has expired",
        code: "CERT_HAS_EXPIRED",
      });

      assert.equal(result.kind, "tls");
      assert.equal(result.code, "CERT_HAS_EXPIRED");
    });

    test("should classify ERR_TLS_ codes as tls", () => {
      const result = classifyHealthCheckTransportError({
        message: "hostname mismatch",
        errno: "ERR_TLS_CERT_ALTNAME_INVALID",
      });

      assert.equal(result.kind, "tls");
      assert.equal(result.code, "ERR_TLS_CERT_ALTNAME_INVALID");
    });

    test("should classify ERR_SSL_ codes as tls", () => {
      const result = classifyHealthCheckTransportError({
        message: "ssl handshake failed",
        cause: { code: "ERR_SSL_DECRYPTION_FAILED_OR_BAD_RECORD_MAC", message: "ssl" },
      });

      assert.equal(result.kind, "tls");
      assert.equal(result.code, "ERR_SSL_DECRYPTION_FAILED_OR_BAD_RECORD_MAC");
    });
  });

  describe("with a DNS code", () => {
    test("should classify ENOTFOUND on error.code as dns", () => {
      const result = classifyHealthCheckTransportError({
        message: "getaddrinfo ENOTFOUND gitlab.example",
        code: "ENOTFOUND",
      });

      assert.equal(result.kind, "dns");
      assert.equal(result.code, "ENOTFOUND");
    });

    test("should classify EAI_AGAIN on cause.code as dns", () => {
      const result = classifyHealthCheckTransportError({
        message: "fetch failed",
        cause: { message: "getaddrinfo EAI_AGAIN gitlab.example", code: "EAI_AGAIN" },
      });

      assert.equal(result.kind, "dns");
      assert.equal(result.code, "EAI_AGAIN");
    });
  });

  describe("with a timeout signal", () => {
    test("should classify ETIMEDOUT as timeout", () => {
      const result = classifyHealthCheckTransportError({
        message: "connect ETIMEDOUT",
        code: "ETIMEDOUT",
      });

      assert.equal(result.kind, "timeout");
      assert.equal(result.code, "ETIMEDOUT");
    });

    test("should classify UND_ERR_CONNECT_TIMEOUT on the cause as timeout", () => {
      const result = classifyHealthCheckTransportError({
        message: "fetch failed",
        cause: { message: "Connect Timeout Error", code: "UND_ERR_CONNECT_TIMEOUT" },
      });

      assert.equal(result.kind, "timeout");
      assert.equal(result.code, "UND_ERR_CONNECT_TIMEOUT");
    });

    test("should classify an AbortError with no code as timeout", () => {
      const result = classifyHealthCheckTransportError({
        name: "AbortError",
        message: "The operation was aborted",
      });

      assert.equal(result.kind, "timeout");
      assert.equal(result.code, null);
    });

    test("should classify a TimeoutError cause with no code as timeout", () => {
      const result = classifyHealthCheckTransportError({
        name: "TypeError",
        message: "fetch failed",
        cause: { name: "TimeoutError", message: "The operation was aborted due to timeout" },
      });

      assert.equal(result.kind, "timeout");
      assert.equal(result.code, null);
    });

    test("should classify a request-timeout FetchError as timeout", () => {
      const result = classifyHealthCheckTransportError({
        name: "FetchError",
        type: "request-timeout",
        message: "network timeout at: https://gitlab.example/api/v4/user",
      });

      assert.equal(result.kind, "timeout");
      assert.equal(result.code, null);
    });
  });

  describe("with a network failure", () => {
    test("should classify ECONNREFUSED as network", () => {
      const result = classifyHealthCheckTransportError({
        name: "TypeError",
        message: "fetch failed",
        cause: {
          message: "connect ECONNREFUSED 127.0.0.1:9",
          code: "ECONNREFUSED",
          errno: -111,
        },
      });

      assert.equal(result.kind, "network");
      assert.equal(result.code, "ECONNREFUSED");
      assert.equal(result.message.includes("ECONNREFUSED"), true);
    });

    test("should classify an unknown error as network with a null code", () => {
      const result = classifyHealthCheckTransportError(new Error("socket hang up"));

      assert.equal(result.kind, "network");
      assert.equal(result.code, null);
      assert.equal(result.message, "socket hang up");
    });
  });

  describe("with both error.code and cause.code", () => {
    test("should prefer error.code over cause.code", () => {
      const result = classifyHealthCheckTransportError({
        message: "outer",
        code: "ENOTFOUND",
        cause: { code: "ECONNREFUSED", message: "inner" },
      });

      assert.equal(result.kind, "dns");
      assert.equal(result.code, "ENOTFOUND");
    });

    test("should prefer error.code over errno", () => {
      const result = classifyHealthCheckTransportError({
        message: "timeout",
        code: "ETIMEDOUT",
        errno: "ENOTFOUND",
      });

      assert.equal(result.kind, "timeout");
      assert.equal(result.code, "ETIMEDOUT");
    });
  });

  describe("with a node-fetch errno and no code", () => {
    test("should classify the errno string", () => {
      const result = classifyHealthCheckTransportError({
        name: "FetchError",
        message: "request to https://gitlab.example/api/v4/user failed",
        errno: "EAI_AGAIN",
      });

      assert.equal(result.kind, "dns");
      assert.equal(result.code, "EAI_AGAIN");
    });
  });

  describe("with credentials or a stack in the thrown value", () => {
    test("should redact secrets and keep the stack out of the message", () => {
      const result = classifyHealthCheckTransportError({
        code: "ECONNREFUSED",
        message:
          "request to https://oauth:glpat-supersecret@gitlab.example/api/v4/user?private_token=glpat-supersecret failed",
        stack: "Error: leaked\n    at /tmp/secret.js:1:1",
        cause: {
          message: "Authorization: Bearer glpat-supersecret",
          stack: "at /tmp/secret.js:1:1",
        },
      });

      assert.equal(result.message.includes("glpat-supersecret"), false);
      assert.equal(result.message.includes("secret.js"), false);
      assert.equal(result.message.includes("Bearer glpat"), false);
    });
  });

  describe("with a non-tls failure", () => {
    test("should omit the CA hint", () => {
      const result = classifyHealthCheckTransportError({
        message: "connect ECONNREFUSED 127.0.0.1:9",
        code: "ECONNREFUSED",
      });

      assert.equal("hint" in result, false);
    });
  });
});
