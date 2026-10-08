import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import * as fs from "node:fs";
import * as net from "node:net";
import * as os from "node:os";
import * as path from "node:path";
import * as url from "node:url";
import { describe, it } from "node:test";

// The token key is derived at module load, so the secret must be set before importing it.
const DOWNLOAD_TOKEN_SECRET = "oauth-download-test-secret";
process.env.DOWNLOAD_TOKEN_SECRET = DOWNLOAD_TOKEN_SECRET;
const { decryptDownloadToken } = await import("../utils/download-token.js");

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const SERVER_ENTRY = path.resolve(__dirname, "../build/index.js");
const HOST = "127.0.0.1";
const OAUTH_TOKEN = "oauth-download-test";
const MCP_ACCESS_TOKEN = "mcp-access-test";
const STARTUP_TIMEOUT_MS = 15_000;
const MCP_HEADERS = {
  "Content-Type": "application/json",
  Accept: "application/json, text/event-stream",
  Authorization: `Bearer ${MCP_ACCESS_TOKEN}`,
};

function getFreePortAsync(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.on("error", reject);
    probe.listen(0, HOST, () => {
      const address = probe.address();
      if (address === null || typeof address === "string") {
        probe.close();
        reject(new Error("probe server is not listening on a TCP port"));
        return;
      }
      probe.close(() => resolve(address.port));
    });
  });
}

function buildServerEnv(port: number, tmpDir: string): Record<string, string> {
  const tokenPath = path.join(tmpDir, "token.json");
  fs.writeFileSync(
    tokenPath,
    JSON.stringify({
      access_token: OAUTH_TOKEN,
      refresh_token: "refresh",
      expires_in: 7200,
      created_at: Date.now(),
      token_type: "Bearer",
    })
  );
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && !key.startsWith("GITLAB_")) {
      env[key] = value;
    }
  }
  return {
    ...env,
    STREAMABLE_HTTP: "true",
    HOST,
    PORT: String(port),
    MCP_SERVER_URL: "",
    GITLAB_API_URL: `http://${HOST}:1/api/v4`,
    GITLAB_USE_OAUTH: "true",
    GITLAB_OAUTH_CLIENT_ID: "client-id",
    GITLAB_OAUTH_TOKEN_PATH: tokenPath,
    GITLAB_IS_OLD: "true",
    USE_PIPELINE: "true",
    DOWNLOAD_TOKEN_SECRET,
    STREAMABLE_HTTP_AUTH_TOKEN: MCP_ACCESS_TOKEN,
  };
}

async function waitForServerAsync(port: number, child: ChildProcess): Promise<void> {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`server exited early with code ${child.exitCode}`);
    }
    const reachable = await new Promise<boolean>(resolve => {
      const socket = net.connect(port, HOST);
      socket.once("connect", () => {
        socket.destroy();
        resolve(true);
      });
      socket.once("error", () => resolve(false));
    });
    if (reachable) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error("server did not start listening in time");
}

async function postMcpAsync(
  port: number,
  body: Record<string, unknown>,
  sessionId?: string
): Promise<Response> {
  return fetch(`http://${HOST}:${port}/mcp`, {
    method: "POST",
    headers: sessionId ? { ...MCP_HEADERS, "mcp-session-id": sessionId } : MCP_HEADERS,
    body: JSON.stringify(body),
  });
}

function readJsonRpcResult(sseBody: string): unknown {
  const dataLine = sseBody.split("\n").find(line => line.startsWith("data: "));
  if (dataLine === undefined) {
    throw new Error(`no SSE data line in response: ${sseBody}`);
  }
  return JSON.parse(dataLine.slice("data: ".length));
}

function readDownloadUrl(rpc: unknown): string {
  const text = JSON.parse(JSON.stringify(rpc)).result?.content?.[0]?.text;
  if (typeof text !== "string") {
    throw new Error(`unexpected tool response: ${JSON.stringify(rpc)}`);
  }
  const downloadUrl = JSON.parse(text).download_url;
  if (typeof downloadUrl !== "string") {
    throw new Error(`no download_url in tool response: ${text}`);
  }
  return downloadUrl;
}

async function requestDownloadUrlAsync(): Promise<string> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "gitlab-oauth-download-"));
  const port = await getFreePortAsync();
  const env = buildServerEnv(port, tmpDir);
  const child = spawn(process.execPath, [SERVER_ENTRY], { env, stdio: "ignore" });
  try {
    await waitForServerAsync(port, child);
    const init = await postMcpAsync(port, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "oauth-download-url-test", version: "1.0" },
      },
    });
    const sessionId = init.headers.get("mcp-session-id") ?? undefined;
    const call = await postMcpAsync(
      port,
      {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: "download_job_artifacts", arguments: { project_id: "g/p", job_id: "1" } },
      },
      sessionId
    );
    return readDownloadUrl(readJsonRpcResult(await call.text()));
  } finally {
    child.kill("SIGKILL");
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

describe("When a remote server builds a download URL with a stored OAuth token", () => {
  describe("with GITLAB_IS_OLD enabled", () => {
    it("should embed the token as a bearer credential", async () => {
      const downloadUrl = await requestDownloadUrlAsync();

      const embedded = new URL(downloadUrl).searchParams.get("_token");
      const decrypted = embedded === null ? null : decryptDownloadToken(embedded);
      assert.equal(decrypted?.header, "Authorization");
      assert.equal(decrypted?.token, `Bearer ${OAUTH_TOKEN}`);
    });
  });
});
