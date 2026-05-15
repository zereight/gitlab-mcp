import { after, before, describe, test } from "node:test";
import assert from "node:assert";
import { spawn } from "child_process";
import { MockGitLabServer, findMockServerPort } from "./utils/mock-gitlab-server.js";

const MOCK_TOKEN = "glpat-mock-token-snippets";
const TEST_PROJECT_ID = "456";
const TEST_PROJECT_SNIPPET_ID = 42;
const TEST_PERSONAL_SNIPPET_ID = 99;
const TEST_MULTIFILE_SNIPPET_ID = 77;
const TEST_MASTER_SNIPPET_ID = 88;
const TEST_SLASH_REF_SNIPPET_ID = 101;
const TEST_EXPLICIT_REF_SNIPPET_ID = 102;
const TEST_NESTED_PATH_SNIPPET_ID = 103;
const TEST_NO_VISIBILITY_SNIPPET_ID = 104;
const RAW_CONTENT = "console.log('hello world');\n";
const MULTIFILE_A_CONTENT = "# policy\nbody A\n";
const MULTIFILE_B_CONTENT = "# instructions\nbody B\n";

function buildSnippet(overrides: Record<string, unknown> = {}) {
  return {
    id: TEST_PROJECT_SNIPPET_ID,
    title: "Example snippet",
    description: "An example snippet",
    visibility: "private",
    author: {
      id: 1,
      username: "tester",
      name: "Tester",
      state: "active",
      avatar_url: null,
      web_url: "https://gitlab.example.com/tester",
    },
    file_name: "hello.js",
    files: [{ path: "hello.js", raw_url: "https://gitlab.example.com/raw" }],
    web_url: "https://gitlab.example.com/-/snippets/42",
    raw_url: "https://gitlab.example.com/-/snippets/42/raw",
    created_at: "2026-05-10T10:00:00.000Z",
    updated_at: "2026-05-11T10:00:00.000Z",
    project_id: Number(TEST_PROJECT_ID),
    ...overrides,
  };
}

