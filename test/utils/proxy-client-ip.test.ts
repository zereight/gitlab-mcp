import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ipKeyGenerator } from "express-rate-limit";
import { normalizeProxyClientIpForRateLimit } from "../../utils/proxy-client-ip.js";

function rateLimitKeyFromForwardedIp(ip: string): string {
  return ipKeyGenerator(normalizeProxyClientIpForRateLimit(ip));
}

describe("When normalizeProxyClientIpForRateLimit runs", () => {
  describe("with proxy-forwarded client addresses", () => {
    test("should strip IPv4 ports before ipKeyGenerator accepts the address", () => {
      const key = rateLimitKeyFromForwardedIp("160.79.106.36:38914");

      assert.equal(key, "160.79.106.36");
    });

    test("should strip bracketed IPv6 ports before ipKeyGenerator accepts the address", () => {
      const key = rateLimitKeyFromForwardedIp("[2001:db8::1]:5678");

      assert.equal(key, "2001:db8::/56");
    });

    test("should strip brackets from bracketed IPv6 addresses without ports", () => {
      const key = rateLimitKeyFromForwardedIp("[2001:db8::1]");

      assert.equal(key, "2001:db8::/56");
    });

    test("should leave plain IPv4 and IPv6 addresses unchanged", () => {
      assert.equal(rateLimitKeyFromForwardedIp("1.2.3.4"), "1.2.3.4");
      assert.equal(rateLimitKeyFromForwardedIp("2001:db8::1"), "2001:db8::/56");
      assert.equal(rateLimitKeyFromForwardedIp("::1"), "::/56");
    });
  });
});
