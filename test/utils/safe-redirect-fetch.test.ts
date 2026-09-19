import assert from "node:assert/strict";
import http from "node:http";
import { after, before, describe, test } from "node:test";
import { Agent } from "undici";
import {
  fetchWithValidatedRedirects,
  isNonPublicAddress,
  UnsafeRedirectError,
} from "../../utils/safe-redirect-fetch.js";

const dispatcher = new Agent();

let server: http.Server;
let origin: string;
let secondServer: http.Server;
let secondOrigin: string;

function listen(target: http.Server): Promise<number> {
  return new Promise(resolve => {
    target.listen(0, "127.0.0.1", () => {
      const address = target.address();
      if (!address || typeof address === "string") throw new Error("no port");
      resolve(address.port);
    });
  });
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

    secondServer = http.createServer((_req, res) => {
      res.writeHead(200).end("second");
    });

    origin = `http://127.0.0.1:${await listen(server)}`;
    secondOrigin = `http://127.0.0.1:${await listen(secondServer)}`;
  });

  after(async () => {
    await Promise.all([
      new Promise(resolve => server.close(resolve)),
      new Promise(resolve => secondServer.close(resolve)),
      dispatcher.close(),
    ]);
  });

  test("follows a same-origin redirect", async () => {
    const response = await fetchWithValidatedRedirects(`${origin}/same-origin-redirect`, {
      headers: {},
      dispatcher,
    });
    assert.equal(response.status, 200);
    assert.equal(await response.text(), "payload");
  });

  test("refuses a redirect to a loopback address on another origin", async () => {
    await assert.rejects(
      () =>
        fetchWithValidatedRedirects(`${origin}/loopback-redirect`, {
          headers: {},
          dispatcher,
        }),
      (error: Error) =>
        error instanceof UnsafeRedirectError && error.message.includes("non-public address")
    );
  });

  test("refuses a redirect to the cloud instance metadata address", async () => {
    await assert.rejects(
      () =>
        fetchWithValidatedRedirects(`${origin}/metadata-redirect`, {
          headers: {},
          dispatcher,
        }),
      (error: Error) =>
        error instanceof UnsafeRedirectError && error.message.includes("169.254.169.254")
    );
  });

  test("refuses a redirect to a non-http protocol", async () => {
    await assert.rejects(
      () =>
        fetchWithValidatedRedirects(`${origin}/file-protocol-redirect`, {
          headers: {},
          dispatcher,
        }),
      (error: Error) =>
        error instanceof UnsafeRedirectError && error.message.includes("unsupported protocol")
    );
  });

  test("refuses to follow more redirects than the limit allows", async () => {
    await assert.rejects(
      () =>
        fetchWithValidatedRedirects(`${origin}/loop`, {
          headers: {},
          dispatcher,
          maxRedirects: 2,
        }),
      (error: Error) =>
        error instanceof UnsafeRedirectError && error.message.includes("Too many redirects")
    );
  });

  test("follows a non-public redirect target when the host is trusted", async () => {
    const response = await fetchWithValidatedRedirects(`${origin}/cross-origin-redirect`, {
      headers: {},
      dispatcher,
      isTrustedRedirectHost: host => host === "127.0.0.1",
    });
    assert.equal(response.status, 200);
    assert.equal(await response.text(), "second");
  });

  test("classifies address ranges", () => {
    for (const address of [
      "127.0.0.1",
      "10.1.2.3",
      "172.16.0.1",
      "192.168.1.1",
      "169.254.169.254",
      "100.64.0.1",
      "0.0.0.0",
      "::1",
      "fd00::1",
      "fe80::1",
      "::ffff:127.0.0.1",
    ]) {
      assert.equal(isNonPublicAddress(address), true, `${address} should be non-public`);
    }

    for (const address of ["8.8.8.8", "1.1.1.1", "2606:4700::1111"]) {
      assert.equal(isNonPublicAddress(address), false, `${address} should be public`);
    }
  });
});
