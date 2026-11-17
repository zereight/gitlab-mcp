import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, test } from "node:test";
import { createMaskingEngine, createMaskingPolicyResolver } from "../../masking/engine.js";
import { getManagedMaskingProjectIds } from "../../masking/project-scope.js";
import { allTools } from "../../tools/registry.js";

const EXAMPLE_JWT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
const EXAMPLE_AWS_ACCESS_KEY = "AKIAIOSFODNN7EXAMPLE";
const EXAMPLE_AWS_TEMP_KEY = "ASIAIOSFODNN7EXAMPLE";
const EXAMPLE_AWS_SECRET = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";
// Writes "/" as the JSON escape \/, as some JSON encoders do. Fixtures here
// contain no backslashes, so no other escaping is needed.
const escapeJsonSlashes = (text: string) => text.split("/").join("\\/");
const EXAMPLE_COMMIT_SHA = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";
const EXAMPLE_PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhAGhqV3r3wAAAABJRU5ErkJggg==";
const RSA_PRIVATE_KEY = [
  "-----BEGIN RSA PRIVATE KEY-----",
  "Proc-Type: 4,ENCRYPTED",
  "DEK-Info: AES-128-CBC,00112233445566778899aabbccddeeff",
  "",
  "MIIBOgIBAAJBAKfakePrivateKeyMaterialForMaskingTestsOnlyNotRealKey=",
  "-----END RSA PRIVATE KEY-----",
].join("\n");
const EC_PRIVATE_KEY = [
  "-----BEGIN EC PRIVATE KEY-----",
  "MHcCAQEEIFakeEcPrivateKeyMaterialForMaskingTestsOnlyNotRealKey=",
  "-----END EC PRIVATE KEY-----",
].join("\n");
const OPENSSH_PRIVATE_KEY = [
  "-----BEGIN OPENSSH PRIVATE KEY-----",
  "b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW",
  "-----END OPENSSH PRIVATE KEY-----",
].join("\n");
const ENCRYPTED_PRIVATE_KEY = [
  "-----BEGIN ENCRYPTED PRIVATE KEY-----",
  "MIIFLTBXBgkqhkiG9w0BBQ0wSjApBgkqhkiG9w0BBQwwHAQIfakeEncryptedKey=",
  "-----END ENCRYPTED PRIVATE KEY-----",
].join("\n");
const PKCS8_PRIVATE_KEY = [
  "-----BEGIN PRIVATE KEY-----",
  "MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQFakePkcs8Key==",
  "-----END PRIVATE KEY-----",
].join("\n");

