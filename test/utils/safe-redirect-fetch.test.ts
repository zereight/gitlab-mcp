import assert from "node:assert/strict";
import http from "node:http";
import type { IncomingHttpHeaders } from "node:http";
import { after, before, describe, test } from "node:test";
import { Agent, fetch as undiciFetch, MockAgent } from "undici";
import {
  fetchWithValidatedRedirects,
  isNonPublicAddress,
  UnsafeRedirectError,
} from "../../utils/safe-redirect-fetch.js";

const dispatcher = new Agent();

/** A public IPv4 literal, so hop checks never depend on DNS resolution. */
const PUBLIC_HOST = "93.184.216.34";

let server: http.Server;
let origin: string;
let serverPort: number;
let secondServer: http.Server;
let secondOrigin: string;
let secondPort: number;
let lastSecondHeaders: IncomingHttpHeaders = {};

/** Hosts the trusted-host predicate has been called with. */
const trustedHostArguments: string[] = [];

function listen(target: http.Server): Promise<number> {
  return new Promise(resolve => {
    target.listen(0, "127.0.0.1", () => {
      const address = target.address();
      if (!address || typeof address === "string") throw new Error("no port");
      resolve(address.port);
    });
  });
}

type RecordedCall = { url: string; headers: Record<string, string> };

/**
 * A fetch stub that answers the first request with a redirect and every later one
 * with a body, recording the headers used on each hop. Injected so hop policy can
 * be asserted without reaching the network.
 */
function stubRedirectFetch(location: string | null, calls: RecordedCall[]): typeof undiciFetch {
  const impl = async (input: string | URL, init?: { headers?: Record<string, string> }) => {
    calls.push({ url: String(input), headers: { ...(init?.headers ?? {}) } });
    if (calls.length === 1 && location) {
      return new Response(null, { status: 302, headers: { location } });
    }
    return new Response("payload", { status: 200 });
  };
  return impl as unknown as typeof undiciFetch;
}

/**
 * A fetch stub that walks a list of redirect locations: call N answers with
 * `locations[N - 1]` and the call after the last location returns a body. Used to
 * assert the header policy on chains longer than one hop.
 */
function stubRedirectChain(locations: string[], calls: RecordedCall[]): typeof undiciFetch {
  const impl = async (input: string | URL, init?: { headers?: Record<string, string> }) => {
    calls.push({ url: String(input), headers: { ...(init?.headers ?? {}) } });
    const location = locations[calls.length - 1];
    if (location) {
      return new Response(null, { status: 302, headers: { location } });
    }
    return new Response("payload", { status: 200 });
  };
  return impl as unknown as typeof undiciFetch;
}

/**
 * Pass one injected client for both the hops that carry the credentials and the ones the
 * helper strips. The stripped hops default to plain `undici`, so injecting only
 * `fetchImpl` in a test would send the hop it wants to inspect to the network.
 */
function sameClientForEveryHop(stub: typeof undiciFetch) {
  return { fetchImpl: stub, unauthenticatedFetchImpl: stub };
}

