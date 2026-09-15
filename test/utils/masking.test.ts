import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, test } from "node:test";
import { createMaskingEngine, createMaskingPolicyResolver } from "../../masking/engine.js";

describe("response masking", () => {
  test("is a no-op and does not read a config when disabled", () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "gitlab-mask-"));
    const engine = createMaskingEngine({
      enabled: false,
      workspaceDir: workspace,
      configPath: "missing.json",
    });
    assert.equal(engine, undefined);
  });

  test("applies built-in rules and literal keyword rules", () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "gitlab-mask-"));
    fs.writeFileSync(
      path.join(workspace, ".gitlab-mcp-mask.json"),
      JSON.stringify({
        version: 1,
        builtins: { ipv4: { replacement: "[Address]" } },
        rules: [
          { id: "company", type: "keyword", match: "Example Corp", replacement: "Our organization" },
          { id: "token", type: "regex", pattern: "TOKEN-[0-9]+", replacement: "[Token]" },
        ],
      })
    );
    const engine = createMaskingEngine({ enabled: true, workspaceDir: workspace });
    assert.ok(engine);
    assert.equal(
      engine.maskText("Example Corp 10.20.30.40 TOKEN-123"),
      "Our organization [Address] [Token]"
    );
  });

  test("masks nested tool text without recursively masking replacements", () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "gitlab-mask-"));
    fs.writeFileSync(
      path.join(workspace, "rules.json"),
      JSON.stringify({
        version: 1,
        rules: [
          { id: "a", type: "keyword", match: "Example Corp", replacement: "Customer Corp" },
          { id: "b", type: "keyword", match: "Customer Corp", replacement: "Customer organization" },
        ],
      })
    );
    const engine = createMaskingEngine({
      enabled: true,
      workspaceDir: workspace,
      configPath: "rules.json",
    });
    assert.ok(engine);
    const result = engine.maskToolResult({
      content: [{ type: "text", text: JSON.stringify({ description: "Example Corp" }) }],
      structuredContent: { nested: "Example Corp" },
    });
    assert.equal(result.content[0].text, '{"description":"Customer Corp"}');
    assert.deepEqual(result.structuredContent, { nested: "Customer Corp" });
  });

  test("rejects invalid and empty-match regex rules", () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "gitlab-mask-"));
    const configPath = path.join(workspace, "bad.json");
    fs.writeFileSync(
      configPath,
      JSON.stringify({ rules: [{ id: "bad", type: "regex", pattern: "", replacement: "x" }] })
    );
    assert.throws(
      () => createMaskingEngine({ enabled: true, workspaceDir: workspace, configPath: "bad.json" }),
      /must not be empty/
    );
  });

  test("selects a server-owned policy by normalized GitLab instance and project", () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "gitlab-mask-"));
    const policyPath = path.join(workspace, "managed-policies.json");
    fs.writeFileSync(
      policyPath,
      JSON.stringify({
        version: 1,
        policyGroups: {
          customer: {
            rules: [{ id: "customer", type: "keyword", match: "Customer Corp", replacement: "[customer]" }],
          },
        },
        bindings: [
          { gitlabInstance: "https://gitlab.example.test", projectIds: [12, 13], policyGroup: "customer" },
        ],
      })
    );
    const resolver = createMaskingPolicyResolver({
      enabled: true,
      workspaceDir: workspace,
      policyFilePath: "managed-policies.json",
    });
    assert.ok(resolver);
    assert.equal(
      resolver.select({ gitlabInstance: "https://gitlab.example.test/api/v4", projectId: "12" }).maskText("Customer Corp"),
      "[customer]"
    );
    assert.throws(
      () => resolver.select({ gitlabInstance: "https://another.example.test/api/v4", projectId: 12 }),
      /No managed masking policy/
    );
    assert.throws(
      () => resolver.select({ gitlabInstance: "https://gitlab.example.test", projectId: 14 }),
      /No managed masking policy/
    );
  });

  test("rejects a workspace group that conflicts with the server binding", () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "gitlab-mask-"));
    fs.writeFileSync(
      path.join(workspace, ".gitlab-mcp-mask.json"),
      JSON.stringify({ version: 2, mode: "managed", policyGroup: "one" })
    );
    fs.writeFileSync(
      path.join(workspace, "managed-policies.json"),
      JSON.stringify({
        version: 1,
        policyGroups: { one: {}, two: {} },
        bindings: [{ gitlabInstance: "https://gitlab.example.test", projectIds: [12], policyGroup: "two" }],
      })
    );
    const resolver = createMaskingPolicyResolver({
      enabled: true,
      workspaceDir: workspace,
      policyFilePath: "managed-policies.json",
    });
    assert.ok(resolver);
    assert.throws(
      () => resolver.select({ gitlabInstance: "https://gitlab.example.test", projectId: 12 }),
      /does not match/
    );
  });
});