function createEnabledEngine(config?: Record<string, unknown>) {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "gitlab-mask-"));
  if (config !== undefined) {
    fs.writeFileSync(path.join(workspace, ".gitlab-mcp-mask.json"), JSON.stringify(config));
  }
  const engine = createMaskingEngine({ enabled: true, workspaceDir: workspace });
  assert.ok(engine);
  return engine;
}

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
          {
            id: "company",
            type: "keyword",
            match: "Example Corp",
            replacement: "Our organization",
          },
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
          {
            id: "b",
            type: "keyword",
            match: "Customer Corp",
            replacement: "Customer organization",
          },
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

  test("masks plain text blocks and returned error messages", () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "gitlab-mask-"));
    const engine = createMaskingEngine({ enabled: true, workspaceDir: workspace });
    assert.ok(engine);
    const result = engine.maskToolResult({
      content: [{ type: "text", text: "Connect to 10.20.30.40 with glpat-abcdefghijklmnopqrst" }],
    });
    assert.equal(result.content[0].text, "Connect to [IP address] with [Token masked]");
    const error = engine.maskError(new Error("Failed at 10.20.30.40"));
    assert.equal(error instanceof Error && error.message, "Failed at [IP address]");
  });

  test("masks every documented GitLab token prefix", () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "gitlab-mask-"));
    const engine = createMaskingEngine({ enabled: true, workspaceDir: workspace });
    assert.ok(engine);
    const suffix = "abcdefghijklmnopqrst";
    const prefixes = [
      "glpat",
      "glrt",
      "glptt",
      "gldt",
      "glcbt",
      "glsoat",
      "gloas",
      "glagent",
      "glft",
      "glimt",
    ];
    assert.equal(
      engine.maskText(prefixes.map(prefix => `${prefix}-${suffix}`).join(" ")),
      prefixes.map(() => "[Token masked]").join(" ")
    );
  });

  test("covers the full union of overlapping secrets without merging adjacent matches", t => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "gitlab-mask-"));
    const configPath = path.join(workspace, "rules.json");
    t.after(() => {
      fs.unlinkSync(configPath);
      fs.rmdirSync(workspace);
    });
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        rules: [
          { id: "label", type: "keyword", match: "token=glpat-", replacement: "[label]" },
          { id: "first", type: "keyword", match: "abc", replacement: "[first]" },
          { id: "second", type: "keyword", match: "cde", replacement: "[second]" },
          { id: "third", type: "keyword", match: "efg", replacement: "[third]" },
        ],
      })
    );
    const engine = createMaskingEngine({ enabled: true, configPath });
    assert.ok(engine);
    assert.equal(engine.maskText("token=glpat-ABCDEFGHIJKLMNOPQRST"), "[label]");
    assert.equal(engine.maskText("abcdefg"), "[first]");
    assert.equal(engine.maskText("abccde"), "[first][second]");
  });

  test("preserves plain text primitives and applies numeric keyword rules", t => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "gitlab-mask-"));
    const configPath = path.join(workspace, "rules.json");
    t.after(() => {
      fs.unlinkSync(configPath);
      fs.rmdirSync(workspace);
    });
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        rules: [{ id: "number", type: "keyword", match: "123456", replacement: "[number]" }],
      })
    );
    const engine = createMaskingEngine({ enabled: true, configPath });
    assert.ok(engine);
    const texts = ["9007199254740993\n", "123456\n", "true\n", '"ordinary text"\n'];
    const result = engine.maskToolResult({ content: texts.map(text => ({ type: "text", text })) });
    assert.deepEqual(
      result.content.map(block => block.text),
      ["9007199254740993\n", "[number]\n", "true\n", '"ordinary text"\n']
    );
    assert.equal(
      engine.maskToolResult(
        {
          content: [{ type: "text", text: '{"123456":9007199254740993}\n' }],
        },
        { textFormat: "plain" }
      ).content[0].text,
      '{"[number]":9007199254740993}\n'
    );
  });

  test("preserves JSON numbers and formatting while masking escaped string values", t => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "gitlab-mask-"));
    t.after(() => fs.rmdirSync(workspace));
    const engine = createMaskingEngine({ enabled: true, workspaceDir: workspace });
    assert.ok(engine);
    const text =
      '{\n  "id": 9007199254740993, "host": "10.20.30.\\u0034\\u0030",\n' +
      '  "download_url": "http://10.20.30.40/file", "nested": ["10.20.30.40"]\n}\n';
    assert.equal(
      engine.maskToolResult({ content: [{ type: "text", text }] }).content[0].text,
      '{\n  "id": 9007199254740993, "host": "[IP address]",\n' +
        '  "download_url": "[Download URL masked]", "nested": ["[IP address]"]\n}\n'
    );
    const unchanged = '{ "id": 9007199254740993, "value": "ordinary" }\n';
    assert.equal(
      engine.maskToolResult({ content: [{ type: "text", text: unchanged }] }).content[0].text,
      unchanged
    );
  });

  test("masks compressed IPv6 addresses", () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "gitlab-mask-"));
    const engine = createMaskingEngine({ enabled: true, workspaceDir: workspace });
    assert.ok(engine);
    assert.equal(
      engine.maskText("Hosts: 2001:db8::1, fe80::1234, ::1, and 2001:db8:0:0:0:0:0:1"),
      "Hosts: [IP address], [IP address], [IP address], and [IP address]"
    );
    assert.equal(
      engine.maskText("Version 1:2:3 is not an IPv6 address"),
      "Version 1:2:3 is not an IPv6 address"
    );
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

  test("fails closed when an explicitly configured file is missing", () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "gitlab-mask-"));
    assert.throws(
      () =>
        createMaskingEngine({ enabled: true, workspaceDir: workspace, configPath: "missing.json" }),
      /Configured masking config does not exist/
    );
    assert.throws(
      () =>
        createMaskingPolicyResolver({
          enabled: true,
          workspaceDir: workspace,
          configPath: "missing.json",
        }),
      /Configured masking config does not exist/
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
            rules: [
              {
                id: "customer",
                type: "keyword",
                match: "Customer Corp",
                replacement: "[customer]",
              },
            ],
          },
        },
        bindings: [
          {
            gitlabInstance: "https://gitlab.example.test",
            projectIds: [12, 13],
            policyGroup: "customer",
          },
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
      resolver
        .select({ gitlabInstance: "https://gitlab.example.test/api/v4", projectIds: ["12"] })
        .maskText("Customer Corp"),
      "[customer]"
    );
    assert.throws(
      () =>
        resolver.select({
          gitlabInstance: "https://another.example.test/api/v4",
          projectIds: [12],
        }),
      /No managed masking policy/
    );
    assert.throws(
      () => resolver.select({ gitlabInstance: "https://gitlab.example.test", projectIds: [14] }),
      /No managed masking policy/
    );
    assert.throws(
      () =>
        resolver.select({ gitlabInstance: "https://gitlab.example.test", hasProjectScope: false }),
      /project-less tool/
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
        bindings: [
          { gitlabInstance: "https://gitlab.example.test", projectIds: [12], policyGroup: "two" },
        ],
      })
    );
    const resolver = createMaskingPolicyResolver({
      enabled: true,
      workspaceDir: workspace,
      policyFilePath: "managed-policies.json",
    });
    assert.ok(resolver);
    assert.throws(
      () => resolver.select({ gitlabInstance: "https://gitlab.example.test", projectIds: [12] }),
      /does not match/
    );
  });

  test("rejects project paths and calls spanning managed policy groups", () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "gitlab-mask-"));
    const policyPath = path.join(workspace, "managed-policies.json");
    fs.writeFileSync(
      policyPath,
      JSON.stringify({
        version: 1,
        policyGroups: { one: {}, two: {} },
        bindings: [
          { gitlabInstance: "https://gitlab.example.test", projectIds: [12], policyGroup: "one" },
          { gitlabInstance: "https://gitlab.example.test", projectIds: [13], policyGroup: "two" },
        ],
      })
    );
    const resolver = createMaskingPolicyResolver({
      enabled: true,
      workspaceDir: workspace,
      policyFilePath: "managed-policies.json",
    });
    assert.ok(resolver);
    assert.throws(
      () =>
        resolver.select({
          gitlabInstance: "https://gitlab.example.test",
          projectIds: ["group/project"],
        }),
      /numeric project IDs/
    );
    assert.throws(
      () =>
        resolver.select({ gitlabInstance: "https://gitlab.example.test", projectIds: [12, 13] }),
      /span policy groups/
    );
  });

  test("derives managed scope only from project fields declared by the tool", () => {
    const globalTool = { properties: { search: { type: "string" } } };
    assert.deepEqual(
      getManagedMaskingProjectIds(globalTool, { project_id: "12", search: "example" }),
      { hasProjectScope: false, projectIds: [] }
    );

    const projectTool = {
      properties: { project_id: { type: "string" }, target_project_id: { type: "string" } },
    };
    assert.deepEqual(
      getManagedMaskingProjectIds(projectTool, { project_id: "12", target_project_id: "13" }),
      { hasProjectScope: true, projectIds: ["12", "13"] }
    );
    assert.deepEqual(
      getManagedMaskingProjectIds(projectTool, {}, () => "12"),
      { hasProjectScope: true, projectIds: ["12"] }
    );
  });

  test("includes the default primary project alongside explicit and nested references", () => {
    const createMergeRequest = allTools.find(tool => tool.name === "create_merge_request");
    const updateWorkItem = allTools.find(tool => tool.name === "update_work_item");
    assert.ok(createMergeRequest);
    assert.ok(updateWorkItem);
    assert.deepEqual(
      getManagedMaskingProjectIds(
        createMergeRequest.inputSchema,
        {
          project_id: "",
          target_project_id: "13",
        },
        () => "12"
      ),
      { hasProjectScope: true, projectIds: ["12", "13"] }
    );
    assert.deepEqual(
      getManagedMaskingProjectIds(
        updateWorkItem.inputSchema,
        {
          project_id: "",
          children_to_add: [{ project_id: "13", iid: 1 }],
        },
        () => "12"
      ),
      { hasProjectScope: true, projectIds: ["12", "13"] }
    );
  });

  test("treats absent optional filters as unscoped and absent required projects as scoped", () => {
    for (const name of ["list_issues", "list_merge_requests", "list_todos"]) {
      const tool = allTools.find(tool => tool.name === name);
      assert.ok(tool, name);
      assert.deepEqual(getManagedMaskingProjectIds(tool.inputSchema, {}), {
        hasProjectScope: false,
        projectIds: [],
      });
    }
    const getIssue = allTools.find(tool => tool.name === "get_issue");
    assert.ok(getIssue);
    assert.deepEqual(getManagedMaskingProjectIds(getIssue.inputSchema, {}), {
      hasProjectScope: true,
      projectIds: [],
    });
    const groupMergeRequests = allTools.find(tool => tool.name === "list_group_merge_requests");
    assert.ok(groupMergeRequests);
    assert.deepEqual(
      getManagedMaskingProjectIds(
        groupMergeRequests.inputSchema,
        {
          group_id: "99",
          source_project_id: "12",
        },
        () => "12"
      ),
      { hasProjectScope: false, projectIds: [] }
    );
  });

  test("does not use a default project for a selected group scope", () => {
    const webhookTool = {
      properties: {
        project_id: { type: "string" },
        group_id: { type: "string" },
      },
    };
    assert.deepEqual(
      getManagedMaskingProjectIds(webhookTool, { group_id: "99" }, () => "12"),
      { hasProjectScope: false, projectIds: [] }
    );
  });

  test("collects nested declared project references", () => {
    const workItemTool = {
      properties: {
        project_id: { type: "string" },
        children_to_add: {
          type: "array",
          items: {
            type: "object",
            properties: { project_id: { type: "string" }, iid: { type: "number" } },
          },
        },
        linked_items_to_remove: {
          type: "array",
          items: {
            type: "object",
            properties: { project_id: { type: "string" }, iid: { type: "number" } },
          },
        },
      },
    };
    assert.deepEqual(
      getManagedMaskingProjectIds(workItemTool, {
        project_id: "12",
        children_to_add: [{ project_id: "13", iid: 1 }],
        linked_items_to_remove: [{ project_id: "14", iid: 2 }],
      }),
      { hasProjectScope: true, projectIds: ["12", "13", "14"] }
    );
  });

  test("uses the registered work item schema to reject cross-project actions", () => {
    const updateWorkItem = allTools.find(tool => tool.name === "update_work_item");
    assert.ok(updateWorkItem);
    assert.deepEqual(
      getManagedMaskingProjectIds(updateWorkItem.inputSchema, {
        project_id: "12",
        children_to_add: [{ project_id: "13", iid: 1 }],
        linked_items_to_add: [{ project_id: "14", iid: 2 }],
      }),
      { hasProjectScope: true, projectIds: ["12", "13", "14"] }
    );
  });

  test("uses the registered webhook schema without selecting a default project for a group", () => {
    const listWebhooks = allTools.find(tool => tool.name === "list_webhooks");
    assert.ok(listWebhooks);
    assert.deepEqual(
      getManagedMaskingProjectIds(listWebhooks.inputSchema, { group_id: "99" }, () => "12"),
      { hasProjectScope: false, projectIds: [] }
    );
  });

  test("allows project-less tools only with the explicit built-in fallback", () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "gitlab-mask-"));
    const policyPath = path.join(workspace, "managed-policies.json");
    fs.writeFileSync(
      policyPath,
      JSON.stringify({
        version: 1,
        policyGroups: {},
        bindings: [],
        unboundProjectBehavior: "builtin",
      })
    );
    const resolver = createMaskingPolicyResolver({
      enabled: true,
      workspaceDir: workspace,
      policyFilePath: "managed-policies.json",
    });
    assert.ok(resolver);
    assert.equal(
      resolver
        .select({ gitlabInstance: "https://gitlab.example.test", hasProjectScope: false })
        .maskText("10.20.30.40"),
      "[IP address]"
    );
    assert.throws(
      () =>
        resolver.select({ gitlabInstance: "https://gitlab.example.test", hasProjectScope: true }),
      /requires a project ID/
    );
  });

  test("allows only explicitly designated unscoped tools to use built-in masking", () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "gitlab-mask-"));
    const policyPath = path.join(workspace, "managed-policies.json");
    fs.writeFileSync(policyPath, JSON.stringify({ version: 1, policyGroups: {}, bindings: [] }));
    const resolver = createMaskingPolicyResolver({
      enabled: true,
      workspaceDir: workspace,
      policyFilePath: "managed-policies.json",
    });
    assert.ok(resolver);
    assert.equal(
      resolver
        .select({
          gitlabInstance: "https://gitlab.example.test",
          hasProjectScope: false,
          allowBuiltinForUnscoped: true,
        })
        .maskText("10.20.30.40"),
      "[IP address]"
    );
    assert.throws(
      () =>
        resolver.select({ gitlabInstance: "https://gitlab.example.test", hasProjectScope: false }),
      /project-less tool/
    );
  });
});

