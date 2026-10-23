import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

// READMEs keep the Cursor deeplink only. The VS Code one-click badge lives in
// docs/clients/vscode.md. Both URLs come from scripts/generate-vscode-install-link.mjs.
// VS Code stops the server with "Undefined input variable" when a ${input:...}
// has no matching inputs entry. The install entries leave GITLAB_PERMISSION_MODE
// unset so the server default applies.

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const VSCODE_BADGE_LINK = /\[!\[Install in VS Code\]\([^)]*\)\]\(([^)]+)\)/g;
const CURSOR_BADGE_LINK = /\[!\[Install in Cursor\]\([^)]*\)\]\(([^)]+)\)/g;
const INPUT_VARIABLE = /\$\{input:([^}]+)\}/g;
const RAW_URL_PREFIX = "vscode:mcp/install?";

type InstallInput = { id: string; type: string; password?: boolean };

function generatedUrls(): { httpsUrl: string; rawUrl: string; cursorUrl: string } {
  const output = execFileSync(
    process.execPath,
    [path.join(REPO_ROOT, "scripts/generate-vscode-install-link.mjs")],
    { encoding: "utf8" }
  );
  const [httpsUrl, rawUrl, , , cursorUrl] = output.split("\n");
  return { httpsUrl, rawUrl, cursorUrl };
}

function readmeFiles(): string[] {
  return readdirSync(REPO_ROOT)
    .filter(name => /^README(\.[\w-]+)?\.md$/.test(name))
    .sort();
}

function vscodeBadgeFiles(): string[] {
  return ["docs/clients/vscode.md"];
}

function cursorBadgeFiles(): string[] {
  return [...readmeFiles(), "docs/clients/cursor.md"];
}

function badgeLinks(file: string, pattern: RegExp): string[] {
  const content = readFileSync(path.join(REPO_ROOT, file), "utf8");
  return [...content.matchAll(pattern)].map(match => match[1]);
}

function envOf(config: Record<string, unknown>): Record<string, unknown> {
  return (config.env ?? {}) as Record<string, unknown>;
}

function parseCursorUrl(cursorUrl: string): Record<string, unknown> {
  const encoded = new URL(cursorUrl).searchParams.get("config") ?? "";
  return JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
}

function inputVariableIds(value: unknown): string[] {
  return [...JSON.stringify(value).matchAll(INPUT_VARIABLE)].map(match => match[1]);
}

function parseHttpsUrl(httpsUrl: string): {
  name: string | null;
  inputs: InstallInput[];
  config: Record<string, unknown>;
} {
  const params = new URL(httpsUrl).searchParams;
  return {
    name: params.get("name"),
    inputs: JSON.parse(params.get("inputs") ?? "[]"),
    config: JSON.parse(params.get("config") ?? "{}"),
  };
}

describe("When the VS Code install badges are read", () => {
  const { httpsUrl } = generatedUrls();

  for (const file of vscodeBadgeFiles()) {
    test(`${file} should embed the generated URL exactly once`, () => {
      assert.deepEqual(badgeLinks(file, VSCODE_BADGE_LINK), [httpsUrl]);
    });
  }

  for (const file of readmeFiles()) {
    test(`${file} should not embed the VS Code one-click badge`, () => {
      assert.deepEqual(badgeLinks(file, VSCODE_BADGE_LINK), []);
    });
  }
});

describe("When the Cursor install badges are read", () => {
  const { cursorUrl } = generatedUrls();

  for (const file of cursorBadgeFiles()) {
    test(`${file} should embed the generated Cursor URL exactly once`, () => {
      assert.deepEqual(badgeLinks(file, CURSOR_BADGE_LINK), [cursorUrl]);
    });
  }
});

describe("When the generated https install URL is parsed", () => {
  const { name, inputs, config } = parseHttpsUrl(generatedUrls().httpsUrl);

  test("should define an input for every ${input:...} in the server entry", () => {
    const referenced = inputVariableIds(config);
    const defined = inputs.map(input => input.id);

    assert.ok(referenced.length > 0);
    for (const id of referenced) {
      assert.ok(defined.includes(id), `missing inputs entry for ${id}`);
    }
  });

  test("should prompt for the token as a password", () => {
    const tokenInput = inputs.find(input => input.id === "gitlab-token");

    assert.equal(name, "zereight.gitlab-mcp");
    assert.equal(tokenInput?.type, "promptString");
    assert.equal(tokenInput?.password, true);
  });

  test("should leave GITLAB_PERMISSION_MODE unset", () => {
    assert.ok(!("GITLAB_PERMISSION_MODE" in envOf(config)));
  });
});

describe("When the generated Cursor install URL is parsed", () => {
  test("should leave GITLAB_PERMISSION_MODE unset", () => {
    const config = parseCursorUrl(generatedUrls().cursorUrl);

    assert.equal(envOf(config).GITLAB_PERSONAL_ACCESS_TOKEN, "${env:GITLAB_PERSONAL_ACCESS_TOKEN}");
    assert.ok(!("GITLAB_PERMISSION_MODE" in envOf(config)));
  });
});

describe("When the generated vscode: install URL is parsed", () => {
  test("should carry the same server entry and inputs as the https URL", () => {
    const { httpsUrl, rawUrl } = generatedUrls();
    const expected = parseHttpsUrl(httpsUrl);

    assert.ok(rawUrl.startsWith(RAW_URL_PREFIX));
    const { name, inputs, ...config } = JSON.parse(
      decodeURIComponent(rawUrl.slice(RAW_URL_PREFIX.length))
    );

    assert.equal(name, expected.name);
    assert.deepEqual(inputs, expected.inputs);
    assert.deepEqual(config, expected.config);
  });
});
