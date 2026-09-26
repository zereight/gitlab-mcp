import { after, before, describe, it } from "node:test";
import assert from "node:assert";
import { spawn } from "child_process";
import { MockGitLabServer, findMockServerPort } from "./utils/mock-gitlab-server.js";

const MOCK_TOKEN = "glpat-mock-token-empty-toolsets";
const TEST_PROJECT_ID = "123";
const TEST_GROUP_ID = "10";
const TEST_LABEL_ID = "1";
const TEST_MILESTONE_ID = "1";
const TEST_WIKI_SLUG = "Home";
const TEST_TAG_NAME = "v1.0.0";
const TEST_ASSET_PATH = "hello-asset";
const ISO_NOW = "2026-03-13T10:00:00.000Z";

function buildUser() {
  return { id: "1", username: "tester", name: "Test User" };
}

function buildLabel(overrides: Record<string, unknown> = {}) {
  return {
    id: TEST_LABEL_ID,
    name: "bug",
    color: "#FF0000",
    text_color: "#FFFFFF",
    description: "A bug",
    description_html: "<p>A bug</p>",
    ...overrides,
  };
}

function buildWikiPage(overrides: Record<string, unknown> = {}) {
  return {
    title: "Home",
    slug: TEST_WIKI_SLUG,
    format: "markdown",
    content: "hello wiki",
    ...overrides,
  };
}

function buildProjectMilestone(overrides: Record<string, unknown> = {}) {
  return {
    id: TEST_MILESTONE_ID,
    iid: "1",
    project_id: TEST_PROJECT_ID,
    title: "v1",
    description: "First milestone",
    due_date: null,
    start_date: null,
    state: "active",
    updated_at: ISO_NOW,
    created_at: ISO_NOW,
    expired: false,
    ...overrides,
  };
}

function buildGroupMilestone(overrides: Record<string, unknown> = {}) {
  return {
    id: TEST_MILESTONE_ID,
    iid: "1",
    group_id: TEST_GROUP_ID,
    title: "v1",
    description: "First group milestone",
    due_date: null,
    start_date: null,
    state: "active",
    updated_at: ISO_NOW,
    created_at: ISO_NOW,
    expired: false,
    ...overrides,
  };
}

function buildIssue(overrides: Record<string, unknown> = {}) {
  return {
    id: "1",
    iid: "1",
    project_id: TEST_PROJECT_ID,
    title: "Issue one",
    description: "",
    state: "opened",
    author: buildUser(),
    assignees: [],
    labels: [],
    milestone: null,
    created_at: ISO_NOW,
    updated_at: ISO_NOW,
    closed_at: null,
    web_url: `https://gitlab.mock/project/${TEST_PROJECT_ID}/issues/1`,
    ...overrides,
  };
}

function buildMergeRequest(overrides: Record<string, unknown> = {}) {
  return {
    id: "1",
    iid: "1",
    project_id: TEST_PROJECT_ID,
    title: "MR one",
    description: "desc",
    state: "opened",
    author: buildUser(),
    source_branch: "feature",
    target_branch: "main",
    web_url: `https://gitlab.mock/project/${TEST_PROJECT_ID}/merge_requests/1`,
    created_at: ISO_NOW,
    updated_at: ISO_NOW,
    merged_at: null,
    closed_at: null,
    merge_commit_sha: null,
    ...overrides,
  };
}

function buildRelease(overrides: Record<string, unknown> = {}) {
  return {
    tag_name: TEST_TAG_NAME,
    name: TEST_TAG_NAME,
    description: "Release notes",
    created_at: ISO_NOW,
    ...overrides,
  };
}

function buildBurndownEvent() {
  return { created_at: ISO_NOW, action: "created" };
}

