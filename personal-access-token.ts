import { readFileSync } from "node:fs";

const EMPTY_FILE_CODE = "EMPTY";

export class PersonalAccessTokenFileError extends Error {
  readonly code: string;
  readonly filePath: string;

  constructor(filePath: string, code: string) {
    super(`Cannot load GITLAB_PERSONAL_ACCESS_TOKEN_FILE at ${filePath} (${code})`);
    this.name = "PersonalAccessTokenFileError";
    this.filePath = filePath;
    this.code = code;
  }
}

export interface PersonalAccessTokenSource {
  readonly cliToken: string | undefined;
  readonly envToken: string | undefined;
  readonly filePath: string | undefined;
  readonly readFile: (filePath: string) => string;
  readonly warn: (message: string) => void;
}

function presentInlineToken(value: string | undefined): string | undefined {
  if (value === undefined || value.length === 0) {
    return undefined;
  }
  return value;
}

function configuredFilePath(filePath: string | undefined): string | undefined {
  if (filePath === undefined) {
    return undefined;
  }
  const trimmed = filePath.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  return trimmed;
}

function errnoCode(error: unknown): string {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return "EIO";
  }
  const code = error.code;
  if (typeof code !== "string" || code.length === 0) {
    return "EIO";
  }
  return code;
}

export function readPersonalAccessTokenFile(filePath: string): string {
  return readFileSync(filePath, { encoding: "utf8" });
}

function ignoredFileWarning(filePath: string): string {
  return `Ignoring GITLAB_PERSONAL_ACCESS_TOKEN_FILE at ${filePath} because an inline personal access token is set`;
}

function readTokenFile(source: PersonalAccessTokenSource, filePath: string): string {
  try {
    return source.readFile(filePath);
  } catch (error: unknown) {
    throw new PersonalAccessTokenFileError(filePath, errnoCode(error));
  }
}

/**
 * Resolve the personal access token once.
 * `--token` wins, then a non-empty GITLAB_PERSONAL_ACCESS_TOKEN, then the file.
 * Job tokens, OAuth, cookies, and remote authorization are not inputs.
 */
export function resolvePersonalAccessToken(source: PersonalAccessTokenSource): string | undefined {
  const inline = presentInlineToken(source.cliToken) ?? presentInlineToken(source.envToken);
  const filePath = configuredFilePath(source.filePath);
  if (inline !== undefined) {
    if (filePath !== undefined) {
      source.warn(ignoredFileWarning(filePath));
    }
    return inline;
  }
  if (filePath === undefined) {
    return undefined;
  }

  const token = readTokenFile(source, filePath).trim();
  if (token.length === 0) {
    throw new PersonalAccessTokenFileError(filePath, EMPTY_FILE_CODE);
  }
  return token;
}