describe("When builtin JWT masking runs", () => {
  describe("with a three-segment token starting eyJ", () => {
    test("should replace the JWT", () => {
      const engine = createEnabledEngine();
      assert.equal(engine.maskText(`Bearer ${EXAMPLE_JWT}`), "Bearer [JWT masked]");
    });
  });

  describe("with two segments or ordinary issue text", () => {
    test("should leave the text unchanged", () => {
      const engine = createEnabledEngine();
      const issueText = `Please review this MR. Commit ${EXAMPLE_COMMIT_SHA}.`;
      const twoSegments = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0";
      assert.equal(engine.maskText(issueText), issueText);
      assert.equal(engine.maskText(twoSegments), twoSegments);
      assert.equal(engine.maskText(EXAMPLE_PNG_DATA_URL), EXAMPLE_PNG_DATA_URL);
    });
  });

  describe("with a three-segment token immediately after a hyphen", () => {
    test("should leave the hyphen-prefixed token unchanged", () => {
      const engine = createEnabledEngine();
      const prefixed = `sess-${EXAMPLE_JWT}`;
      assert.equal(engine.maskText(prefixed), prefixed);
    });

    test("should be masked by a custom rule for that form", () => {
      const prefixed = `sess-${EXAMPLE_JWT}`;
      const engine = createEnabledEngine({
        rules: [
          {
            id: "prefixed-jwt",
            type: "regex",
            pattern: "sess-eyJ[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+",
            replacement: "[Session JWT masked]",
          },
        ],
      });
      assert.equal(engine.maskText(prefixed), "[Session JWT masked]");
    });
  });

  describe("with the jwt builtin disabled", () => {
    test("should leave JWTs visible while still masking IPv4", () => {
      const engine = createEnabledEngine({ builtins: { jwt: { enabled: false } } });
      assert.equal(engine.maskText(EXAMPLE_JWT), EXAMPLE_JWT);
      assert.equal(engine.maskText("10.20.30.40"), "[IP address]");
    });
  });

  describe("with a 1 MB run of -eyJ fragments", () => {
    test("should finish well under 500 ms and leave the text unchanged", () => {
      const engine = createEnabledEngine();
      const text = "-eyJ".repeat(250_000);
      const startedAt = performance.now();
      const masked = engine.maskText(text);
      const elapsedMs = performance.now() - startedAt;
      assert.equal(masked, text);
      assert.ok(elapsedMs < 500, `maskText took ${elapsedMs.toFixed(0)} ms`);
    });
  });
});

