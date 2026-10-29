import { after, before, beforeEach, describe, it, test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { MockGitLabServer, findMockServerPort } from "./utils/mock-gitlab-server.js";

const MOCK_TOKEN = "glpat-group-iteration-test";
const GROUP_ID = "5";
const ITERATION_ID = "53";

type Iteration = {
  id: number;
  iid: number;
  sequence: number;
  group_id: number;
  title: string;
  description: string | null;
  state: number;
  created_at: string;
  updated_at: string;
  start_date: string;
  due_date: string;
  web_url: string;
};

const baseIteration = (): Iteration => ({
  id: 53,
  iid: 13,
  sequence: 1,
  group_id: 5,
  title: "Sprint 1",
  description: "Initial goal",
  state: 2,
  created_at: "2026-08-01T00:00:00Z",
  updated_at: "2026-08-01T00:00:00Z",
  start_date: "2026-09-01",
  due_date: "2026-09-07",
  web_url: "https://gitlab.example.com/groups/test-group/-/iterations/13",
});

async function callTool(
  name: string,
  args: Record<string, unknown>,
  env: NodeJS.ProcessEnv
): Promise<any> {
  return new Promise((resolve, reject) => {
    const proc = spawn("node", ["build/index.js"], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, ...env },
    });
    let output = "";
    let errorOutput = "";
    proc.stdout?.on("data", data => (output += data));
    proc.stderr?.on("data", data => (errorOutput += data));

    proc.on("close", code => {
      if (code !== 0) {
        reject(new Error(`Process exited with code ${code}: ${errorOutput}`));
        return;
      }
      const line = output.split("\n").find(value => value.startsWith("{"));
      if (!line) {
        reject(new Error("No JSON output found"));
        return;
      }
      const response = JSON.parse(line);
      if (response.error) {
        reject(new Error(response.error?.message ?? String(response.error)));
        return;
      }
      const content = response.result?.content?.[0]?.text;
      if (response.result?.isError) {
        reject(new Error(content ?? "Tool call failed"));
        return;
      }
      resolve(content ? JSON.parse(content) : response.result);
    });

    proc.stdin?.end(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name, arguments: args },
      }) + "\n"
    );
  });
}

