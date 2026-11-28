import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { CookieJar, parse as parseCookie } from "tough-cookie";
import {
  type CookieJarWarnLogger,
  isIpCookieDomain,
  loadNetscapeCookies,
} from "../../utils/netscape-cookie-jar.js";

const SECRET = "s3cr3t-cookie-value-must-not-be-logged-7f2a9c";
const PUBLIC_SUFFIX_ERROR = /Cookie has domain set to a public suffix/;

interface WarnCall {
  obj: Record<string, unknown>;
  msg: string;
}

function fakeLogger(): CookieJarWarnLogger & { calls: WarnCall[] } {
  const calls: WarnCall[] = [];
  return {
    calls,
    warn: (obj, msg) => {
      calls.push({ obj, msg });
    },
  };
}

function netscapeLine(domain: string, name: string, value: string, secure = "TRUE"): string {
  return [domain, "TRUE", "/", secure, "0", name, value].join("\t");
}

/** Copy of the createCookieJar loop on main (27d976f7), before this change. */
function loadLikeMain(content: string, jar: CookieJar): void {
  for (let line of content.split("\n")) {
    if (line.startsWith("#HttpOnly_")) {
      line = line.slice(10);
    }
    if (line.startsWith("#") || !line.trim()) {
      continue;
    }
    const parts = line.split("\t");
    if (parts.length >= 7) {
      const [domain, , cookiePath, secure, expires, name, value] = parts;
      const secureFlag = secure === "TRUE" ? "; Secure" : "";
      const expiresFlag =
        expires === "0"
          ? ""
          : `; Expires=${new Date(Number.parseInt(expires, 10) * 1000).toUTCString()}`;
      const cookieStr = `${name}=${value}; Domain=${domain}; Path=${cookiePath}${secureFlag}${expiresFlag}`;
      const cookie = parseCookie(cookieStr);
      if (cookie) {
        const url = `${secure === "TRUE" ? "https" : "http"}://${domain.startsWith(".") ? domain.slice(1) : domain}`;
        jar.setCookieSync(cookie, url);
      }
    }
  }
}

/** Jar contents without values or per-jar timestamps/counters. */
function cookieShape(jar: CookieJar) {
  const serialized = jar.serializeSync();
  assert.ok(serialized, "jar should serialize synchronously");
  return serialized.cookies
    .map(c => ({
      key: c.key,
      domain: c.domain,
      path: c.path,
      secure: c.secure ?? false,
      httpOnly: c.httpOnly ?? false,
      hostOnly: c.hostOnly,
      expires: c.expires ?? "Infinity",
    }))
    .sort((a, b) => `${a.domain}|${a.key}`.localeCompare(`${b.domain}|${b.key}`));
}

function cookieKeys(jar: CookieJar, url: string): string[] {
  return jar
    .getCookiesSync(url)
    .map(c => c.key)
    .sort();
}

function assertSecretNotLogged(calls: WarnCall[]): void {
  assert.ok(!JSON.stringify(calls).includes(SECRET), "cookie value must not appear in log calls");
}

describe("isIpCookieDomain", () => {
  test("detects IPv4 with and without a leading dot", () => {
    assert.equal(isIpCookieDomain("127.0.0.1"), true);
    assert.equal(isIpCookieDomain(".127.0.0.1"), true);
    assert.equal(isIpCookieDomain("192.168.1.10"), true);
  });

  test("detects IPv6 with or without brackets and a leading dot", () => {
    assert.equal(isIpCookieDomain("[::1]"), true);
    assert.equal(isIpCookieDomain("::1"), true);
    assert.equal(isIpCookieDomain(".[::1]"), true);
    assert.equal(isIpCookieDomain("[2001:db8::1]"), true);
  });

  test("returns false for hostnames", () => {
    assert.equal(isIpCookieDomain("gitlab.example.com"), false);
    assert.equal(isIpCookieDomain(".gitlab.example.com"), false);
    assert.equal(isIpCookieDomain("localhost"), false);
    assert.equal(isIpCookieDomain("[gitlab.example.com]"), false);
  });
});