describe("When builtin PEM private key masking runs", () => {
  describe("with RSA, EC, OPENSSH, encrypted, and PKCS#8 blocks", () => {
    test("should replace each private key block", () => {
      const engine = createEnabledEngine();
      assert.equal(engine.maskText(RSA_PRIVATE_KEY), "[Private key masked]");
      assert.equal(engine.maskText(EC_PRIVATE_KEY), "[Private key masked]");
      assert.equal(engine.maskText(OPENSSH_PRIVATE_KEY), "[Private key masked]");
      assert.equal(engine.maskText(ENCRYPTED_PRIVATE_KEY), "[Private key masked]");
      assert.equal(engine.maskText(PKCS8_PRIVATE_KEY), "[Private key masked]");
    });
  });

  describe("with two private key blocks and text between them", () => {
    test("should keep the intervening text", () => {
      const engine = createEnabledEngine();
      assert.equal(
        engine.maskText(`${PKCS8_PRIVATE_KEY}\nBuild failed.\n${PKCS8_PRIVATE_KEY}`),
        "[Private key masked]\nBuild failed.\n[Private key masked]"
      );
    });
  });

  describe("with a public key or an unterminated BEGIN block", () => {
    test("should leave the text unchanged", () => {
      const engine = createEnabledEngine();
      const publicKey = [
        "-----BEGIN PUBLIC KEY-----",
        "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA",
        "-----END PUBLIC KEY-----",
      ].join("\n");
      const unterminated = "-----BEGIN RSA PRIVATE KEY-----\nMIIBOgIBAAJBAKfakeKey";
      assert.equal(engine.maskText(publicKey), publicKey);
      assert.equal(engine.maskText(unterminated), unterminated);
    });
  });

  describe("with a long BEGIN block that has no END marker", () => {
    test("should finish without hanging", () => {
      const engine = createEnabledEngine();
      const text = `-----BEGIN RSA PRIVATE KEY-----\n${"A".repeat(40_000)}`;
      const startedAt = Date.now();
      assert.equal(engine.maskText(text), text);
      assert.ok(Date.now() - startedAt < 1000);
    });
  });

  describe("with a 1 MB run of BEGIN headers and no END marker", () => {
    test("should finish well under 500 ms and leave the text unchanged", () => {
      const engine = createEnabledEngine();
      const inputs = [
        "-----BEGIN PRIVATE KEY-----\n".repeat(37_000),
        "-----BEGIN PRIVATE KEY-----\\n".repeat(37_000),
      ];
      for (const text of inputs) {
        const startedAt = performance.now();
        const masked = engine.maskText(text);
        const elapsedMs = performance.now() - startedAt;
        assert.equal(masked, text);
        assert.ok(elapsedMs < 500, `maskText took ${elapsedMs.toFixed(0)} ms`);
      }
    });
  });

  describe("with PEM line breaks written as escape sequences inside a JSON string", () => {
    const ESCAPED_LF = PKCS8_PRIVATE_KEY.replace(/\n/g, "\\n");
    const ESCAPED_CRLF = PKCS8_PRIVATE_KEY.replace(/\n/g, "\\r\\n");
    const variableValue = JSON.stringify({ private_key: PKCS8_PRIVATE_KEY });

    test("should mask raw text whose line breaks are literal backslash-n or backslash-r-n", () => {
      const engine = createEnabledEngine();
      assert.equal(
        engine.maskText(`{"private_key":"${ESCAPED_LF}\\n"}`),
        `{"private_key":"[Private key masked]\\n"}`
      );
      assert.equal(
        engine.maskText(`{"private_key":"${ESCAPED_CRLF}"}`),
        `{"private_key":"[Private key masked]"}`
      );
    });

    test("should mask the key through the JSON tool text path used by list_project_variables", () => {
      const engine = createEnabledEngine();
      const text = JSON.stringify([{ key: "GCP_SA", value: variableValue }]);
      assert.equal(
        engine.maskToolResult({ content: [{ type: "text", text }] }).content[0].text,
        JSON.stringify([{ key: "GCP_SA", value: '{"private_key":"[Private key masked]"}' }])
      );
    });

    test("should mask the key on the structured path", () => {
      const engine = createEnabledEngine();
      assert.deepEqual(engine.maskValue([{ key: "GCP_SA", value: variableValue }]), [
        { key: "GCP_SA", value: '{"private_key":"[Private key masked]"}' },
      ]);
    });
  });

  describe("with a PEM body whose slashes are written as the JSON escape \\/", () => {
    const SLASHED_KEY = [
      "-----BEGIN PRIVATE KEY-----",
      "MIIEvQIBADANBgkqhkiG9w0BAQEFAASC/KcwggSjAgEAAoIBAQ+slash/Key==",
      "-----END PRIVATE KEY-----",
    ].join("\n");
    const ESCAPED = escapeJsonSlashes(SLASHED_KEY.replace(/\n/g, "\\n"));

    test("should mask plain job output that prints the key as JSON", () => {
      const engine = createEnabledEngine();
      assert.equal(
        engine.maskToolResult(
          { content: [{ type: "text", text: `{"private_key":"${ESCAPED}"}\n` }] },
          { textFormat: "plain" }
        ).content[0].text,
        `{"private_key":"[Private key masked]"}\n`
      );
    });

    test("should mask the key inside a nested JSON string value", () => {
      const engine = createEnabledEngine();
      const value = escapeJsonSlashes(JSON.stringify({ private_key: SLASHED_KEY }));
      const text = JSON.stringify([{ key: "GCP_SA", value }]);
      const masked = engine.maskToolResult({ content: [{ type: "text", text }] }).content[0].text;
      assert.equal(masked.includes("slash"), false);
      assert.deepEqual(JSON.parse(masked), [
        { key: "GCP_SA", value: '{"private_key":"[Private key masked]"}' },
      ]);
    });
  });
});