async function callTool(
  toolName: string,
  args: Record<string, unknown>,
  env: NodeJS.ProcessEnv
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const proc = spawn("node", ["build/index.js"], {
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        ...env,
      },
    });

    let output = "";
    let errorOutput = "";
    proc.stdout?.on("data", (d: Buffer) => (output += d));
    proc.stderr?.on("data", (d: Buffer) => (errorOutput += d));

    proc.on("close", code => {
      if (code !== 0) {
        return reject(new Error(`Process exited with code ${code}: ${errorOutput}`));
      }

      const line = output.split("\n").find(l => l.startsWith("{"));
      if (!line) {
        return reject(new Error("No JSON output found"));
      }

      try {
        const response = JSON.parse(line);
        if (response.error) {
          reject(response.error);
          return;
        }

        const content = response.result?.content?.[0]?.text;
        if (!content) {
          resolve(response.result);
          return;
        }

        try {
          resolve(JSON.parse(content));
        } catch {
          resolve(content);
        }
      } catch (error) {
        reject(error);
      }
    });

    proc.stdin?.end(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: toolName, arguments: args },
      }) + "\n"
    );
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

describe("When covering labels wiki milestones releases", () => {
  describe("with GITLAB_TOOLSETS labels,wiki,milestones,releases", () => {
    let mockGitLab: MockGitLabServer;
    let mockGitLabUrl: string;

    before(async () => {
      const mockPort = await findMockServerPort();
      mockGitLab = new MockGitLabServer({
        port: mockPort,
        validTokens: [MOCK_TOKEN],
      });

      const projectLabels = `/projects/${TEST_PROJECT_ID}/labels`;
      const projectLabel = `${projectLabels}/${TEST_LABEL_ID}`;
      const projectWikis = `/projects/${TEST_PROJECT_ID}/wikis`;
      const projectWiki = `${projectWikis}/${encodeURIComponent(TEST_WIKI_SLUG)}`;
      const groupWikis = `/groups/${TEST_GROUP_ID}/wikis`;
      const groupWiki = `${groupWikis}/${encodeURIComponent(TEST_WIKI_SLUG)}`;
      const projectMilestones = `/projects/${TEST_PROJECT_ID}/milestones`;
      const projectMilestone = `${projectMilestones}/${TEST_MILESTONE_ID}`;
      const groupMilestones = `/groups/${TEST_GROUP_ID}/milestones`;
      const groupMilestone = `${groupMilestones}/${TEST_MILESTONE_ID}`;
      const projectReleases = `/projects/${TEST_PROJECT_ID}/releases`;
      const projectRelease = `${projectReleases}/${encodeURIComponent(TEST_TAG_NAME)}`;

      mockGitLab.addMockHandler("get", projectLabels, (_req, res) => {
        res.json([buildLabel()]);
      });
      mockGitLab.addMockHandler("get", projectLabel, (_req, res) => {
        res.json(buildLabel());
      });
      mockGitLab.addMockHandler("post", projectLabels, (_req, res) => {
        res.json(buildLabel());
      });
      mockGitLab.addMockHandler("put", projectLabel, (_req, res) => {
        res.json(buildLabel({ name: "bugfix" }));
      });
      mockGitLab.addMockHandler("delete", projectLabel, (_req, res) => {
        res.status(204).send();
      });

      mockGitLab.addMockHandler("get", projectWikis, (_req, res) => {
        res.json([buildWikiPage()]);
      });
      mockGitLab.addMockHandler("get", projectWiki, (_req, res) => {
        res.json(buildWikiPage());
      });
      mockGitLab.addMockHandler("post", projectWikis, (_req, res) => {
        res.json(buildWikiPage());
      });
      mockGitLab.addMockHandler("put", projectWiki, (_req, res) => {
        res.json(buildWikiPage({ content: "updated wiki" }));
      });
      mockGitLab.addMockHandler("delete", projectWiki, (_req, res) => {
        res.status(204).send();
      });

      mockGitLab.addMockHandler("get", groupWikis, (_req, res) => {
        res.json([buildWikiPage({ title: "Group Home" })]);
      });
      mockGitLab.addMockHandler("get", groupWiki, (_req, res) => {
        res.json(buildWikiPage({ title: "Group Home" }));
      });
      mockGitLab.addMockHandler("post", groupWikis, (_req, res) => {
        res.json(buildWikiPage({ title: "Group Home" }));
      });
      mockGitLab.addMockHandler("put", groupWiki, (_req, res) => {
        res.json(buildWikiPage({ title: "Group Home", content: "updated group wiki" }));
      });
      mockGitLab.addMockHandler("delete", groupWiki, (_req, res) => {
        res.status(204).send();
      });

      mockGitLab.addMockHandler("get", projectMilestones, (_req, res) => {
        res.json([buildProjectMilestone()]);
      });
      mockGitLab.addMockHandler("get", projectMilestone, (_req, res) => {
        res.json(buildProjectMilestone());
      });
      mockGitLab.addMockHandler("post", projectMilestones, (_req, res) => {
        res.json(buildProjectMilestone());
      });
      mockGitLab.addMockHandler("put", projectMilestone, (_req, res) => {
        res.json(buildProjectMilestone({ title: "v1-edited" }));
      });
      mockGitLab.addMockHandler("delete", projectMilestone, (_req, res) => {
        res.status(204).send();
      });
      mockGitLab.addMockHandler("get", `${projectMilestone}/issues`, (_req, res) => {
        res.json([buildIssue()]);
      });
      mockGitLab.addMockHandler("get", `${projectMilestone}/merge_requests`, (_req, res) => {
        res.json([buildMergeRequest()]);
      });
      mockGitLab.addMockHandler("post", `${projectMilestone}/promote`, (_req, res) => {
        res.json(buildGroupMilestone());
      });
      mockGitLab.addMockHandler("get", `${projectMilestone}/burndown_events`, (_req, res) => {
        res.json([buildBurndownEvent()]);
      });

      mockGitLab.addMockHandler("get", groupMilestones, (_req, res) => {
        res.json([buildGroupMilestone()]);
      });
      mockGitLab.addMockHandler("get", groupMilestone, (_req, res) => {
        res.json(buildGroupMilestone());
      });
      mockGitLab.addMockHandler("post", groupMilestones, (_req, res) => {
        res.json(buildGroupMilestone());
      });
      mockGitLab.addMockHandler("put", groupMilestone, (_req, res) => {
        res.json(buildGroupMilestone({ title: "v1-group-edited" }));
      });
      mockGitLab.addMockHandler("delete", groupMilestone, (_req, res) => {
        res.status(204).send();
      });
      mockGitLab.addMockHandler("get", `${groupMilestone}/issues`, (_req, res) => {
        res.json([buildIssue()]);
      });
      mockGitLab.addMockHandler("get", `${groupMilestone}/merge_requests`, (_req, res) => {
        res.json([buildMergeRequest()]);
      });
      mockGitLab.addMockHandler("get", `${groupMilestone}/burndown_events`, (_req, res) => {
        res.json([buildBurndownEvent()]);
      });

      mockGitLab.addMockHandler("get", projectReleases, (_req, res) => {
        res.json([buildRelease()]);
      });
      mockGitLab.addMockHandler("get", projectRelease, (_req, res) => {
        res.json(buildRelease());
      });
      mockGitLab.addMockHandler("post", projectReleases, (_req, res) => {
        res.json(buildRelease());
      });
      mockGitLab.addMockHandler("put", projectRelease, (_req, res) => {
        res.json(buildRelease({ description: "updated notes" }));
      });
      mockGitLab.addMockHandler("delete", projectRelease, (_req, res) => {
        res.json(buildRelease());
      });
      mockGitLab.addMockHandler("post", `${projectRelease}/evidence`, (_req, res) => {
        res.status(201).send();
      });
      mockGitLab.addMockHandler(
        "get",
        `${projectRelease}/downloads/${TEST_ASSET_PATH}`,
        (_req, res) => {
          res.send("asset-bytes");
        }
      );

      await mockGitLab.start();
      mockGitLabUrl = mockGitLab.getUrl();
    });

    after(async () => {
      await mockGitLab.stop();
    });

    const env = () => ({
      GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
      GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
      GITLAB_TOOLSETS: "labels,wiki,milestones,releases",
    });

    it("should return a label from list_labels", async () => {
      const result = await callTool(
        "list_labels",
        { project_id: TEST_PROJECT_ID },
        env()
      );
      assert.ok(Array.isArray(result));
      assert.strictEqual(result[0].name, "bug");
    });

    it("should return a label from get_label", async () => {
      const result = await callTool(
        "get_label",
        { project_id: TEST_PROJECT_ID, label_id: TEST_LABEL_ID },
        env()
      );
      assert.ok(isRecord(result));
      assert.strictEqual(result.name, "bug");
    });

    it("should create a label with create_label", async () => {
      const result = await callTool(
        "create_label",
        { project_id: TEST_PROJECT_ID, name: "bug", color: "#FF0000" },
        env()
      );
      assert.ok(isRecord(result));
      assert.strictEqual(result.color, "#FF0000");
    });

    it("should update a label with update_label", async () => {
      const result = await callTool(
        "update_label",
        { project_id: TEST_PROJECT_ID, label_id: TEST_LABEL_ID, new_name: "bugfix" },
        env()
      );
      assert.ok(isRecord(result));
      assert.strictEqual(result.name, "bugfix");
    });

    it("should delete a label with delete_label", async () => {
      const result = await callTool(
        "delete_label",
        { project_id: TEST_PROJECT_ID, label_id: TEST_LABEL_ID },
        env()
      );
      assert.ok(isRecord(result));
      assert.strictEqual(result.status, "success");
    });

    it("should return wiki pages from list_wiki_pages", async () => {
      const result = await callTool(
        "list_wiki_pages",
        { project_id: TEST_PROJECT_ID },
        env()
      );
      assert.ok(Array.isArray(result));
      assert.strictEqual(result[0].slug, TEST_WIKI_SLUG);
    });

    it("should return a wiki page from get_wiki_page", async () => {
      const result = await callTool(
        "get_wiki_page",
        { project_id: TEST_PROJECT_ID, slug: TEST_WIKI_SLUG },
        env()
      );
      assert.ok(isRecord(result));
      assert.strictEqual(result.slug, TEST_WIKI_SLUG);
    });

    it("should create a wiki page with create_wiki_page", async () => {
      const result = await callTool(
        "create_wiki_page",
        { project_id: TEST_PROJECT_ID, title: "Home", content: "hello wiki" },
        env()
      );
      assert.ok(isRecord(result));
      assert.strictEqual(result.title, "Home");
    });

    it("should update a wiki page with update_wiki_page", async () => {
      const result = await callTool(
        "update_wiki_page",
        { project_id: TEST_PROJECT_ID, slug: TEST_WIKI_SLUG, content: "updated wiki" },
        env()
      );
      assert.ok(isRecord(result));
      assert.strictEqual(result.content, "updated wiki");
    });

    it("should delete a wiki page with delete_wiki_page", async () => {
      const result = await callTool(
        "delete_wiki_page",
        { project_id: TEST_PROJECT_ID, slug: TEST_WIKI_SLUG },
        env()
      );
      assert.ok(isRecord(result));
      assert.strictEqual(result.status, "success");
    });

    it("should return group wiki pages from list_group_wiki_pages", async () => {
      const result = await callTool(
        "list_group_wiki_pages",
        { group_id: TEST_GROUP_ID },
        env()
      );
      assert.ok(Array.isArray(result));
      assert.strictEqual(result[0].title, "Group Home");
    });

    it("should return a group wiki page from get_group_wiki_page", async () => {
      const result = await callTool(
        "get_group_wiki_page",
        { group_id: TEST_GROUP_ID, slug: TEST_WIKI_SLUG },
        env()
      );
      assert.ok(isRecord(result));
      assert.strictEqual(result.title, "Group Home");
    });

    it("should create a group wiki page with create_group_wiki_page", async () => {
      const result = await callTool(
        "create_group_wiki_page",
        { group_id: TEST_GROUP_ID, title: "Home", content: "hello wiki" },
        env()
      );
      assert.ok(isRecord(result));
      assert.strictEqual(result.title, "Group Home");
    });

    it("should update a group wiki page with update_group_wiki_page", async () => {
      const result = await callTool(
        "update_group_wiki_page",
        { group_id: TEST_GROUP_ID, slug: TEST_WIKI_SLUG, content: "updated group wiki" },
        env()
      );
      assert.ok(isRecord(result));
      assert.strictEqual(result.content, "updated group wiki");
    });

    it("should delete a group wiki page with delete_group_wiki_page", async () => {
      const result = await callTool(
        "delete_group_wiki_page",
        { group_id: TEST_GROUP_ID, slug: TEST_WIKI_SLUG },
        env()
      );
      assert.ok(isRecord(result));
      assert.strictEqual(result.status, "success");
    });

    it("should return milestones from list_milestones", async () => {
      const result = await callTool(
        "list_milestones",
        { project_id: TEST_PROJECT_ID },
        env()
      );
      assert.ok(Array.isArray(result));
      assert.strictEqual(result[0].title, "v1");
    });

    it("should return a milestone from get_milestone", async () => {
      const result = await callTool(
        "get_milestone",
        { project_id: TEST_PROJECT_ID, milestone_id: TEST_MILESTONE_ID },
        env()
      );
      assert.ok(isRecord(result));
      assert.strictEqual(result.id, TEST_MILESTONE_ID);
    });

    it("should create a milestone with create_milestone", async () => {
      const result = await callTool(
        "create_milestone",
        { project_id: TEST_PROJECT_ID, title: "v1" },
        env()
      );
      assert.ok(isRecord(result));
      assert.strictEqual(result.title, "v1");
    });

    it("should edit a milestone with edit_milestone", async () => {
      const result = await callTool(
        "edit_milestone",
        {
          project_id: TEST_PROJECT_ID,
          milestone_id: TEST_MILESTONE_ID,
          title: "v1-edited",
        },
        env()
      );
      assert.ok(isRecord(result));
      assert.strictEqual(result.title, "v1-edited");
    });

    it("should delete a milestone with delete_milestone", async () => {
      const result = await callTool(
        "delete_milestone",
        { project_id: TEST_PROJECT_ID, milestone_id: TEST_MILESTONE_ID },
        env()
      );
      assert.ok(isRecord(result));
      assert.strictEqual(result.status, "success");
    });

    it("should return issues from get_milestone_issue", async () => {
      const result = await callTool(
        "get_milestone_issue",
        { project_id: TEST_PROJECT_ID, milestone_id: TEST_MILESTONE_ID },
        env()
      );
      assert.ok(Array.isArray(result));
      assert.strictEqual(result[0].title, "Issue one");
    });

    it("should return merge requests from get_milestone_merge_requests", async () => {
      const result = await callTool(
        "get_milestone_merge_requests",
        { project_id: TEST_PROJECT_ID, milestone_id: TEST_MILESTONE_ID },
        env()
      );
      assert.ok(Array.isArray(result));
      assert.strictEqual(result[0].title, "MR one");
    });

    it("should promote a milestone with promote_milestone", async () => {
      const result = await callTool(
        "promote_milestone",
        { project_id: TEST_PROJECT_ID, milestone_id: TEST_MILESTONE_ID },
        env()
      );
      assert.ok(isRecord(result));
      assert.strictEqual(result.group_id, TEST_GROUP_ID);
    });

    it("should return events from get_milestone_burndown_events", async () => {
      const result = await callTool(
        "get_milestone_burndown_events",
        { project_id: TEST_PROJECT_ID, milestone_id: TEST_MILESTONE_ID },
        env()
      );
      assert.ok(Array.isArray(result));
      assert.strictEqual(result[0].action, "created");
    });

    it("should return group milestones from list_group_milestones", async () => {
      const result = await callTool(
        "list_group_milestones",
        { group_id: TEST_GROUP_ID },
        env()
      );
      assert.ok(Array.isArray(result));
      assert.strictEqual(result[0].group_id, TEST_GROUP_ID);
    });

    it("should return a group milestone from get_group_milestone", async () => {
      const result = await callTool(
        "get_group_milestone",
        { group_id: TEST_GROUP_ID, milestone_id: TEST_MILESTONE_ID },
        env()
      );
      assert.ok(isRecord(result));
      assert.strictEqual(result.group_id, TEST_GROUP_ID);
    });

    it("should create a group milestone with create_group_milestone", async () => {
      const result = await callTool(
        "create_group_milestone",
        { group_id: TEST_GROUP_ID, title: "v1" },
        env()
      );
      assert.ok(isRecord(result));
      assert.strictEqual(result.title, "v1");
    });

    it("should edit a group milestone with edit_group_milestone", async () => {
      const result = await callTool(
        "edit_group_milestone",
        {
          group_id: TEST_GROUP_ID,
          milestone_id: TEST_MILESTONE_ID,
          title: "v1-group-edited",
        },
        env()
      );
      assert.ok(isRecord(result));
      assert.strictEqual(result.title, "v1-group-edited");
    });

    it("should delete a group milestone with delete_group_milestone", async () => {
      const result = await callTool(
        "delete_group_milestone",
        { group_id: TEST_GROUP_ID, milestone_id: TEST_MILESTONE_ID },
        env()
      );
      assert.ok(isRecord(result));
      assert.strictEqual(result.status, "success");
    });

    it("should return issues from get_group_milestone_issue", async () => {
      const result = await callTool(
        "get_group_milestone_issue",
        { group_id: TEST_GROUP_ID, milestone_id: TEST_MILESTONE_ID },
        env()
      );
      assert.ok(Array.isArray(result));
      assert.strictEqual(result[0].title, "Issue one");
    });

    it("should return merge requests from get_group_milestone_merge_requests", async () => {
      const result = await callTool(
        "get_group_milestone_merge_requests",
        { group_id: TEST_GROUP_ID, milestone_id: TEST_MILESTONE_ID },
        env()
      );
      assert.ok(Array.isArray(result));
      assert.strictEqual(result[0].title, "MR one");
    });

    it("should return events from get_group_milestone_burndown_events", async () => {
      const result = await callTool(
        "get_group_milestone_burndown_events",
        { group_id: TEST_GROUP_ID, milestone_id: TEST_MILESTONE_ID },
        env()
      );
      assert.ok(Array.isArray(result));
      assert.strictEqual(result[0].action, "created");
    });

    it("should return releases from list_releases", async () => {
      const result = await callTool(
        "list_releases",
        { project_id: TEST_PROJECT_ID },
        env()
      );
      assert.ok(Array.isArray(result));
      assert.strictEqual(result[0].tag_name, TEST_TAG_NAME);
    });

    it("should return a release from get_release", async () => {
      const result = await callTool(
        "get_release",
        { project_id: TEST_PROJECT_ID, tag_name: TEST_TAG_NAME },
        env()
      );
      assert.ok(isRecord(result));
      assert.strictEqual(result.tag_name, TEST_TAG_NAME);
    });

    it("should create a release with create_release", async () => {
      const result = await callTool(
        "create_release",
        { project_id: TEST_PROJECT_ID, tag_name: TEST_TAG_NAME },
        env()
      );
      assert.ok(isRecord(result));
      assert.strictEqual(result.tag_name, TEST_TAG_NAME);
    });

    it("should update a release with update_release", async () => {
      const result = await callTool(
        "update_release",
        {
          project_id: TEST_PROJECT_ID,
          tag_name: TEST_TAG_NAME,
          description: "updated notes",
        },
        env()
      );
      assert.ok(isRecord(result));
      assert.strictEqual(result.description, "updated notes");
    });

    it("should delete a release with delete_release", async () => {
      const result = await callTool(
        "delete_release",
        { project_id: TEST_PROJECT_ID, tag_name: TEST_TAG_NAME },
        env()
      );
      assert.ok(isRecord(result));
      assert.strictEqual(result.status, "success");
    });

    it("should create evidence with create_release_evidence", async () => {
      const result = await callTool(
        "create_release_evidence",
        { project_id: TEST_PROJECT_ID, tag_name: TEST_TAG_NAME },
        env()
      );
      assert.ok(isRecord(result));
      assert.strictEqual(result.status, "success");
    });

    it("should download an asset with download_release_asset", async () => {
      const result = await callTool(
        "download_release_asset",
        {
          project_id: TEST_PROJECT_ID,
          tag_name: TEST_TAG_NAME,
          direct_asset_path: TEST_ASSET_PATH,
        },
        env()
      );
      assert.strictEqual(result, "asset-bytes");
    });
  });
});