describe("group iteration tools", () => {
  let mockServer: MockGitLabServer;
  let iteration: Iteration;
  let mutationErrors: string[];
  let mutationInput: Record<string, unknown> | undefined;

  before(async () => {
    const port = await findMockServerPort();
    mockServer = new MockGitLabServer({ port, validTokens: [MOCK_TOKEN] });

    mockServer.addMockHandler("get", `/groups/${GROUP_ID}/iterations`, (_req, res) => {
      res.json([iteration]);
    });
    mockServer.addMockHandler("get", `/groups/${GROUP_ID}`, (_req, res) => {
      res.json({ id: 5, full_path: "test-group" });
    });
    mockServer.addRootHandler("post", "/api/graphql", (req, res) => {
      mutationInput = req.body.variables.input as Record<string, unknown>;
      if (mutationErrors.length === 0) {
        iteration = {
          ...iteration,
          ...(mutationInput.title !== undefined ? { title: mutationInput.title as string } : {}),
          ...(mutationInput.description !== undefined
            ? { description: mutationInput.description as string | null }
            : {}),
          ...(mutationInput.startDate !== undefined
            ? { start_date: mutationInput.startDate as string }
            : {}),
          ...(mutationInput.dueDate !== undefined
            ? { due_date: mutationInput.dueDate as string }
            : {}),
          updated_at: "2026-09-01T12:00:00Z",
        };
      }
      res.json({
        data: {
          updateIteration: {
            iteration:
              mutationErrors.length === 0 ? { id: `gid://gitlab/Iteration/${ITERATION_ID}` } : null,
            errors: mutationErrors,
          },
        },
      });
    });
    await mockServer.start();
  });

  beforeEach(() => {
    iteration = baseIteration();
    mutationErrors = [];
    mutationInput = undefined;
  });

  after(async () => {
    await mockServer.stop();
  });

  const env = () => ({
    GITLAB_API_URL: `${mockServer.getUrl()}/api/v4`,
    GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
    GITLAB_TOOLSETS: "projects",
  });

  test("gets an iteration by ID, IID, or GraphQL GID", async () => {
    const byId = await callTool(
      "get_group_iteration",
      {
        group_id: GROUP_ID,
        iteration_id: ITERATION_ID,
      },
      env()
    );
    const byIid = await callTool(
      "get_group_iteration",
      {
        group_id: GROUP_ID,
        iteration_id: "13",
      },
      env()
    );
    const byGid = await callTool(
      "get_group_iteration",
      {
        group_id: GROUP_ID,
        iteration_id: `gid://gitlab/Iteration/${ITERATION_ID}`,
      },
      env()
    );

    assert.equal(byId.id, ITERATION_ID);
    assert.equal(byIid.id, ITERATION_ID);
    assert.equal(byGid.iid, "13");
  });

  test("updates an iteration through GraphQL and reads it back", async () => {
    const result = await callTool(
      "update_group_iteration",
      {
        group_id: GROUP_ID,
        iteration_id: "13",
        title: "Sprint Goal",
        description: "Goal and checkpoint",
        start_date: "2026-09-08",
        due_date: "2026-09-14",
      },
      env()
    );

    assert.deepEqual(mutationInput, {
      groupPath: "test-group",
      id: `gid://gitlab/Iteration/${ITERATION_ID}`,
      title: "Sprint Goal",
      description: "Goal and checkpoint",
      startDate: "2026-09-08",
      dueDate: "2026-09-14",
    });
    assert.equal(result.title, "Sprint Goal");
    assert.equal(result.description, "Goal and checkpoint");
    assert.equal(result.start_date, "2026-09-08");
    assert.equal(result.due_date, "2026-09-14");
  });

  test("rejects an empty update before calling GitLab", async () => {
    await assert.rejects(
      () =>
        callTool(
          "update_group_iteration",
          { group_id: GROUP_ID, iteration_id: ITERATION_ID },
          env()
        ),
      /Provide at least one iteration field/
    );
    assert.equal(mutationInput, undefined);
  });

  test("surfaces GitLab mutation errors", async () => {
    mutationErrors = ["Manual iteration updates are not allowed"];

    await assert.rejects(
      () =>
        callTool(
          "update_group_iteration",
          {
            group_id: GROUP_ID,
            iteration_id: ITERATION_ID,
            description: "New goal",
          },
          env()
        ),
      /Manual iteration updates are not allowed/
    );
  });

  test("rejects the group iteration tools while a project allowlist is in effect", async () => {
    const strictEnv = {
      ...env(),
      ENABLE_STRICT_PROJECT_SCOPE: "true",
      GITLAB_ALLOWED_PROJECT_IDS: "1",
    };
    const calls: [string, Record<string, unknown>][] = [
      ["list_group_iterations", { group_id: GROUP_ID }],
      ["get_group_iteration", { group_id: GROUP_ID, iteration_id: ITERATION_ID }],
      ["update_group_iteration", { group_id: GROUP_ID, iteration_id: ITERATION_ID, title: "X" }],
    ];

    for (const [name, args] of calls) {
      await assert.rejects(
        () => callTool(name, args, strictEnv),
        new RegExp(`${name} is not allowed while a project allowlist is in effect`)
      );
    }
    assert.equal(mutationInput, undefined);
  });
});

const LOOKUP_PAGE_SIZE = 100;

function createLookupIteration(overrides: Partial<Iteration>): Iteration {
  return {
    ...baseIteration(),
    ...overrides,
  };
}

function fillIterationPage(match: Iteration): Iteration[] {
  const fillers = Array.from({ length: LOOKUP_PAGE_SIZE - 1 }, (_, index) =>
    createLookupIteration({
      id: 200 + index,
      iid: 2000 + index,
      title: `Filler ${index}`,
    })
  );
  return [...fillers, match];
}

async function withIterationLookupServer(
  pages: Iteration[][],
  run: (env: NodeJS.ProcessEnv) => Promise<void>
): Promise<void> {
  const port = await findMockServerPort();
  const mockServer = new MockGitLabServer({ port, validTokens: [MOCK_TOKEN] });
  mockServer.addMockHandler("get", `/groups/${GROUP_ID}/iterations`, (req, res) => {
    assert.equal(req.query.include_ancestors, "false");
    const page = Number(req.query.page ?? 1);
    res.json(pages[page - 1] ?? []);
  });
  await mockServer.start();
  try {
    await run({
      GITLAB_API_URL: `${mockServer.getUrl()}/api/v4`,
      GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
      GITLAB_TOOLSETS: "projects",
    });
  } finally {
    await mockServer.stop();
  }
}

