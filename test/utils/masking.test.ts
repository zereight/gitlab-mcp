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