describe("When builtin AWS key masking runs", () => {
  describe("with AKIA and ASIA access key IDs", () => {
    test("should replace the access key IDs", () => {
      const engine = createEnabledEngine();
      assert.equal(engine.maskText(`id=${EXAMPLE_AWS_ACCESS_KEY}`), "id=[AWS key masked]");
      assert.equal(engine.maskText(EXAMPLE_AWS_TEMP_KEY), "[AWS key masked]");
    });
  });

  describe("with an aws_secret_access_key assignment", () => {
    test("should replace the assignment including the secret", () => {
      const engine = createEnabledEngine();
      assert.equal(
        engine.maskText(`AWS_SECRET_ACCESS_KEY=${EXAMPLE_AWS_SECRET}`),
        "[AWS key masked]"
      );
      assert.equal(
        engine.maskText(`aws_secret_access_key: ${EXAMPLE_AWS_SECRET}`),
        "[AWS key masked]"
      );
    });
  });

  describe("with a JSON-formatted AWS secret assignment", () => {
    test("should mask the secret in the serialized object", () => {
      const engine = createEnabledEngine();
      const masked = engine.maskText(JSON.stringify({ AWS_SECRET_ACCESS_KEY: EXAMPLE_AWS_SECRET }));
      assert.equal(masked.includes(EXAMPLE_AWS_SECRET), false);
      assert.match(masked, /\[AWS key masked\]/);
    });
  });

  describe("with a JSON-formatted AWS secret whose slashes are escaped as \\/", () => {
    test("should mask the secret in plain job output", () => {
      const engine = createEnabledEngine();
      const escaped = escapeJsonSlashes(EXAMPLE_AWS_SECRET);
      assert.equal(
        engine.maskText(`{"AWS_SECRET_ACCESS_KEY":"${escaped}"}`),
        '{"[AWS key masked]"}'
      );
      assert.equal(
        engine.maskText(`{"AWS_SECRET_ACCESS_KEY":"${escaped}X"}`),
        `{"AWS_SECRET_ACCESS_KEY":"${escaped}X"}`
      );
    });
  });

  describe("with a structured AWS secret field", () => {
    test("should mask the field value", () => {
      const engine = createEnabledEngine();
      assert.deepEqual(engine.maskValue({ AWS_SECRET_ACCESS_KEY: EXAMPLE_AWS_SECRET }), {
        AWS_SECRET_ACCESS_KEY: "[AWS key masked]",
      });
    });
  });

  describe("with JSON tool text containing an AWS secret field", () => {
    test("should mask the field value", () => {
      const engine = createEnabledEngine();
      const result = engine.maskToolResult({
        content: [
          {
            type: "text",
            text: JSON.stringify({ AWS_SECRET_ACCESS_KEY: EXAMPLE_AWS_SECRET }),
          },
        ],
      });
      assert.equal(
        result.content[0].text,
        JSON.stringify({ AWS_SECRET_ACCESS_KEY: "[AWS key masked]" })
      );
    });
  });

  describe("with a custom keyword that matches an AWS secret prefix", () => {
    test("should still mask the complete field value", () => {
      const engine = createEnabledEngine({
        rules: [{ id: "prefix", type: "keyword", match: "AAAA", replacement: "[prefix]" }],
      });
      const secret = `AAAA${"B".repeat(36)}`;
      assert.deepEqual(engine.maskValue({ AWS_SECRET_ACCESS_KEY: secret }), {
        AWS_SECRET_ACCESS_KEY: "[AWS key masked]",
      });
    });
  });

  describe("with the aws-access-key builtin disabled", () => {
    test("should leave structured AWS secret fields visible", () => {
      const engine = createEnabledEngine({ builtins: { "aws-access-key": { enabled: false } } });
      assert.deepEqual(engine.maskValue({ AWS_SECRET_ACCESS_KEY: EXAMPLE_AWS_SECRET }), {
        AWS_SECRET_ACCESS_KEY: EXAMPLE_AWS_SECRET,
      });
    });
  });

  describe("with a user rule whose id collides with aws-access-key", () => {
    test("should still use the builtin field replacement", () => {
      const engine = createEnabledEngine({
        rules: [
          {
            id: "aws-access-key",
            type: "keyword",
            match: "not-the-secret",
            replacement: "[user]",
          },
        ],
      });
      assert.deepEqual(engine.maskValue({ AWS_SECRET_ACCESS_KEY: EXAMPLE_AWS_SECRET }), {
        AWS_SECRET_ACCESS_KEY: "[AWS key masked]",
      });
    });
  });

  describe("with a colliding user rule while the aws-access-key builtin is disabled", () => {
    test("should leave structured AWS secret fields visible", () => {
      const engine = createEnabledEngine({
        builtins: { "aws-access-key": { enabled: false } },
        rules: [
          {
            id: "aws-access-key",
            type: "keyword",
            match: "not-the-secret",
            replacement: "[user]",
          },
        ],
      });
      assert.deepEqual(engine.maskValue({ AWS_SECRET_ACCESS_KEY: EXAMPLE_AWS_SECRET }), {
        AWS_SECRET_ACCESS_KEY: EXAMPLE_AWS_SECRET,
      });
    });
  });

  describe("with a GitLab CI variable record", () => {
    test("should mask the value when key names an AWS secret", () => {
      const engine = createEnabledEngine();
      assert.deepEqual(
        engine.maskValue({
          key: "AWS_SECRET_ACCESS_KEY",
          value: EXAMPLE_AWS_SECRET,
          protected: false,
        }),
        { key: "AWS_SECRET_ACCESS_KEY", value: "[AWS key masked]", protected: false }
      );
    });
  });

  describe("with JSON tool text for a GitLab CI variable record", () => {
    test("should mask the value for either property order", () => {
      const engine = createEnabledEngine();
      const keyFirst = JSON.stringify({
        key: "AWS_SECRET_ACCESS_KEY",
        value: EXAMPLE_AWS_SECRET,
      });
      const valueFirst = `{"value":"${EXAMPLE_AWS_SECRET}","key":"AWS_SECRET_ACCESS_KEY"}`;
      assert.equal(
        engine.maskToolResult({ content: [{ type: "text", text: keyFirst }] }).content[0].text,
        JSON.stringify({ key: "AWS_SECRET_ACCESS_KEY", value: "[AWS key masked]" })
      );
      assert.equal(
        engine.maskToolResult({ content: [{ type: "text", text: valueFirst }] }).content[0].text,
        `{"value":"[AWS key masked]","key":"AWS_SECRET_ACCESS_KEY"}`
      );
    });
  });

  describe("with a GitLab CI variable that is not an AWS secret", () => {
    test("should leave a 40-character value unchanged", () => {
      const engine = createEnabledEngine();
      const record = { key: "EXAMPLE_TOKEN", value: EXAMPLE_AWS_SECRET };
      assert.deepEqual(engine.maskValue(record), record);
    });
  });

  describe("with commit SHAs and short or lowercase lookalikes", () => {
    test("should leave the text unchanged", () => {
      const engine = createEnabledEngine();
      assert.equal(engine.maskText(EXAMPLE_COMMIT_SHA), EXAMPLE_COMMIT_SHA);
      assert.equal(engine.maskText("AKIA123"), "AKIA123");
      assert.equal(engine.maskText("akiaIOSFODNN7EXAMPLE"), "akiaIOSFODNN7EXAMPLE");
      assert.equal(
        engine.maskText(`password=${EXAMPLE_AWS_SECRET}`),
        `password=${EXAMPLE_AWS_SECRET}`
      );
    });
  });
});