describe("loadNetscapeCookies", () => {
  describe("with hostname domains", () => {
    test("loads hostname and leading-dot hostname cookies without a warning", () => {
      const content = [
        "# Netscape HTTP Cookie File",
        netscapeLine("gitlab.example.com", "_gitlab_session", SECRET),
        netscapeLine(".gitlab.example.com", "remember_user_token", SECRET),
        "",
      ].join("\n");
      const jar = new CookieJar();
      const log = fakeLogger();

      loadNetscapeCookies(content, jar, log);

      assert.deepEqual(cookieKeys(jar, "https://gitlab.example.com"), [
        "_gitlab_session",
        "remember_user_token",
      ]);
      assert.equal(log.calls.length, 0);
    });

    test("produces the same jar contents as main for a hostname-only file", () => {
      const content = [
        "# Netscape HTTP Cookie File",
        "",
        netscapeLine("gitlab.example.com", "_gitlab_session", SECRET),
        netscapeLine(".gitlab.example.com", "remember_user_token", SECRET),
        `#HttpOnly_${netscapeLine("gitlab.example.com", "http_only", SECRET)}`,
        [".example.com", "TRUE", "/api", "FALSE", "4102444800", "plain", SECRET].join("\t"),
        "too\tfew\tcolumns",
      ].join("\n");
      const jar = new CookieJar();
      const mainJar = new CookieJar();
      const log = fakeLogger();

      loadNetscapeCookies(content, jar, log);
      loadLikeMain(content, mainJar);

      assert.equal(cookieShape(jar).length, 4);
      assert.deepEqual(cookieShape(jar), cookieShape(mainJar));
      assert.equal(log.calls.length, 0);
    });
  });

  describe("with IPv4 domains", () => {
    for (const domain of ["127.0.0.1", "192.168.1.10", ".127.0.0.1"]) {
      test(`throws like main and warns with name and domain for ${domain}`, () => {
        const content = netscapeLine(domain, "_gitlab_session", SECRET);
        const jar = new CookieJar();
        const log = fakeLogger();

        assert.throws(() => loadNetscapeCookies(content, jar, log), PUBLIC_SUFFIX_ERROR);
        assert.throws(() => loadLikeMain(content, new CookieJar()), PUBLIC_SUFFIX_ERROR);

        assert.equal(log.calls.length, 1);
        assert.deepEqual(log.calls[0].obj, { cookieName: "_gitlab_session", domain });
        assert.match(log.calls[0].msg, /IP address/);
        assertSecretNotLogged(log.calls);
        assert.equal(cookieShape(jar).length, 0);
      });
    }
  });

  describe("with a mixed file", () => {
    test("still throws at the IPv4 cookie, so later hostname cookies are not loaded", () => {
      const content = [
        netscapeLine("gitlab.example.com", "first", SECRET),
        netscapeLine("127.0.0.1", "ip_cookie", SECRET),
        netscapeLine("gitlab.example.com", "third", SECRET),
      ].join("\n");
      const jar = new CookieJar();
      const mainJar = new CookieJar();
      const log = fakeLogger();

      assert.throws(() => loadNetscapeCookies(content, jar, log), PUBLIC_SUFFIX_ERROR);
      assert.throws(() => loadLikeMain(content, mainJar), PUBLIC_SUFFIX_ERROR);

      assert.deepEqual(cookieKeys(jar, "https://gitlab.example.com"), ["first"]);
      assert.deepEqual(cookieShape(jar), cookieShape(mainJar));
      assert.equal(log.calls.length, 1);
      assert.deepEqual(log.calls[0].obj, { cookieName: "ip_cookie", domain: "127.0.0.1" });
      assertSecretNotLogged(log.calls);
    });
  });

  describe("with an IPv6 domain", () => {
    test("does not throw, the cookie is not returned, and a warning is logged", () => {
      const content = netscapeLine("[::1]", "_gitlab_session", SECRET);
      const jar = new CookieJar();
      const mainJar = new CookieJar();
      const log = fakeLogger();

      loadNetscapeCookies(content, jar, log);
      loadLikeMain(content, mainJar);

      // setCookieSync stores it, but it is never returned for the IPv6 URL.
      assert.equal(cookieShape(jar).length, 1);
      assert.deepEqual(jar.getCookiesSync("https://[::1]"), []);
      assert.deepEqual(mainJar.getCookiesSync("https://[::1]"), []);
      assert.deepEqual(cookieShape(jar), cookieShape(mainJar));
      assert.equal(log.calls.length, 1);
      assert.deepEqual(log.calls[0].obj, { cookieName: "_gitlab_session", domain: "[::1]" });
      assertSecretNotLogged(log.calls);
    });
  });
});