describe("safe redirect fetch", () => {
  before(async () => {
    server = http.createServer((req, res) => {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      switch (url.pathname) {
        case "/file":
          res.writeHead(200, { "content-type": "application/octet-stream" });
          res.end("payload");
          return;
        case "/same-origin-redirect":
          res.writeHead(302, { location: "/file" });
          res.end();
          return;
        case "/cross-origin-redirect":
          res.writeHead(302, { location: `${secondOrigin}/file` });
          res.end();
          return;
        case "/loopback-redirect":
          res.writeHead(302, { location: "http://127.0.0.1:1/file" });
          res.end();
          return;
        case "/metadata-redirect":
          res.writeHead(302, { location: "http://169.254.169.254/latest/meta-data/" });
          res.end();
          return;
        case "/mapped-metadata-redirect":
          res.writeHead(302, { location: "http://[::ffff:169.254.169.254]/latest/meta-data/" });
          res.end();
          return;
        case "/mapped-loopback-redirect":
          res.writeHead(302, { location: "http://[::ffff:7f00:1]:1/file" });
          res.end();
          return;
        case "/dotted-mapped-loopback-redirect":
          res.writeHead(302, { location: "http://[::ffff:127.0.0.1]:1/file" });
          res.end();
          return;
        case "/nat64-metadata-redirect":
          res.writeHead(302, { location: "http://[64:ff9b::a9fe:a9fe]/latest/meta-data/" });
          res.end();
          return;
        case "/file-protocol-redirect":
          res.writeHead(302, { location: "file:///etc/passwd" });
          res.end();
          return;
        case "/loop":
          res.writeHead(302, { location: "/loop" });
          res.end();
          return;
        default:
          res.writeHead(404);
          res.end();
      }
    });

    secondServer = http.createServer((req, res) => {
      lastSecondHeaders = req.headers;
      res.writeHead(200).end("second");
    });

    serverPort = await listen(server);
    secondPort = await listen(secondServer);
    origin = `http://127.0.0.1:${serverPort}`;
    secondOrigin = `http://127.0.0.1:${secondPort}`;
  });

  after(async () => {
    await Promise.all([
      new Promise(resolve => server.close(resolve)),
      new Promise(resolve => secondServer.close(resolve)),
      dispatcher.close(),
    ]);
  });

  const rejectsWith = (promise: () => Promise<unknown>, fragment: string) =>
    assert.rejects(
      promise,
      (error: Error) => error instanceof UnsafeRedirectError && error.message.includes(fragment)
    );

  test("follows a same-origin redirect", async () => {
    const response = await fetchWithValidatedRedirects(`${origin}/same-origin-redirect`, {
      headers: {},
      dispatcher,
    });
    assert.equal(response.status, 200);
    assert.equal(await response.text(), "payload");
  });

  test("refuses a redirect to a loopback address on another origin", async () => {
    await rejectsWith(
      () => fetchWithValidatedRedirects(`${origin}/loopback-redirect`, { headers: {}, dispatcher }),
      "non-public address"
    );
  });

  test("refuses a redirect to the cloud instance metadata address", async () => {
    await rejectsWith(
      () => fetchWithValidatedRedirects(`${origin}/metadata-redirect`, { headers: {}, dispatcher }),
      "169.254.169.254"
    );
  });

  // The URL parser canonicalizes IPv4-mapped hosts to hex (`::ffff:169.254.169.254`
  // becomes `::ffff:a9fe:a9fe`), so the check has to classify parsed bits. These
  // routes exercise the production path: `new URL(location, currentUrl)`.
  for (const [route, address] of [
    ["/mapped-metadata-redirect", "::ffff:a9fe:a9fe"],
    ["/mapped-loopback-redirect", "::ffff:7f00:1"],
    ["/dotted-mapped-loopback-redirect", "::ffff:7f00:1"],
    ["/nat64-metadata-redirect", "64:ff9b::a9fe:a9fe"],
  ] as const) {
    test(`refuses a redirect to the IPv6 form ${route} (${address})`, async () => {
      await rejectsWith(
        () => fetchWithValidatedRedirects(`${origin}${route}`, { headers: {}, dispatcher }),
        "non-public address"
      );
    });
  }

  test("refuses a redirect to a non-http protocol", async () => {
    await rejectsWith(
      () =>
        fetchWithValidatedRedirects(`${origin}/file-protocol-redirect`, {
          headers: {},
          dispatcher,
        }),
      "unsupported protocol"
    );
  });

  test("refuses to follow more redirects than the limit allows", async () => {
    await rejectsWith(
      () =>
        fetchWithValidatedRedirects(`${origin}/loop`, {
          headers: {},
          dispatcher,
          maxRedirects: 2,
        }),
      "Too many redirects"
    );
  });

  test("follows a non-public redirect target when the host:port is trusted", async () => {
    trustedHostArguments.length = 0;
    const response = await fetchWithValidatedRedirects(`${origin}/cross-origin-redirect`, {
      headers: {},
      dispatcher,
      isTrustedRedirectHost: host => {
        trustedHostArguments.push(host);
        return host === `127.0.0.1:${secondPort}`;
      },
    });
    assert.equal(response.status, 200);
    assert.equal(await response.text(), "second");
    // The allowlist is keyed by `URL.host`, so the predicate must receive the port
    // with the host: matching on a bare hostname would never find `:8443` entries.
    assert.deepEqual(trustedHostArguments, [`127.0.0.1:${secondPort}`]);
  });

  test("the URL parser canonicalizes IPv4-mapped literals before the check runs", () => {
    assert.equal(new URL("http://[::ffff:169.254.169.254]/").hostname, "[::ffff:a9fe:a9fe]");
    assert.equal(new URL("http://[::ffff:7f00:1]/").hostname, "[::ffff:7f00:1]");
    assert.equal(new URL("http://[::ffff:127.0.0.1]:1/").hostname, "[::ffff:7f00:1]");
    assert.equal(new URL("http://[64:ff9b::a9fe:a9fe]/").hostname, "[64:ff9b::a9fe:a9fe]");
  });

  test("classifies address ranges", () => {
    for (const address of [
      // IPv4
      "127.0.0.1",
      "10.1.2.3",
      "172.16.0.1",
      "192.168.1.1",
      "169.254.169.254",
      "100.64.0.1",
      "0.0.0.0",
      // IPv6
      "::",
      "::1",
      "fd00::1",
      "fe80::1",
      "fea0::1",
      "febf::1",
      "fec0::1",
      // IPv6 carrying a non-public IPv4 address
      "::ffff:127.0.0.1",
      "::ffff:a9fe:a9fe",
      "::ffff:7f00:1",
      "::ffff:0:127.0.0.1",
      "::7f00:1",
      "64:ff9b::a9fe:a9fe",
      "64:ff9b:1::a9fe:a9fe",
      "2002:a9fe:a9fe::",
      // Not a literal address this helper understands — fail closed
      "[::ffff:a9fe:a9fe]",
      "not-an-address",
    ]) {
      assert.equal(isNonPublicAddress(address), true, `${address} should be non-public`);
    }

    for (const address of [
      "8.8.8.8",
      "1.1.1.1",
      "2606:4700::1111",
      // IPv6 carrying a public IPv4 address
      "::ffff:8.8.8.8",
      "::ffff:808:808",
      "64:ff9b::808:808",
      "2002:0808:0808::",
    ]) {
      assert.equal(isNonPublicAddress(address), false, `${address} should be public`);
    }
  });
});

