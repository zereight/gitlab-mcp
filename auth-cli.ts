import * as os from "os";
import * as path from "path";
import { GitLabOAuth } from "./oauth.js";
import { createLogger } from "./utils/logger.js";
import type { FetchImpl } from "./oauth-device-flow.js";

const logger = createLogger("gitlab-mcp-auth");

const DEFAULT_API_URL = "https://gitlab.com";
const DEFAULT_REDIRECT_URI = "http://127.0.0.1:8888/callback";

export const AUTH_CLI_HELP = `Usage: zereight-mcp-gitlab auth [options]

Run GitLab OAuth Device Authorization Grant (GitLab 17.9+; 17.2–17.8 need
oauth2_device_grant_flow) and store a token at the same path used by
GITLAB_USE_OAUTH (default ~/.gitlab-mcp-token.json).

This does not replace the local browser callback flow. After auth succeeds,
start the MCP server with GITLAB_USE_OAUTH=true and GITLAB_OAUTH_CLIENT_ID.
If you used --token-path, set GITLAB_OAUTH_TOKEN_PATH to the same path.

Options:
  --client-id <id>     OAuth application ID (or GITLAB_OAUTH_CLIENT_ID)
  --api-url <url>      GitLab API URL (or GITLAB_API_URL). Default: https://gitlab.com
  --token-path <path>  Token file path (or GITLAB_OAUTH_TOKEN_PATH)
  -h, --help           Show this help
`;

export interface AuthCliStdout {
  write(chunk: string): unknown;
}

export interface AuthCliInput {
  argv?: readonly string[];
  env?: NodeJS.ProcessEnv;
  stdout?: AuthCliStdout;
  fetchImpl?: FetchImpl;
  sleepAsync?: (ms: number) => Promise<void>;
}

function readFlag(argv: readonly string[], name: string): string | undefined {
  const equalsPrefix = `--${name}=`;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith(equalsPrefix)) {
      const value = arg.slice(equalsPrefix.length);
      return value === "" ? undefined : value;
    }
    if (arg === `--${name}`) {
      const next = argv[i + 1];
      if (next && !next.startsWith("-")) {
        return next;
      }
      return undefined;
    }
  }
  return undefined;
}

function wantsHelp(argv: readonly string[]): boolean {
  return argv.includes("--help") || argv.includes("-h");
}

function isReadOnlyMode(argv: readonly string[], env: NodeJS.ProcessEnv): boolean {
  const readOnly = readFlag(argv, "read-only") ?? env.GITLAB_READ_ONLY_MODE;
  if (readOnly === "true") {
    return true;
  }
  return (readFlag(argv, "permission-mode") ?? env.GITLAB_PERMISSION_MODE) === "readonly";
}

export function gitlabOriginFromApiUrl(apiUrl: string): string {
  return apiUrl.replace(/\/api\/v4\/?$/, "");
}

export async function runAuthCommandAsync(input: AuthCliInput = {}): Promise<void> {
  const argv = input.argv ?? process.argv;
  const env = input.env ?? process.env;
  const stdout = input.stdout ?? process.stdout;

  if (wantsHelp(argv)) {
    stdout.write(AUTH_CLI_HELP);
    return;
  }

  const clientId = readFlag(argv, "client-id") ?? env.GITLAB_OAUTH_CLIENT_ID;
  if (!clientId) {
    throw new Error("Missing OAuth client ID. Pass --client-id or set GITLAB_OAUTH_CLIENT_ID.");
  }

  const apiUrl = readFlag(argv, "api-url") ?? env.GITLAB_API_URL ?? DEFAULT_API_URL;
  const tokenPath =
    readFlag(argv, "token-path") ??
    env.GITLAB_OAUTH_TOKEN_PATH ??
    path.join(os.homedir(), ".gitlab-mcp-token.json");
  const gitlabUrl = gitlabOriginFromApiUrl(apiUrl);
  const scopes = [isReadOnlyMode(argv, env) ? "read_api" : "api"];

  const oauth = new GitLabOAuth({
    clientId,
    clientSecret: env.GITLAB_OAUTH_CLIENT_SECRET,
    redirectUri: env.GITLAB_OAUTH_REDIRECT_URI || DEFAULT_REDIRECT_URI,
    gitlabUrl,
    scopes,
    tokenStoragePath: tokenPath,
  });

  logger.info("Starting GitLab device authorization (no browser will be opened)");

  await oauth.runDeviceFlowAsync({
    fetchImpl: input.fetchImpl,
    sleepAsync: input.sleepAsync,
    onUserCode: info => {
      const visitUrl = info.verificationUriComplete ?? info.verificationUri;
      stdout.write(`Visit: ${visitUrl}\n`);
      stdout.write(`Code:  ${info.userCode}\n`);
      stdout.write("Waiting for authorization...\n");
    },
  });

  stdout.write(`Token saved to ${tokenPath}\n`);
  stdout.write(
    "Start the MCP server with GITLAB_USE_OAUTH=true and the same GITLAB_OAUTH_CLIENT_ID.\n" +
      "If you used --token-path, set GITLAB_OAUTH_TOKEN_PATH to that path as well.\n"
  );
}