async function callTool(
  toolName: string,
  args: Record<string, unknown>,
  env: NodeJS.ProcessEnv
): Promise<any> {
  return new Promise<any>((resolve, reject) => {
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

describe("snippet tools", () => {
  let mockGitLab: MockGitLabServer;
  let mockGitLabUrl: string;
  let lastCreateBody: any = null;
  let lastUpdateBody: any = null;
  let deleteCalled = false;

  before(async () => {
    const mockPort = await findMockServerPort(20000, 50);
    mockGitLab = new MockGitLabServer({
      port: mockPort,
      validTokens: [MOCK_TOKEN],
    });

    // --- Project snippet handlers ---
    mockGitLab.addMockHandler(
      "get",
      `/projects/${TEST_PROJECT_ID}/snippets`,
      (req, res) => {
        assert.strictEqual(req.query.per_page, "5");
        res.json([buildSnippet()]);
      }
    );

    mockGitLab.addMockHandler(
      "get",
      `/projects/${TEST_PROJECT_ID}/snippets/${TEST_PROJECT_SNIPPET_ID}`,
      (_req, res) => {
        res.json(buildSnippet());
      }
    );

    mockGitLab.addMockHandler(
      "get",
      `/projects/${TEST_PROJECT_ID}/snippets/${TEST_PROJECT_SNIPPET_ID}/raw`,
      (_req, res) => {
        res.type("text/plain").send(RAW_CONTENT);
      }
    );

    mockGitLab.addMockHandler(
      "post",
      `/projects/${TEST_PROJECT_ID}/snippets`,
      (req, res) => {
        lastCreateBody = req.body;
        res.status(201).json(
          buildSnippet({
            id: 100,
            title: req.body.title,
            description: req.body.description ?? null,
            visibility: req.body.visibility,
            file_name: req.body.files?.[0]?.file_path,
          })
        );
      }
    );

    mockGitLab.addMockHandler(
      "put",
      `/projects/${TEST_PROJECT_ID}/snippets/${TEST_PROJECT_SNIPPET_ID}`,
      (req, res) => {
        lastUpdateBody = req.body;
        res.json(
          buildSnippet({
            title: req.body.title ?? "Example snippet",
            description: req.body.description ?? "An example snippet",
            visibility: req.body.visibility ?? "private",
          })
        );
      }
    );

    mockGitLab.addMockHandler(
      "delete",
      `/projects/${TEST_PROJECT_ID}/snippets/${TEST_PROJECT_SNIPPET_ID}`,
      (_req, res) => {
        deleteCalled = true;
        res.status(204).send();
      }
    );

    // --- Multi-file snippet handlers ---
    mockGitLab.addMockHandler(
      "get",
      `/projects/${TEST_PROJECT_ID}/snippets/${TEST_MULTIFILE_SNIPPET_ID}`,
      (_req, res) => {
        res.json(
          buildSnippet({
            id: TEST_MULTIFILE_SNIPPET_ID,
            title: "Multi-file snippet",
            file_name: null,
            files: [
              {
                path: "policy.md",
                raw_url: `${mockGitLabUrl}/-/snippets/${TEST_MULTIFILE_SNIPPET_ID}/raw/main/policy.md`,
              },
              {
                path: "instructions.md",
                raw_url: `${mockGitLabUrl}/-/snippets/${TEST_MULTIFILE_SNIPPET_ID}/raw/main/instructions.md`,
              },
            ],
          })
        );
      }
    );

    mockGitLab.addMockHandler(
      "get",
      `/projects/${TEST_PROJECT_ID}/snippets/${TEST_MULTIFILE_SNIPPET_ID}/files/main/policy.md/raw`,
      (_req, res) => { res.type("text/plain").send(MULTIFILE_A_CONTENT); }
    );

    mockGitLab.addMockHandler(
      "get",
      `/projects/${TEST_PROJECT_ID}/snippets/${TEST_MULTIFILE_SNIPPET_ID}/files/main/instructions.md/raw`,
      (_req, res) => { res.type("text/plain").send(MULTIFILE_B_CONTENT); }
    );

    // --- Snippet with master default branch (raw_url contains "master") ---
    mockGitLab.addMockHandler(
      "get",
      `/projects/${TEST_PROJECT_ID}/snippets/${TEST_MASTER_SNIPPET_ID}`,
      (_req, res) => {
        // No default_branch field — simulates an instance where it's absent
        res.json(
          buildSnippet({
            id: TEST_MASTER_SNIPPET_ID,
            title: "Master branch snippet",
            file_name: null,
            files: [
              {
                path: "policy.md",
                raw_url: `${mockGitLabUrl}/-/snippets/${TEST_MASTER_SNIPPET_ID}/raw/master/policy.md`,
              },
              {
                path: "instructions.md",
                raw_url: `${mockGitLabUrl}/-/snippets/${TEST_MASTER_SNIPPET_ID}/raw/master/instructions.md`,
              },
            ],
          })
        );
      }
    );

    mockGitLab.addMockHandler(
      "get",
      `/projects/${TEST_PROJECT_ID}/snippets/${TEST_MASTER_SNIPPET_ID}/files/master/policy.md/raw`,
      (_req, res) => { res.type("text/plain").send(MULTIFILE_A_CONTENT); }
    );

    mockGitLab.addMockHandler(
      "get",
      `/projects/${TEST_PROJECT_ID}/snippets/${TEST_MASTER_SNIPPET_ID}/files/master/instructions.md/raw`,
      (_req, res) => { res.type("text/plain").send(MULTIFILE_B_CONTENT); }
    );

    // --- Snippet with slash-containing ref (e.g. feature/foo) ---
    mockGitLab.addMockHandler(
      "get",
      `/projects/${TEST_PROJECT_ID}/snippets/${TEST_SLASH_REF_SNIPPET_ID}`,
      (_req, res) => {
        res.json(
          buildSnippet({
            id: TEST_SLASH_REF_SNIPPET_ID,
            title: "Slash ref snippet",
            file_name: null,
            files: [
              {
                path: "policy.md",
                raw_url: `${mockGitLabUrl}/-/snippets/${TEST_SLASH_REF_SNIPPET_ID}/raw/feature/foo/policy.md`,
              },
              {
                path: "instructions.md",
                raw_url: `${mockGitLabUrl}/-/snippets/${TEST_SLASH_REF_SNIPPET_ID}/raw/feature/foo/instructions.md`,
              },
            ],
          })
        );
      }
    );

    // ref "feature/foo" must arrive as "feature%2Ffoo" in the API URL
    mockGitLab.addMockHandler(
      "get",
      `/projects/${TEST_PROJECT_ID}/snippets/${TEST_SLASH_REF_SNIPPET_ID}/files/feature%2Ffoo/policy.md/raw`,
      (_req, res) => { res.type("text/plain").send(MULTIFILE_A_CONTENT); }
    );

    mockGitLab.addMockHandler(
      "get",
      `/projects/${TEST_PROJECT_ID}/snippets/${TEST_SLASH_REF_SNIPPET_ID}/files/feature%2Ffoo/instructions.md/raw`,
      (_req, res) => { res.type("text/plain").send(MULTIFILE_B_CONTENT); }
    );

    // --- Explicit ref snippet: raw_url carries ref "wrong" but caller overrides with "v2" ---
    mockGitLab.addMockHandler(
      "get",
      `/projects/${TEST_PROJECT_ID}/snippets/${TEST_EXPLICIT_REF_SNIPPET_ID}`,
      (_req, res) => {
        res.json(
          buildSnippet({
            id: TEST_EXPLICIT_REF_SNIPPET_ID,
            title: "Explicit ref snippet",
            file_name: null,
            files: [
              {
                path: "a.md",
                raw_url: `${mockGitLabUrl}/-/snippets/${TEST_EXPLICIT_REF_SNIPPET_ID}/raw/wrong/a.md`,
              },
              {
                path: "b.md",
                raw_url: `${mockGitLabUrl}/-/snippets/${TEST_EXPLICIT_REF_SNIPPET_ID}/raw/wrong/b.md`,
              },
            ],
          })
        );
      }
    );

    mockGitLab.addMockHandler(
      "get",
      `/projects/${TEST_PROJECT_ID}/snippets/${TEST_EXPLICIT_REF_SNIPPET_ID}/files/v2/a.md/raw`,
      (_req, res) => { res.type("text/plain").send(MULTIFILE_A_CONTENT); }
    );

    mockGitLab.addMockHandler(
      "get",
      `/projects/${TEST_PROJECT_ID}/snippets/${TEST_EXPLICIT_REF_SNIPPET_ID}/files/v2/b.md/raw`,
      (_req, res) => { res.type("text/plain").send(MULTIFILE_B_CONTENT); }
    );

    // --- Nested file path snippet (file_path with a "/" inside) ---
    mockGitLab.addMockHandler(
      "get",
      `/projects/${TEST_PROJECT_ID}/snippets/${TEST_NESTED_PATH_SNIPPET_ID}`,
      (_req, res) => {
        res.json(
          buildSnippet({
            id: TEST_NESTED_PATH_SNIPPET_ID,
            title: "Nested path snippet",
            file_name: null,
            files: [
              {
                path: "dir/policy.md",
                raw_url: `${mockGitLabUrl}/-/snippets/${TEST_NESTED_PATH_SNIPPET_ID}/raw/main/dir/policy.md`,
              },
              {
                path: "other/sub/instructions.md",
                raw_url: `${mockGitLabUrl}/-/snippets/${TEST_NESTED_PATH_SNIPPET_ID}/raw/main/other/sub/instructions.md`,
              },
            ],
          })
        );
      }
    );

    // Per GitLab docs, file_path must be a single URL-encoded segment, so
    // "dir/policy.md" arrives as "dir%2Fpolicy.md" in the API URL.
    mockGitLab.addMockHandler(
      "get",
      `/projects/${TEST_PROJECT_ID}/snippets/${TEST_NESTED_PATH_SNIPPET_ID}/files/main/dir%2Fpolicy.md/raw`,
      (_req, res) => { res.type("text/plain").send(MULTIFILE_A_CONTENT); }
    );

    mockGitLab.addMockHandler(
      "get",
      `/projects/${TEST_PROJECT_ID}/snippets/${TEST_NESTED_PATH_SNIPPET_ID}/files/main/other%2Fsub%2Finstructions.md/raw`,
      (_req, res) => { res.type("text/plain").send(MULTIFILE_B_CONTENT); }
    );

    // --- Snippet response missing visibility (per GitLab project snippets API shape) ---
    mockGitLab.addMockHandler(
      "get",
      `/projects/${TEST_PROJECT_ID}/snippets/${TEST_NO_VISIBILITY_SNIPPET_ID}`,
      (_req, res) => {
        const snippet: Record<string, unknown> = buildSnippet({
          id: TEST_NO_VISIBILITY_SNIPPET_ID,
          title: "No visibility snippet",
        });
        delete snippet.visibility;
        res.json(snippet);
      }
    );

    // --- Personal snippet handlers ---
    mockGitLab.addMockHandler("get", "/snippets", (_req, res) => {
      res.json([
        buildSnippet({
          id: TEST_PERSONAL_SNIPPET_ID,
          title: "Personal snippet",
          project_id: null,
        }),
      ]);
    });

    mockGitLab.addMockHandler(
      "get",
      `/snippets/${TEST_PERSONAL_SNIPPET_ID}`,
      (_req, res) => {
        res.json(
          buildSnippet({
            id: TEST_PERSONAL_SNIPPET_ID,
            title: "Personal snippet",
            project_id: null,
          })
        );
      }
    );

    // --- URL-encoded project path handler ---
    // Express keeps "%2F" literal in req.path (it never collapses encoded slashes
    // into path separators), so the mock key is the single-encoded form.
    // Correct: caller decodes "my-group%2Fmy-project" → "my-group/my-project" →
    //          re-encodes → "my-group%2Fmy-project" → req.path is "/projects/my-group%2Fmy-project/snippets".
    // Double-encoded bug: caller encodes "my-group%2Fmy-project" → "my-group%252Fmy-project"
    //          → req.path is "/projects/my-group%252Fmy-project/snippets" (no handler match).
    mockGitLab.addMockHandler(
      "get",
      "/projects/my-group%2Fmy-project/snippets",
      (_req, res) => {
        res.json([buildSnippet({ id: 555, title: "Encoded path snippet" })]);
      }
    );

    mockGitLab.addMockHandler("post", "/snippets", (req, res) => {
      res.status(201).json(
        buildSnippet({
          id: 200,
          title: req.body.title,
          description: req.body.description ?? null,
          visibility: req.body.visibility,
          file_name: req.body.files?.[0]?.file_path,
          project_id: null,
        })
      );
    });

    await mockGitLab.start();
    mockGitLabUrl = mockGitLab.getUrl();
  });

  after(async () => {
    await mockGitLab.stop();
  });

  const env = () => ({
    GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
    GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
    GITLAB_TOOLSETS: "snippets",
  });

  test("list_snippets returns project snippets", async () => {
    const result = await callTool(
      "list_snippets",
      { project_id: TEST_PROJECT_ID, per_page: 5 },
      env()
    );

    assert.ok(Array.isArray(result));
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].id, TEST_PROJECT_SNIPPET_ID);
    assert.strictEqual(result[0].title, "Example snippet");
  });

  test("list_snippets returns personal snippets when project_id omitted", async () => {
    const result = await callTool("list_snippets", {}, env());

    assert.ok(Array.isArray(result));
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].id, TEST_PERSONAL_SNIPPET_ID);
    assert.strictEqual(result[0].project_id, null);
  });

  test("get_snippet returns metadata without content by default", async () => {
    const result = await callTool(
      "get_snippet",
      { project_id: TEST_PROJECT_ID, snippet_id: TEST_PROJECT_SNIPPET_ID },
      env()
    );

    assert.strictEqual(result.id, TEST_PROJECT_SNIPPET_ID);
    assert.strictEqual(result.title, "Example snippet");
    assert.strictEqual(result.content, undefined);
  });

  test("get_snippet with include_content fetches raw content", async () => {
    const result = await callTool(
      "get_snippet",
      {
        project_id: TEST_PROJECT_ID,
        snippet_id: TEST_PROJECT_SNIPPET_ID,
        include_content: true,
      },
      env()
    );

    assert.strictEqual(result.id, TEST_PROJECT_SNIPPET_ID);
    assert.strictEqual(result.content, RAW_CONTENT);
  });

  test("get_snippet with include_content fetches per-file raw for multi-file snippet", async () => {
    const result = await callTool(
      "get_snippet",
      {
        project_id: TEST_PROJECT_ID,
        snippet_id: TEST_MULTIFILE_SNIPPET_ID,
        include_content: true,
      },
      env()
    );

    assert.strictEqual(result.id, TEST_MULTIFILE_SNIPPET_ID);
    assert.strictEqual(result.content, undefined);
    assert.ok(Array.isArray(result.files));
    assert.strictEqual(result.files.length, 2);
    assert.strictEqual(result.files[0].path, "policy.md");
    assert.strictEqual(result.files[0].content, MULTIFILE_A_CONTENT);
    assert.strictEqual(result.files[1].path, "instructions.md");
    assert.strictEqual(result.files[1].content, MULTIFILE_B_CONTENT);
  });

  test("create_snippet posts files array with file_path and content", async () => {
    const result = await callTool(
      "create_snippet",
      {
        project_id: TEST_PROJECT_ID,
        title: "New snippet",
        file_name: "demo.txt",
        content: "hello",
        description: "test desc",
        visibility: "internal",
      },
      env()
    );

    assert.strictEqual(result.id, 100);
    assert.strictEqual(result.title, "New snippet");
    assert.strictEqual(result.visibility, "internal");
    assert.deepStrictEqual(lastCreateBody, {
      title: "New snippet",
      visibility: "internal",
      files: [{ file_path: "demo.txt", content: "hello" }],
      description: "test desc",
    });
  });

  test("create_snippet defaults to private visibility", async () => {
    await callTool(
      "create_snippet",
      {
        project_id: TEST_PROJECT_ID,
        title: "Defaults",
        file_name: "a.txt",
        content: "x",
      },
      env()
    );

    assert.strictEqual(lastCreateBody.visibility, "private");
    assert.strictEqual(lastCreateBody.description, undefined);
  });

  test("update_snippet sends only provided fields", async () => {
    const result = await callTool(
      "update_snippet",
      {
        project_id: TEST_PROJECT_ID,
        snippet_id: TEST_PROJECT_SNIPPET_ID,
        title: "Renamed",
        visibility: "public",
      },
      env()
    );

    assert.strictEqual(result.title, "Renamed");
    assert.deepStrictEqual(lastUpdateBody, {
      title: "Renamed",
      visibility: "public",
    });
  });

  test("update_snippet with file_name and content uses files action: update", async () => {
    await callTool(
      "update_snippet",
      {
        project_id: TEST_PROJECT_ID,
        snippet_id: TEST_PROJECT_SNIPPET_ID,
        file_name: "renamed.txt",
        content: "new content",
      },
      env()
    );

    assert.deepStrictEqual(lastUpdateBody, {
      files: [{ action: "update", file_path: "renamed.txt", content: "new content" }],
    });
  });

  test("update_snippet supports files[] move action with previous_path", async () => {
    await callTool(
      "update_snippet",
      {
        project_id: TEST_PROJECT_ID,
        snippet_id: TEST_PROJECT_SNIPPET_ID,
        files: [
          { action: "move", previous_path: "old.md", file_path: "new.md" },
        ],
      },
      env()
    );

    assert.deepStrictEqual(lastUpdateBody, {
      files: [{ action: "move", previous_path: "old.md", file_path: "new.md" }],
    });
  });

  test("update_snippet supports files[] delete and create actions", async () => {
    await callTool(
      "update_snippet",
      {
        project_id: TEST_PROJECT_ID,
        snippet_id: TEST_PROJECT_SNIPPET_ID,
        files: [
          { action: "delete", file_path: "gone.md" },
          { action: "create", file_path: "added.md", content: "new body" },
        ],
      },
      env()
    );

    assert.deepStrictEqual(lastUpdateBody, {
      files: [
        { action: "delete", file_path: "gone.md" },
        { action: "create", file_path: "added.md", content: "new body" },
      ],
    });
  });

  test("update_snippet rejects mixing files[] with file_name/content", async () => {
    await assert.rejects(
      () =>
        callTool(
          "update_snippet",
          {
            project_id: TEST_PROJECT_ID,
            snippet_id: TEST_PROJECT_SNIPPET_ID,
            file_name: "a.txt",
            content: "x",
            files: [{ action: "update", file_path: "a.txt", content: "y" }],
          },
          env()
        ),
      (err: any) => /Cannot mix files\[\] with file_name\/content/.test(JSON.stringify(err))
    );
  });

  test("delete_snippet calls DELETE and returns success", async () => {
    deleteCalled = false;
    const result = await callTool(
      "delete_snippet",
      { project_id: TEST_PROJECT_ID, snippet_id: TEST_PROJECT_SNIPPET_ID },
      env()
    );

    assert.strictEqual(deleteCalled, true);
    assert.deepStrictEqual(result, {
      status: "success",
      message: `Snippet ${TEST_PROJECT_SNIPPET_ID} deleted successfully`,
    });
  });

  test("get_snippet fetches multi-file content from raw_url regardless of branch name", async () => {
    const result = await callTool(
      "get_snippet",
      {
        project_id: TEST_PROJECT_ID,
        snippet_id: TEST_MASTER_SNIPPET_ID,
        include_content: true,
      },
      env()
    );

    assert.strictEqual(result.id, TEST_MASTER_SNIPPET_ID);
    assert.ok(Array.isArray(result.files));
    assert.strictEqual(result.files.length, 2);
    assert.strictEqual(result.files[0].path, "policy.md");
    assert.strictEqual(result.files[0].content, MULTIFILE_A_CONTENT);
    assert.strictEqual(result.files[1].path, "instructions.md");
    assert.strictEqual(result.files[1].content, MULTIFILE_B_CONTENT);
  });

  test("get_snippet with include_content encodes slashes in ref as %2F", async () => {
    const result = await callTool(
      "get_snippet",
      {
        project_id: TEST_PROJECT_ID,
        snippet_id: TEST_SLASH_REF_SNIPPET_ID,
        include_content: true,
      },
      env()
    );

    assert.strictEqual(result.id, TEST_SLASH_REF_SNIPPET_ID);
    assert.ok(Array.isArray(result.files));
    assert.strictEqual(result.files.length, 2);
    assert.strictEqual(result.files[0].path, "policy.md");
    assert.strictEqual(result.files[0].content, MULTIFILE_A_CONTENT);
    assert.strictEqual(result.files[1].path, "instructions.md");
    assert.strictEqual(result.files[1].content, MULTIFILE_B_CONTENT);
  });

  test("get_snippet with include_content uses explicit ref when provided, ignoring raw_url ref", async () => {
    const result = await callTool(
      "get_snippet",
      {
        project_id: TEST_PROJECT_ID,
        snippet_id: TEST_EXPLICIT_REF_SNIPPET_ID,
        include_content: true,
        ref: "v2",
      },
      env()
    );

    assert.strictEqual(result.id, TEST_EXPLICIT_REF_SNIPPET_ID);
    assert.ok(Array.isArray(result.files));
    assert.strictEqual(result.files.length, 2);
    assert.strictEqual(result.files[0].content, MULTIFILE_A_CONTENT);
    assert.strictEqual(result.files[1].content, MULTIFILE_B_CONTENT);
  });

  test("get_snippet with include_content encodes nested file paths as a single segment", async () => {
    const result = await callTool(
      "get_snippet",
      {
        project_id: TEST_PROJECT_ID,
        snippet_id: TEST_NESTED_PATH_SNIPPET_ID,
        include_content: true,
      },
      env()
    );

    assert.strictEqual(result.id, TEST_NESTED_PATH_SNIPPET_ID);
    assert.ok(Array.isArray(result.files));
    assert.strictEqual(result.files.length, 2);
    assert.strictEqual(result.files[0].path, "dir/policy.md");
    assert.strictEqual(result.files[0].content, MULTIFILE_A_CONTENT);
    assert.strictEqual(result.files[1].path, "other/sub/instructions.md");
    assert.strictEqual(result.files[1].content, MULTIFILE_B_CONTENT);
  });

  test("create_snippet supports multi-file snippets via files[]", async () => {
    const result = await callTool(
      "create_snippet",
      {
        project_id: TEST_PROJECT_ID,
        title: "Multi-file",
        files: [
          { file_path: "policy.md", content: "policy body" },
          { file_path: "instructions.md", content: "instructions body" },
        ],
        visibility: "internal",
      },
      env()
    );

    assert.strictEqual(result.id, 100);
    assert.deepStrictEqual(lastCreateBody, {
      title: "Multi-file",
      visibility: "internal",
      files: [
        { file_path: "policy.md", content: "policy body" },
        { file_path: "instructions.md", content: "instructions body" },
      ],
    });
  });

  test("create_snippet rejects mixing files[] with file_name/content", async () => {
    await assert.rejects(
      () =>
        callTool(
          "create_snippet",
          {
            project_id: TEST_PROJECT_ID,
            title: "Bad mix",
            file_name: "a.txt",
            content: "x",
            files: [{ file_path: "b.txt", content: "y" }],
          },
          env()
        ),
      (err: any) => /Cannot mix files\[\] with file_name\/content/.test(JSON.stringify(err))
    );
  });

  test("create_snippet rejects when neither files[] nor file_name+content provided", async () => {
    await assert.rejects(
      () =>
        callTool(
          "create_snippet",
          {
            project_id: TEST_PROJECT_ID,
            title: "Empty",
          },
          env()
        ),
      (err: any) =>
        /Provide either files\[\] .* or both file_name and content/.test(JSON.stringify(err))
    );
  });

  test("update_snippet rejects file_name without content at parse time", async () => {
    await assert.rejects(
      () =>
        callTool(
          "update_snippet",
          {
            project_id: TEST_PROJECT_ID,
            snippet_id: TEST_PROJECT_SNIPPET_ID,
            file_name: "new-name.txt",
          },
          env()
        ),
      (err: any) => /file_name requires content/.test(JSON.stringify(err))
    );
  });

  test("update_snippet rejects content without file_name at parse time", async () => {
    await assert.rejects(
      () =>
        callTool(
          "update_snippet",
          {
            project_id: TEST_PROJECT_ID,
            snippet_id: TEST_PROJECT_SNIPPET_ID,
            content: "orphan content",
          },
          env()
        ),
      (err: any) => /content requires file_name/.test(JSON.stringify(err))
    );
  });

  test("create_snippet without project_id hits personal endpoint", async () => {
    const result = await callTool(
      "create_snippet",
      {
        title: "Personal new",
        file_name: "note.md",
        content: "body",
        visibility: "public",
      },
      env()
    );

    assert.strictEqual(result.id, 200);
    assert.strictEqual(result.title, "Personal new");
    assert.strictEqual(result.visibility, "public");
    assert.strictEqual(result.project_id, null);
  });

  test("list_snippets does not double-encode URL-encoded project paths", async () => {
    const result = await callTool(
      "list_snippets",
      { project_id: "my-group%2Fmy-project" },
      env()
    );

    assert.ok(Array.isArray(result));
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].id, 555);
    assert.strictEqual(result[0].title, "Encoded path snippet");
  });

  test("get_snippet accepts responses with no visibility field", async () => {
    const result = await callTool(
      "get_snippet",
      { project_id: TEST_PROJECT_ID, snippet_id: TEST_NO_VISIBILITY_SNIPPET_ID },
      env()
    );

    assert.strictEqual(result.id, TEST_NO_VISIBILITY_SNIPPET_ID);
    assert.strictEqual(result.title, "No visibility snippet");
    assert.strictEqual(result.visibility, undefined);
  });

  test("get_snippet without project_id hits personal endpoint", async () => {
    const result = await callTool(
      "get_snippet",
      { snippet_id: TEST_PERSONAL_SNIPPET_ID },
      env()
    );

    assert.strictEqual(result.id, TEST_PERSONAL_SNIPPET_ID);
    assert.strictEqual(result.title, "Personal snippet");
    assert.strictEqual(result.project_id, null);
  });
});