describe("credential headers across redirect hops", () => {
  const credentials = {
    Accept: "application/octet-stream",
    Authorization: "Bearer secret",
    "Private-Token": "secret",
  };

  test("keeps credentials on a same-origin hop", async () => {
    const calls: RecordedCall[] = [];
    const response = await fetchWithValidatedRedirects("http://127.0.0.1:1/start", {
      headers: credentials,
      fetchImpl: stubRedirectFetch("/file", calls),
    });

    assert.equal(response.status, 200);
    assert.deepEqual(
      calls.map(call => call.url),
      ["http://127.0.0.1:1/start", "http://127.0.0.1:1/file"]
    );
    assert.equal(calls[1].headers.Authorization, "Bearer secret");
    assert.equal(calls[1].headers["Private-Token"], "secret");
  });

  test("drops credential headers on a cross-origin hop to a public host", async () => {
    const calls: RecordedCall[] = [];
    const response = await fetchWithValidatedRedirects("http://127.0.0.1:1/start", {
      headers: credentials,
      ...sameClientForEveryHop(stubRedirectFetch(`http://${PUBLIC_HOST}/file`, calls)),
    });

    assert.equal(response.status, 200);
    assert.equal(calls[0].headers["Private-Token"], "secret");
    assert.equal(calls[1].headers.Authorization, undefined);
    assert.equal(calls[1].headers["Private-Token"], undefined);
    // Non-credential headers still travel with the request.
    assert.equal(calls[1].headers.Accept, "application/octet-stream");
  });

  test("drops additional header names passed as credentialHeaders", async () => {
    const calls: RecordedCall[] = [];
    await fetchWithValidatedRedirects("http://127.0.0.1:1/start", {
      headers: { ...credentials, "X-Gitlab-Session": "secret" },
      credentialHeaders: ["authorization", "private-token", "x-gitlab-session"],
      ...sameClientForEveryHop(stubRedirectFetch(`http://${PUBLIC_HOST}/file`, calls)),
    });

    assert.equal(calls[1].headers["X-Gitlab-Session"], undefined);
    assert.equal(calls[1].headers.Accept, "application/octet-stream");
  });

  test("keeps credentials on a hop to a trusted host", async () => {
    const calls: RecordedCall[] = [];
    const seen: string[] = [];
    await fetchWithValidatedRedirects("http://127.0.0.1:1/start", {
      headers: credentials,
      isTrustedRedirectHost: host => {
        seen.push(host);
        return host === PUBLIC_HOST;
      },
      fetchImpl: stubRedirectFetch(`http://${PUBLIC_HOST}/file`, calls),
    });

    assert.deepEqual(seen, [PUBLIC_HOST]);
    assert.equal(calls[1].headers.Authorization, "Bearer secret");
    assert.equal(calls[1].headers["Private-Token"], "secret");
  });

  test("still refuses an untrusted non-public target even without credentials", async () => {
    const calls: RecordedCall[] = [];
    await assert.rejects(
      () =>
        fetchWithValidatedRedirects("http://127.0.0.1:1/start", {
          headers: credentials,
          fetchImpl: stubRedirectFetch("http://169.254.169.254/latest/meta-data/", calls),
        }),
      (error: Error) =>
        error instanceof UnsafeRedirectError && error.message.includes("non-public address")
    );
    assert.equal(calls.length, 1);
  });

  const rejectsWithCleartext = (promise: () => Promise<unknown>) =>
    assert.rejects(
      promise,
      (error: Error) => error instanceof UnsafeRedirectError && error.message.includes("cleartext")
    );

  test("refuses an https-to-http downgrade even for a trusted host", async () => {
    const calls: RecordedCall[] = [];
    await rejectsWithCleartext(() =>
      fetchWithValidatedRedirects(`https://${PUBLIC_HOST}/start`, {
        headers: credentials,
        // Trust must not re-enable the credentials on a cleartext hop.
        isTrustedRedirectHost: () => true,
        fetchImpl: stubRedirectFetch(`http://${PUBLIC_HOST}/file`, calls),
      })
    );

    assert.deepEqual(
      calls.map(call => call.url),
      [`https://${PUBLIC_HOST}/start`]
    );
  });

  test("refuses a downgrade that happens after an earlier https hop", async () => {
    const calls: RecordedCall[] = [];
    await rejectsWithCleartext(() =>
      fetchWithValidatedRedirects(`https://${PUBLIC_HOST}/start`, {
        headers: credentials,
        fetchImpl: stubRedirectChain(
          [`https://${PUBLIC_HOST}/mid`, `http://${PUBLIC_HOST}/file`],
          calls
        ),
      })
    );

    assert.deepEqual(
      calls.map(call => call.url),
      [`https://${PUBLIC_HOST}/start`, `https://${PUBLIC_HOST}/mid`]
    );
  });

  test("follows an http-to-https upgrade and keeps credentials on a trusted host", async () => {
    const calls: RecordedCall[] = [];
    const response = await fetchWithValidatedRedirects(`http://${PUBLIC_HOST}/start`, {
      headers: credentials,
      isTrustedRedirectHost: host => host === PUBLIC_HOST,
      fetchImpl: stubRedirectFetch(`https://${PUBLIC_HOST}/file`, calls),
    });

    assert.equal(response.status, 200);
    assert.equal(calls[1].headers.Authorization, "Bearer secret");
    assert.equal(calls[1].headers["Private-Token"], "secret");
  });

  test("treats a scheme change to an untrusted host as cross-origin", async () => {
    const calls: RecordedCall[] = [];
    await fetchWithValidatedRedirects(`http://${PUBLIC_HOST}/start`, {
      headers: credentials,
      ...sameClientForEveryHop(stubRedirectFetch(`https://${PUBLIC_HOST}/file`, calls)),
    });

    assert.equal(calls[1].headers.Authorization, undefined);
    assert.equal(calls[1].headers["Private-Token"], undefined);
    assert.equal(calls[1].headers.Accept, "application/octet-stream");
  });

  test("keeps the credentials off a hop that returns to the initial origin", async () => {
    const calls: RecordedCall[] = [];
    const response = await fetchWithValidatedRedirects("http://127.0.0.1:1/start", {
      headers: credentials,
      ...sameClientForEveryHop(
        stubRedirectChain([`http://${PUBLIC_HOST}/mid`, "http://127.0.0.1:1/file"], calls)
      ),
    });

    assert.equal(response.status, 200);
    assert.deepEqual(
      calls.map(call => call.url),
      ["http://127.0.0.1:1/start", `http://${PUBLIC_HOST}/mid`, "http://127.0.0.1:1/file"]
    );
    // The untrusted hop keeps the token out of the request...
    assert.equal(calls[1].headers["Private-Token"], undefined);
    // ...and a target cannot get it back by bouncing the request to the origin, whose
    // response the caller of this helper reads as the downloaded body.
    assert.equal(calls[2].headers.Authorization, undefined);
    assert.equal(calls[2].headers["Private-Token"], undefined);
  });

  test("restores credentials on a return to the origin only after a trusted hop", async () => {
    const calls: RecordedCall[] = [];
    await fetchWithValidatedRedirects("http://127.0.0.1:1/start", {
      headers: credentials,
      isTrustedRedirectHost: host => host === PUBLIC_HOST,
      fetchImpl: stubRedirectChain([`http://${PUBLIC_HOST}/mid`, "http://127.0.0.1:1/file"], calls),
    });

    // The trusted hop already received the token, so the return hop may carry it too.
    assert.equal(calls[1].headers["Private-Token"], "secret");
    assert.equal(calls[2].headers["Private-Token"], "secret");
  });

  test("stays without credentials across untrusted hops and returns without them", async () => {
    const calls: RecordedCall[] = [];
    await fetchWithValidatedRedirects("http://127.0.0.1:1/start", {
      headers: credentials,
      ...sameClientForEveryHop(
        stubRedirectChain(
          [`http://${PUBLIC_HOST}/mid`, `http://${PUBLIC_HOST}/other`, "http://127.0.0.1:1/file"],
          calls
        )
      ),
    });

    assert.equal(calls[1].headers["Private-Token"], undefined);
    assert.equal(calls[2].headers["Private-Token"], undefined);
    assert.equal(calls[3].headers["Private-Token"], undefined);
  });

  test("a trusted hop after an untrusted one may carry the credentials again", async () => {
    const calls: RecordedCall[] = [];
    await fetchWithValidatedRedirects("http://127.0.0.1:1/start", {
      headers: credentials,
      isTrustedRedirectHost: host => host === "93.184.216.35",
      ...sameClientForEveryHop(
        stubRedirectChain(
          [`http://${PUBLIC_HOST}/mid`, "http://93.184.216.35/storage", "http://127.0.0.1:1/file"],
          calls
        )
      ),
    });

    assert.equal(calls[1].headers["Private-Token"], undefined);
    assert.equal(calls[2].headers["Private-Token"], "secret");
    assert.equal(calls[3].headers["Private-Token"], "secret");
  });

  test("uses the unauthenticated client once the credentials are withheld", async () => {
    const authenticatedCalls: RecordedCall[] = [];
    const unauthenticatedCalls: RecordedCall[] = [];
    await fetchWithValidatedRedirects("http://127.0.0.1:1/start", {
      headers: credentials,
      // A client that can add credentials by itself (cookie jar, OAuth 401 retry) must
      // not see a hop the helper stripped.
      fetchImpl: stubRedirectChain(
        [`http://${PUBLIC_HOST}/mid`, "http://127.0.0.1:1/file"],
        authenticatedCalls
      ),
      // This stub answers from its own first call on, which is the untrusted hop.
      unauthenticatedFetchImpl: stubRedirectChain(
        ["http://127.0.0.1:1/file"],
        unauthenticatedCalls
      ),
    });

    assert.deepEqual(
      authenticatedCalls.map(call => call.url),
      ["http://127.0.0.1:1/start"]
    );
    assert.deepEqual(
      unauthenticatedCalls.map(call => call.url),
      [`http://${PUBLIC_HOST}/mid`, "http://127.0.0.1:1/file"]
    );
    assert.equal(unauthenticatedCalls[0].headers["Private-Token"], undefined);
    // ...including the hop back to the origin, which the caller reads as the download.
    assert.equal(unauthenticatedCalls[1].headers["Private-Token"], undefined);
  });

  test("falls back to the plain client for stripped hops when only fetchImpl is given", async () => {
    const calls: RecordedCall[] = [];
    // `undici`'s own client is observable through the dispatcher, so this asserts the
    // default rather than trusting it: were the stripped hop routed to `fetchImpl`, the
    // stub would answer and the mock pool would stay untouched.
    const mockAgent = new MockAgent();
    mockAgent.disableNetConnect();
    mockAgent
      .get(`http://${PUBLIC_HOST}`)
      .intercept({ path: "/file", method: "GET" })
      .reply(200, "from-plain-undici");

    try {
      const response = await fetchWithValidatedRedirects("http://127.0.0.1:1/start", {
        headers: credentials,
        dispatcher: mockAgent,
        fetchImpl: stubRedirectFetch(`http://${PUBLIC_HOST}/file`, calls),
      });

      assert.equal(await response.text(), "from-plain-undici");
      assert.deepEqual(
        calls.map(call => call.url),
        ["http://127.0.0.1:1/start"]
      );
    } finally {
      await mockAgent.close();
    }
  });
});