describe("When JSON tool text nests containers under an AWS secret field", () => {
  const SECRET = "A".repeat(40);
  const MASKED = "[AWS key masked]";
  const maskJsonText = (engine: ReturnType<typeof createEnabledEngine>, text: string): string =>
    engine.maskToolResult({ content: [{ type: "text", text }] }).content[0].text;

  test("masks a secret array element that follows a nested object", () => {
    const engine = createEnabledEngine();
    const text = JSON.stringify({ AWS_SECRET_ACCESS_KEY: [{ note: "metadata" }, SECRET] });
    assert.equal(
      maskJsonText(engine, text),
      JSON.stringify({ AWS_SECRET_ACCESS_KEY: [{ note: "metadata" }, MASKED] })
    );
  });

  test("masks every secret array element around a nested object", () => {
    const engine = createEnabledEngine();
    const text = JSON.stringify({ AWS_SECRET_ACCESS_KEY: [SECRET, { note: "m" }, SECRET] });
    assert.equal(
      maskJsonText(engine, text),
      JSON.stringify({ AWS_SECRET_ACCESS_KEY: [MASKED, { note: "m" }, MASKED] })
    );
  });

  test("keeps the field name through objects and arrays nested inside an array", () => {
    const engine = createEnabledEngine();
    const text = JSON.stringify({
      items: [{ AWS_SECRET_ACCESS_KEY: [[{ a: { b: "c" } }], SECRET] }],
    });
    assert.equal(
      maskJsonText(engine, text),
      JSON.stringify({ items: [{ AWS_SECRET_ACCESS_KEY: [[{ a: { b: "c" } }], MASKED] }] })
    );
  });

  test("restores the enclosing field name and reads the next sibling key after nested containers", () => {
    const engine = createEnabledEngine();
    const text = JSON.stringify({
      AWS_SECRET_ACCESS_KEY: [[{ n: "m" }], SECRET],
      plain: SECRET,
    });
    assert.equal(
      maskJsonText(engine, text),
      JSON.stringify({ AWS_SECRET_ACCESS_KEY: [[{ n: "m" }], MASKED], plain: SECRET })
    );
  });

  test("applies only the nearest property name to values of a nested object", () => {
    const engine = createEnabledEngine();
    const text = JSON.stringify({ AWS_SECRET_ACCESS_KEY: { note: SECRET } });
    assert.equal(maskJsonText(engine, text), text);
  });

  test("leaves strings in non-secret fields untouched", () => {
    const engine = createEnabledEngine();
    const text = JSON.stringify({
      note: "metadata",
      items: [{ name: "ci" }, "plain"],
      AWS_SECRET_ACCESS_KEY: [{ note: "metadata" }, SECRET],
    });
    assert.equal(
      maskJsonText(engine, text),
      JSON.stringify({
        note: "metadata",
        items: [{ name: "ci" }, "plain"],
        AWS_SECRET_ACCESS_KEY: [{ note: "metadata" }, MASKED],
      })
    );
  });

  test("preserves numbers and whitespace byte-for-byte around a masked value", () => {
    const engine = createEnabledEngine();
    const text = [
      "{\n",
      '\t"id": 12345678901234567890.123456789,\n',
      '  "AWS_SECRET_ACCESS_KEY" :  [ {"note": "metadata" } ,\t',
      JSON.stringify(SECRET),
      " ],\n",
      '  "ratio":  -0.0e+00\n}\n',
    ].join("");
    assert.equal(
      maskJsonText(engine, text),
      text.replace(JSON.stringify(SECRET), JSON.stringify(MASKED))
    );
  });

  test("keeps the whole secret masked when a keyword rule matches only its prefix inside an array", () => {
    const engine = createEnabledEngine({
      rules: [{ id: "prefix", type: "keyword", match: "AAAA", replacement: "[prefix]" }],
    });
    const secret = `AAAA${"B".repeat(36)}`;
    const text = JSON.stringify({ AWS_SECRET_ACCESS_KEY: [{ note: "metadata" }, secret] });
    assert.equal(
      maskJsonText(engine, text),
      JSON.stringify({ AWS_SECRET_ACCESS_KEY: [{ note: "metadata" }, MASKED] })
    );
  });

  const parityFixtures: Array<Record<string, unknown>> = [
    { AWS_SECRET_ACCESS_KEY: [{ note: "metadata" }, SECRET] },
    { AWS_SECRET_ACCESS_KEY: [SECRET, { note: "m" }, SECRET] },
    { items: [{ AWS_SECRET_ACCESS_KEY: [[{ a: { b: "c" } }], SECRET] }] },
    { AWS_SECRET_ACCESS_KEY: { note: SECRET } },
    {
      download_url: ["http://10.20.30.40/file"],
      nested: [{ download_url: "http://10.20.30.40/x" }],
    },
    { id: 1234567890123, AWS_SECRET_ACCESS_KEY: [{ n: 1 }, SECRET] },
    { key: "AWS_SECRET_ACCESS_KEY", value: SECRET, protected: false },
    { value: SECRET, key: "AWS_SECRET_ACCESS_KEY" },
  ];
  for (const fixture of parityFixtures) {
    test(`matches maskValue for ${JSON.stringify(fixture)}`, () => {
      const engine = createEnabledEngine();
      assert.deepEqual(
        JSON.parse(maskJsonText(engine, JSON.stringify(fixture))),
        engine.maskValue(fixture)
      );
    });
  }
});

describe("When a GitLab CI/CD variable is flagged masked or hidden", () => {
  const REPLACEMENT = "[Masked CI variable value]";
  const ciVariable = (value: unknown, flags: Record<string, unknown>) => ({
    variable_type: "env_var",
    key: "DEPLOY_PASSWORD",
    value,
    protected: false,
    masked: false,
    hidden: false,
    raw: false,
    environment_scope: "*",
    ...flags,
  });
  const maskJsonText = (engine: ReturnType<typeof createEnabledEngine>, text: string): string =>
    engine.maskToolResult({ content: [{ type: "text", text }] }).content[0].text;

  test("masks the whole value of a masked variable on the JSON text path", () => {
    const engine = createEnabledEngine();
    const text = JSON.stringify([ciVariable("hunter2-plain-word", { masked: true })]);
    const masked = maskJsonText(engine, text);
    assert.ok(!masked.includes("hunter2-plain-word"), masked);
    assert.equal(JSON.parse(masked)[0].value, REPLACEMENT);
  });

  test("masks the value of a hidden variable on the structured path", () => {
    const engine = createEnabledEngine();
    assert.deepEqual(engine.maskValue(ciVariable("s3cr3t", { masked: true, hidden: true })), {
      ...ciVariable(REPLACEMENT, { masked: true, hidden: true }),
    });
    assert.deepEqual(engine.maskValue(ciVariable("s3cr3t", { hidden: true })), {
      ...ciVariable(REPLACEMENT, { hidden: true }),
    });
  });

  test("masks pretty-printed JSON and a flag that comes after the value", () => {
    const engine = createEnabledEngine();
    const text = JSON.stringify(
      { key: "TOKEN", value: "after-flag-secret", masked: true },
      null,
      2
    );
    assert.equal(JSON.parse(maskJsonText(engine, text)).value, REPLACEMENT);
  });

  test("leaves unflagged variables and non-variable objects alone", () => {
    const engine = createEnabledEngine();
    const plain = [
      ciVariable("visible-value", {}),
      ciVariable("visible-value", { masked: "true" }),
      { value: "no-key-object", masked: true },
      { key: "K", value: "nested-flag", meta: { masked: true } },
    ];
    assert.deepEqual(engine.maskValue(plain), plain);
    assert.equal(maskJsonText(engine, JSON.stringify(plain)), JSON.stringify(plain));
  });

  const flagParityFixtures: Array<Record<string, unknown>> = [
    ciVariable("a-secret", { masked: true }),
    ciVariable("a-secret", { hidden: true }),
    ciVariable(null, { masked: true, hidden: true }),
    ciVariable("visible", {}),
    { items: [ciVariable("a-secret", { masked: true }), ciVariable("visible", {})] },
    { key: "K", value: ["array-element"], masked: true },
    { key: "K", value: "v", meta: { masked: true } },
    { key: 1, value: "numeric-key", masked: true },
  ];
  for (const fixture of flagParityFixtures) {
    test(`text and structured paths agree for ${JSON.stringify(fixture)}`, () => {
      const engine = createEnabledEngine();
      assert.deepEqual(
        JSON.parse(maskJsonText(engine, JSON.stringify(fixture))),
        engine.maskValue(fixture)
      );
    });
  }
});

