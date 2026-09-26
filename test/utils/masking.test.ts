import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, test } from "node:test";
import { createMaskingEngine, createMaskingPolicyResolver } from "../../masking/engine.js";
import { getManagedMaskingProjectIds } from "../../masking/project-scope.js";
import { allTools } from "../../tools/registry.js";

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
