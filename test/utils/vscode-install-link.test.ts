import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

// The README badges and docs/clients/vscode.md embed the URL printed by
// scripts/generate-vscode-install-link.mjs. VS Code stops the server with
// "Undefined input variable" when a ${input:...} has no matching inputs entry.

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const VSCODE_BADGE_LINK = /\[!\[Install in VS Code\]\([^)]*\)\]\(([^)]+)\)/g;
const INPUT_VARIABLE = /\$\{input:([^}]+)\}/g;
const RAW_URL_PREFIX = "vscode:mcp/install?";

type InstallInput = { id: string; type: string; password?: boolean };

function generatedUrls(): { httpsUrl: string; rawUrl: string } {
  const output = execFileSync(
    process.execPath,
    [path.join(REPO_ROOT, "scripts/generate-vscode-install-link.mjs")],
    { encoding: "utf8" }
  );
  const [httpsUrl, rawUrl] = output.split("\n");
  return { httpsUrl, rawUrl };
}

function badgeFiles(): string[] {
  const readmes = readdirSync(REPO_ROOT)
    .filter(name => /^README(\.[\w-]+)?\.md$/.test(name))
    .sort();
  return [...readmes, "docs/clients/vscode.md"];
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

  for (const file of badgeFiles()) {
    test(`${file} should embed the generated URL exactly once`, () => {
      const content = readFileSync(path.join(REPO_ROOT, file), "utf8");
      const links = [...content.matchAll(VSCODE_BADGE_LINK)].map(match => match[1]);

      assert.deepEqual(links, [httpsUrl]);
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