describe("When a GitLab CI/CD variable is flagged inside text that is not pure JSON", () => {
  const REPLACEMENT = "[Masked CI variable value]";
  const variable = (key: string, value: string, flags: Record<string, unknown>) => ({
    variable_type: "env_var",
    key,
    value,
    protected: false,
    masked: false,
    hidden: false,
    raw: false,
    environment_scope: "*",
    ...flags,
  });
  const textOf = (
    engine: ReturnType<typeof createEnabledEngine>,
    text: string,
    textFormat?: "plain" | "json"
  ): string =>
    engine.maskToolResult(
      { content: [{ type: "text", text }] },
      textFormat ? { textFormat } : undefined
    ).content[0].text;

  test("masks flagged records in a JSON array embedded in prose", () => {
    const engine = createEnabledEngine();
    const records = [
      variable("PROSE_SECRET", "prose-secret-value-1", { masked: true }),
      variable("PROSE_VISIBLE", "prose-visible-value-1", {}),
    ];
    const masked = textOf(engine, `Response: ${JSON.stringify(records)} (2 variables)`);
    assert.ok(!masked.includes("prose-secret-value-1"), masked);
    assert.ok(masked.includes(REPLACEMENT), masked);
    assert.ok(masked.includes("prose-visible-value-1"), masked);
    assert.ok(masked.startsWith("Response: ") && masked.endsWith(" (2 variables)"), masked);
  });

  test("masks flagged records in pretty-printed JSON inside a plain-text job log", () => {
    const engine = createEnabledEngine();
    const records = [
      variable("LOG_MASKED", "log-masked-secret-2", { masked: true }),
      variable("LOG_HIDDEN", "log-hidden-secret-3", { masked: true, hidden: true }),
      variable("LOG_VISIBLE", "log-visible-value-4", {}),
    ];
    const log = [
      '$ curl --header "PRIVATE-TOKEN: $TOKEN" "$CI_API_V4_URL/projects/42/variables"',
      JSON.stringify(records, null, 2),
      "Job succeeded",
    ].join("\n");
    const masked = textOf(engine, log, "plain");
    assert.ok(!masked.includes("log-masked-secret-2"), masked);
    assert.ok(!masked.includes("log-hidden-secret-3"), masked);
    assert.ok(masked.includes("log-visible-value-4"), masked);
    assert.ok(masked.includes(REPLACEMENT), masked);
    assert.equal(masked.split("\n").length, log.split("\n").length, "line layout is kept");
    assert.ok(masked.endsWith("Job succeeded"), masked);
  });

  test("masks the complete records of a truncated array and its flagged tail", () => {
    const engine = createEnabledEngine();
    const first = JSON.stringify(
      variable("TRUNC_FIRST", "truncated-first-secret", { masked: true })
    );
    // The second record is cut after its flag, so its value is in an uncovered gap.
    const text = `[${first},{"key":"TRUNC_SECOND","value":"truncated-second-secret","masked":true`;
    const masked = textOf(engine, text);
    assert.ok(!masked.includes("truncated-first-secret"), masked);
    assert.ok(!masked.includes("truncated-second-secret"), masked);
    assert.ok(masked.includes(REPLACEMENT), masked);
  });

  test("masks a complete truncated record even when the next record is cut before its flag", () => {
    const engine = createEnabledEngine();
    const first = JSON.stringify(variable("CUT_FIRST", "cut-first-secret", { masked: true }));
    // The cut-off record has no flag yet, so it is not asserted either way.
    const masked = textOf(engine, `[${first},{"key":"CUT_SECOND","value":"cut-second-value"`);
    assert.ok(!masked.includes("cut-first-secret"), masked);
    assert.ok(masked.includes(REPLACEMENT), masked);
  });

  test("masks flagged records in newline-delimited and concatenated JSON", () => {
    const engine = createEnabledEngine();
    const records = [
      variable("NDJ_A", "ndjson-secret-a", { masked: true }),
      variable("NDJ_B", "ndjson-secret-b", { hidden: true }),
      variable("NDJ_C", "ndjson-visible-c", {}),
    ];
    for (const text of [
      records.map(record => JSON.stringify(record)).join("\n"),
      records.map(record => JSON.stringify(record)).join(""),
    ]) {
      const masked = textOf(engine, text);
      assert.ok(!masked.includes("ndjson-secret-a"), masked);
      assert.ok(!masked.includes("ndjson-secret-b"), masked);
      assert.ok(masked.includes("ndjson-visible-c"), masked);
      assert.ok(masked.includes(REPLACEMENT), masked);
    }
  });

  test("masks flagged records in JSON text held inside a JSON string on the pure-JSON path", () => {
    const engine = createEnabledEngine();
    const inner = JSON.stringify([
      variable("NESTED_SECRET", "nested-json-secret-x", { masked: true }),
    ]);
    const masked = textOf(engine, JSON.stringify({ output: inner, count: 1 }));
    assert.ok(!masked.includes("nested-json-secret-x"), masked);
    const parsed = JSON.parse(masked) as { output: string; count: number };
    assert.equal(parsed.count, 1);
    assert.equal(JSON.parse(parsed.output)[0].value, REPLACEMENT);
  });

  test("masks flagged records in escaped JSON inside a JSON string in prose", () => {
    const engine = createEnabledEngine();
    const inner = JSON.stringify([
      variable("PROSE_NESTED", "prose-nested-secret-y", { hidden: true }),
    ]);
    const masked = textOf(engine, `Response: ${JSON.stringify({ message: inner })}`);
    assert.ok(!masked.includes("prose-nested-secret-y"), masked);
    assert.ok(masked.includes(REPLACEMENT), masked);
    assert.ok(masked.startsWith("Response: {"), masked);
  });

  test("masks a flagged value in broken escaped JSON printed in a log line", () => {
    const engine = createEnabledEngine();
    const cases: Array<[string, string[]]> = [
      // A shell command that echoes a JSON payload: escaped, and the line is cut short.
      [
        'echo "{\\"key\\":\\"ESC_SECRET\\",\\"value\\":\\"escaped-log-secret-z\\",\\"masked\\":true',
        ["escaped-log-secret-z"],
      ],
      // The value itself contains an escaped quote; the tail must not remain visible.
      [
        'echo "{\\"key\\":\\"ESC_SECRET\\",\\"value\\":\\"prefix\\\\\\"secret-tail\\",\\"masked\\":true',
        ["secret-tail", "prefix"],
      ],
    ];
    for (const [line, secrets] of cases) {
      const masked = textOf(engine, line, "plain");
      for (const secret of secrets) {
        assert.ok(!masked.includes(secret), masked);
      }
      assert.ok(masked.includes(`\\"value\\":\\"${REPLACEMENT}\\"`), masked);
      assert.ok(masked.includes('\\"key\\":\\"ESC_SECRET\\"'), masked);
    }
  });

  test("masks a complete record whose flag name uses a JSON Unicode escape", () => {
    const engine = createEnabledEngine();
    const masked = textOf(
      engine,
      'Response: {"key":"UNI_SECRET","value":"unicode-flag-secret","ma\\u0073ked":true}',
      "plain"
    );
    assert.ok(!masked.includes("unicode-flag-secret"), masked);
    assert.ok(masked.includes(REPLACEMENT), masked);
    assert.ok(masked.startsWith("Response: "), masked);
    const hidden = textOf(
      engine,
      '{"key":"UNI_HIDDEN","value":"unicode-hidden-secret","hi\\u0064den":true}',
      "plain"
    );
    assert.ok(!hidden.includes("unicode-hidden-secret"), hidden);
    assert.ok(hidden.includes(REPLACEMENT), hidden);
  });

  test("masks a truncated record when a nested object sits between the flag and the value", () => {
    const engine = createEnabledEngine();
    const cases = [
      '{"key":"K","masked":true,"meta":{},"value":"split-gap-secret"',
      '{"key":"K","masked":true,"meta":{},"value":"invalid-close-secret",bad}',
      '{\n  "key": "K",\n  "masked": true,\n  "meta": {\n  },\n  "value": "pretty-split-secret"',
      // A complete object that is a later array element, after a comma.
      '{"key":"K","masked":true,"tags":["a",{"b":1}],"value":"array-gap-secret"',
      '{"key":"K","masked":true,"tags":[{"a":1}, {"b":2}],"value":"array-gap-secret"',
      // The flag comes after the nested object, so it follows the value.
      '{"key":"K","value":"split-gap-secret","meta":{},"masked":true',
      '{"key":"K","value":"split-gap-secret","meta":{},"masked":true,',
      '{"key":"K","value":"split-gap-secret","tags":[{"a":1}],"hidden":true',
    ];
    for (const text of cases) {
      const masked = textOf(engine, text, "plain");
      assert.ok(!masked.includes("split-gap-secret"), masked);
      assert.ok(!masked.includes("invalid-close-secret"), masked);
      assert.ok(!masked.includes("pretty-split-secret"), masked);
      assert.ok(!masked.includes("array-gap-secret"), masked);
      assert.ok(masked.includes(REPLACEMENT), masked);
    }
  });

  test("leaves a later unflagged record intact after a truncated flagged record with a nested object", () => {
    const engine = createEnabledEngine();
    const text =
      '{"key":"K","masked":true,"meta":{},"value":"split-gap-secret"\n{"key":"V","value":"should-stay-visible"}';
    const masked = textOf(engine, text, "plain");
    assert.ok(!masked.includes("split-gap-secret"), masked);
    assert.ok(masked.includes(REPLACEMENT), masked);
    assert.ok(masked.includes("should-stay-visible"), masked);
  });

  test("masks flagged records in the message of a returned error", () => {
    const engine = createEnabledEngine();
    const error = new Error(
      `GitLab API error: ${JSON.stringify([variable("ERR_SECRET", "error-message-secret-q", { hidden: true })])}`
    );
    const masked = engine.maskError(error) as Error;
    assert.ok(!masked.message.includes("error-message-secret-q"), masked.message);
    assert.ok(masked.message.includes(REPLACEMENT), masked.message);
  });

  test("leaves unflagged records and texts without a flag byte-for-byte unchanged", () => {
    const engine = createEnabledEngine();
    const unflagged = [
      `Listed: ${JSON.stringify([
        variable("VIS_A", "visible-a-value", {}),
        variable("VIS_B", "visible-b-value", { masked: "true" }),
      ])}`,
      '{"meta":{"masked":true}} and "value": "visible-c" in prose',
      'Job log line with "value": "not-a-flag-secret" and masked: true in prose',
      'C:\\users\\builder "value": "windows-path-visible"',
      'ma\\u0073ked in prose and "value": "unicode-prose-visible"',
    ];
    for (const text of unflagged) {
      assert.equal(textOf(engine, text, "plain"), text);
      assert.equal(textOf(engine, text), text);
      assert.equal(engine.maskText(text), text);
    }
  });

  test("still applies the other regex rules to the same text", () => {
    const engine = createEnabledEngine();
    const token = "glpat-TextRuleToken0123456789";
    const text = `token ${token} host 10.20.30.40 ${JSON.stringify([
      variable("RULE_SECRET", "rule-flagged-secret-r", { masked: true }),
    ])}`;
    const masked = engine.maskText(text);
    assert.ok(masked.includes("[Token masked]"), masked);
    assert.ok(masked.includes("[IP address]"), masked);
    assert.ok(!masked.includes(token), masked);
    assert.ok(!masked.includes("10.20.30.40"), masked);
    assert.ok(!masked.includes("rule-flagged-secret-r"), masked);
    assert.ok(masked.includes(REPLACEMENT), masked);
  });

  test("masks every record in a large log in linear time", () => {
    const engine = createEnabledEngine();
    const records = Array.from({ length: 4000 }, (_, index) =>
      variable(`BULK_${index}`, `bulk-secret-${index}`, { masked: true })
    );
    const log = `dump\n${JSON.stringify(records, null, 2)}\ndone`;
    const started = performance.now();
    const masked = textOf(engine, log, "plain");
    const elapsedMs = performance.now() - started;
    assert.ok(elapsedMs < 2000, `large log took ${elapsedMs.toFixed(0)} ms`);
    assert.ok(!/bulk-secret-\d/.test(masked), "a bulk secret survived");
    assert.equal(masked.split(REPLACEMENT).length - 1, records.length);
  });

  describe("with pathological text that carries a flag literal", () => {
    const FLAG = '"masked":true ';
    const MEGABYTE = 1_000_000;
    test("completes quickly for an incomplete flagged parent with many nested children (about 1 MB)", () => {
      const engine = createEnabledEngine();
      const text = `{"key":"K","masked":true,${'"m":{},'.repeat(Math.floor(MEGABYTE / 7))}"value":"many-children-secret"`;
      const started = performance.now();
      const masked = engine.maskText(text);
      const elapsedMs = performance.now() - started;
      assert.ok(elapsedMs < 2000, `many nested children took ${elapsedMs.toFixed(0)} ms`);
      assert.ok(!masked.includes("many-children-secret"), "flagged value survived");
    });

    test("completes quickly for many open arrays before an incomplete flagged parent with many children", () => {
      const engine = createEnabledEngine();
      const count = 100_000;
      const text = `${"[".repeat(count)}{"key":"K","masked":true,${'"m":{},'.repeat(count)}"value":"deep-stack-secret"`;
      const started = performance.now();
      const masked = engine.maskText(text);
      const elapsedMs = performance.now() - started;
      assert.ok(elapsedMs < 2000, `open arrays with many children took ${elapsedMs.toFixed(0)} ms`);
      assert.ok(!masked.includes("deep-stack-secret"), "flagged value survived");
    });

    const deepBalancedInvalid = (depth: number) =>
      `${FLAG}${'{"a":'.repeat(depth)}{"key":"DEEP_KEY","value":"deep-tail-secret","masked":true,"x":bad}${"}".repeat(depth)}`;
    const cases: Array<[string, string]> = [
      ["unclosed deep objects", `${FLAG}${'{"a":'.repeat(Math.floor(MEGABYTE / 5))}`],
      ["a run of open braces", `${FLAG}${"{".repeat(MEGABYTE)}`],
      ["balanced but invalid at the tail", deepBalancedInvalid(150_000)],
    ];
    for (const [name, text] of cases) {
      test(`completes quickly for ${name} (about 1 MB)`, () => {
        const engine = createEnabledEngine();
        assert.ok(text.length >= 900_000, `fixture is ${text.length} characters`);
        const started = performance.now();
        const masked = engine.maskText(text);
        const elapsedMs = performance.now() - started;
        assert.ok(elapsedMs < 2000, `${name} took ${elapsedMs.toFixed(0)} ms`);
        if (name === "balanced but invalid at the tail") {
          assert.ok(!masked.includes("deep-tail-secret"), "uncovered flagged value survived");
        } else {
          assert.equal(masked, text);
        }
      });
    }
  });
});
