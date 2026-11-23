import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

function nvmrcVersion(): string {
  const version = readFileSync(".nvmrc", "utf8").trim();
  assert.match(
    version,
    /^\d+\.\d+\.\d+$/,
    `.nvmrc should be a pinned x.y.z, got ${JSON.stringify(version)}`
  );
  return version;
}

function setupNodeWithBlocks(
  file: string,
  text: string
): Array<{ line: number; keys: Record<string, string> }> {
  const lines = text.split(/\r?\n/);
  const blocks: Array<{ line: number; keys: Record<string, string> }> = [];

  for (let i = 0; i < lines.length; i++) {
    if (!/uses:\s*actions\/setup-node@/.test(lines[i])) continue;

    let j = i + 1;
    let withStart = -1;
    while (j < lines.length) {
      const line = lines[j];
      if (line.trim() === "" || line.trim().startsWith("#")) {
        j++;
        continue;
      }
      if (/^\s+with:\s*$/.test(line)) {
        withStart = j;
        j++;
        break;
      }
      break;
    }
    assert.notEqual(withStart, -1, `${file}:${i + 1} setup-node has no with: block`);

    const withIndent = lines[withStart].match(/^(\s*)/)![1].length;
    const keys: Record<string, string> = {};
    while (j < lines.length) {
      const line = lines[j];
      if (line.trim() === "" || line.trim().startsWith("#")) {
        j++;
        continue;
      }
      const indent = line.match(/^(\s*)/)![1].length;
      if (indent <= withIndent) break;
      const match = line.trim().match(/^([\w-]+):\s*(.*)$/);
      if (match) {
        keys[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
      }
      j++;
    }
    blocks.push({ line: i + 1, keys });
  }

  return blocks;
}

describe("Node version pin", () => {
  const nvmrc = nvmrcVersion();

  it("setup-node steps use node-version-file: .nvmrc", () => {
    const dir = ".github/workflows";
    const files = readdirSync(dir).filter(name => name.endsWith(".yml") || name.endsWith(".yaml"));
    const problems: string[] = [];

    for (const file of files) {
      const path = join(dir, file);
      const blocks = setupNodeWithBlocks(file, readFileSync(path, "utf8"));
      for (const block of blocks) {
        if (block.keys["node-version-file"] !== ".nvmrc") {
          problems.push(
            `${file}:${block.line} expected node-version-file: .nvmrc, got ${JSON.stringify(block.keys["node-version-file"] ?? null)}`
          );
        }
        const pinned = block.keys["node-version"];
        if (pinned !== undefined && !pinned.includes("matrix.")) {
          problems.push(`${file}:${block.line} hardcoded node-version: ${pinned}`);
        }
      }
    }

    assert.equal(problems.length, 0, problems.join("\n"));
  });

  it("contributor docs do not hardcode a Node 22 patch version", () => {
    const files = ["CONTRIBUTING.md", "docs/contributing.md"];
    const problems: string[] = [];

    for (const file of files) {
      const text = readFileSync(file, "utf8");
      assert.match(text, /\.nvmrc/, `${file} should point at .nvmrc`);
      for (const match of text.matchAll(/\b22\.\d+\.\d+\b/g)) {
        problems.push(
          `${file} hardcodes ${match[0]} (use .nvmrc instead of a patch version; current pin is ${nvmrc})`
        );
      }
    }

    assert.equal(problems.length, 0, problems.join("\n"));
  });
});