async function getGroupIterationById(
  env: NodeJS.ProcessEnv,
  iterationId: string
): Promise<{ id: string; iid: string; title: string }> {
  return callTool("get_group_iteration", { group_id: GROUP_ID, iteration_id: iterationId }, env);
}

describe("When looking up a group iteration", () => {
  describe("with a number that matches one iteration id and another iteration iid", () => {
    it("should reject the lookup as ambiguous", async () => {
      const byIid = createLookupIteration({ id: 53, iid: 13, title: "IID match" });
      const byId = createLookupIteration({ id: 13, iid: 1, title: "ID match" });

      await withIterationLookupServer([fillIterationPage(byIid), [byId]], async env => {
        await assert.rejects(
          () => getGroupIterationById(env, "13"),
          /Group iteration 13 is ambiguous in group 5/
        );
      });
    });
  });

  describe("with a GraphQL GID", () => {
    it("should match the primary id only", async () => {
      const byIid = createLookupIteration({ id: 53, iid: 13, title: "IID match" });
      const byId = createLookupIteration({ id: 13, iid: 1, title: "ID match" });

      await withIterationLookupServer([[byIid, byId]], async env => {
        const result = await getGroupIterationById(env, "gid://gitlab/Iteration/13");
        assert.equal(result.id, "13");
        assert.equal(result.title, "ID match");
      });
    });
  });

  describe("with a number that matches only an iid", () => {
    it("should return that iteration", async () => {
      const byIid = createLookupIteration({ id: 53, iid: 13, title: "IID fallback" });

      await withIterationLookupServer([[byIid]], async env => {
        const result = await getGroupIterationById(env, "13");
        assert.equal(result.id, "53");
        assert.equal(result.iid, "13");
      });
    });
  });

  describe("with an identifier that matches no iteration", () => {
    it("should reject the lookup as not found", async () => {
      const existing = createLookupIteration({ id: 53, iid: 13, title: "Existing" });

      await withIterationLookupServer([[existing]], async env => {
        await assert.rejects(
          () => getGroupIterationById(env, "99"),
          /Group iteration 99 was not found in group 5/
        );
      });
    });
  });

  describe("with a GraphQL GID that matches no id", () => {
    it("should reject the lookup as not found", async () => {
      const byIid = createLookupIteration({ id: 53, iid: 99, title: "IID only" });

      await withIterationLookupServer([[byIid]], async env => {
        await assert.rejects(
          () => getGroupIterationById(env, "gid://gitlab/Iteration/99"),
          /Group iteration gid:\/\/gitlab\/Iteration\/99 was not found in group 5/
        );
      });
    });
  });

  describe("with the id match on a later page than any iid-only row", () => {
    it("should prefer the id match after scanning every page", async () => {
      const earlier = createLookupIteration({ id: 99, iid: 1, title: "Earlier page" });
      const laterById = createLookupIteration({ id: 13, iid: 2, title: "Later ID match" });

      await withIterationLookupServer([fillIterationPage(earlier), [laterById]], async env => {
        const result = await getGroupIterationById(env, "13");
        assert.equal(result.id, "13");
        assert.equal(result.title, "Later ID match");
      });
    });
  });

  describe("when GitLab would include ancestor iterations by default", () => {
    it("should select the group's own iteration instead of an ancestor with the same iid", async () => {
      const port = await findMockServerPort();
      const mockServer = new MockGitLabServer({ port, validTokens: [MOCK_TOKEN] });
      mockServer.addMockHandler("get", `/groups/${GROUP_ID}/iterations`, (req, res) => {
        const own = createLookupIteration({ id: 53, iid: 13, title: "Own group" });
        const ancestor = createLookupIteration({
          id: 999,
          iid: 13,
          group_id: 1,
          title: "Ancestor",
        });
        res.json(req.query.include_ancestors === "false" ? [own] : [own, ancestor]);
      });
      await mockServer.start();
      try {
        const result = await getGroupIterationById(
          {
            GITLAB_API_URL: `${mockServer.getUrl()}/api/v4`,
            GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
            GITLAB_TOOLSETS: "projects",
          },
          "13"
        );
        assert.equal(result.id, "53");
      } finally {
        await mockServer.stop();
      }
    });
  });
});
