import { after, before, beforeEach, describe, test } from "node:test";
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


const CREATED_ITERATION_ID = "54";
const PROJECT_ID = "9";

type CadenceNode = {
  id: string;
  title: string;
  description: string | null;
  automatic: boolean | null;
  active: boolean | null;
  startDate: string | null;
  durationInWeeks: number | null;
  iterationsInAdvance: number | null;
  rollOver: boolean;
};

const cadenceNode = (overrides: Partial<CadenceNode> = {}): CadenceNode => ({
  id: "gid://gitlab/Iterations::Cadence/7",
  title: "Sprints",
  description: "Two-week sprints",
  automatic: false,
  active: true,
  startDate: "2026-09-01",
  durationInWeeks: 2,
  iterationsInAdvance: null,
  rollOver: false,
  ...overrides,
});

describe("group iteration tools", () => {
  let mockServer: MockGitLabServer;
  let iteration: Iteration;
  let createdIterations: Iteration[];
  let mutationErrors: string[];
  let mutationInput: Record<string, unknown> | undefined;
  let mutationVariables: Record<string, unknown> | undefined;
  let cadencePages: CadenceNode[][];
  let cadenceListVariables: Record<string, unknown>[];
  let cadenceGroupFound: boolean;
  let graphqlRequests: number;
  let projectIterationQuery: Record<string, unknown> | undefined;

  before(async () => {
    const port = await findMockServerPort();
    mockServer = new MockGitLabServer({ port, validTokens: [MOCK_TOKEN] });

    mockServer.addMockHandler("get", `/groups/${GROUP_ID}/iterations`, (_req, res) => {
      res.json([iteration, ...createdIterations]);
    });
    mockServer.addMockHandler("get", `/projects/${PROJECT_ID}/iterations`, (req, res) => {
      projectIterationQuery = { ...req.query };
      res.json([iteration]);
    });
    mockServer.addMockHandler("get", `/groups/${GROUP_ID}`, (_req, res) => {
      res.json({ id: 5, full_path: "test-group" });
    });
    mockServer.addRootHandler("post", "/api/graphql", (req, res) => {
      const query = String(req.body.query ?? "");
      const variables = (req.body.variables ?? {}) as Record<string, unknown>;
      graphqlRequests += 1;

      if (query.includes("query GroupIterationCadences(")) {
        cadenceListVariables.push(variables);
        if (!cadenceGroupFound) {
          res.json({ data: { group: null } });
          return;
        }
        const pageIndex = variables.after === undefined ? 0 : Number(variables.after);
        const hasNextPage = pageIndex + 1 < cadencePages.length;
        res.json({
          data: {
            group: {
              iterationCadences: {
                nodes: cadencePages[pageIndex] ?? [],
                pageInfo: { hasNextPage, endCursor: hasNextPage ? String(pageIndex + 1) : null },
              },
            },
          },
        });
        return;
      }

      mutationVariables = variables;
      mutationInput = variables.input as Record<string, unknown> | undefined;
      const ok = mutationErrors.length === 0;

      if (query.includes("mutation CreateGroupIteration(")) {
        if (ok && mutationInput) {
          createdIterations.push({
            ...baseIteration(),
            id: Number(CREATED_ITERATION_ID),
            iid: 14,
            sequence: 2,
            title: (mutationInput.title as string | undefined) ?? "",
            description: (mutationInput.description as string | undefined) ?? null,
            start_date: mutationInput.startDate as string,
            due_date: mutationInput.dueDate as string,
            web_url: "https://gitlab.example.com/groups/test-group/-/iterations/14",
          });
        }
        res.json({
          data: {
            iterationCreate: {
              iteration: ok ? { id: `gid://gitlab/Iteration/${CREATED_ITERATION_ID}` } : null,
              errors: mutationErrors,
            },
          },
        });
        return;
      }

      if (query.includes("mutation UpdateGroupIteration(")) {
        if (ok && mutationInput) {
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
              iteration: ok ? { id: `gid://gitlab/Iteration/${ITERATION_ID}` } : null,
              errors: mutationErrors,
            },
          },
        });
        return;
      }

      if (query.includes("mutation DeleteGroupIteration(")) {
        res.json({ data: { iterationDelete: { errors: mutationErrors } } });
        return;
      }

      if (
        query.includes("mutation CreateGroupIterationCadence(") ||
        query.includes("mutation UpdateGroupIterationCadence(")
      ) {
        const field = query.includes("mutation CreateGroupIterationCadence(")
          ? "iterationCadenceCreate"
          : "iterationCadenceUpdate";
        const input = mutationInput ?? {};
        res.json({
          data: {
            [field]: {
              iterationCadence: ok
                ? cadenceNode({
                    ...(input.id !== undefined ? { id: input.id as string } : {}),
                    ...(input.title !== undefined ? { title: input.title as string } : {}),
                    ...(input.automatic !== undefined
                      ? { automatic: input.automatic as boolean }
                      : {}),
                    ...(input.active !== undefined ? { active: input.active as boolean } : {}),
                    ...(input.durationInWeeks !== undefined
                      ? { durationInWeeks: input.durationInWeeks as number }
                      : {}),
                  })
                : null,
              errors: mutationErrors,
            },
          },
        });
        return;
      }

      if (query.includes("mutation DeleteGroupIterationCadence(")) {
        res.json({ data: { iterationCadenceDestroy: { errors: mutationErrors } } });
        return;
      }

      res.status(400).json({ errors: [{ message: `Unexpected GraphQL operation: ${query}` }] });
    });
    await mockServer.start();
  });

  beforeEach(() => {
    iteration = baseIteration();
    createdIterations = [];
    mutationErrors = [];
    mutationInput = undefined;
    mutationVariables = undefined;
    cadencePages = [];
    cadenceListVariables = [];
    cadenceGroupFound = true;
    graphqlRequests = 0;
    projectIterationQuery = undefined;
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
      { group_id: GROUP_ID, iteration_id: ITERATION_ID },
      env()
    );
    const byIid = await callTool(
      "get_group_iteration",
      { group_id: GROUP_ID, iteration_id: "13" },
      env()
    );
    const byGid = await callTool(
      "get_group_iteration",
      { group_id: GROUP_ID, iteration_id: `gid://gitlab/Iteration/${ITERATION_ID}` },
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
          { group_id: GROUP_ID, iteration_id: ITERATION_ID, description: "New goal" },
          env()
        ),
      /Manual iteration updates are not allowed/
    );
  });

  test("creates an iteration in a given cadence and reads it back", async () => {
    const result = await callTool(
      "create_group_iteration",
      {
        group_id: GROUP_ID,
        title: "Sprint 2",
        description: "Second goal",
        start_date: "2026-09-08",
        due_date: "2026-09-21",
        iterations_cadence_id: "7",
      },
      env()
    );

    assert.deepEqual(mutationInput, {
      groupPath: "test-group",
      title: "Sprint 2",
      description: "Second goal",
      startDate: "2026-09-08",
      dueDate: "2026-09-21",
      iterationsCadenceId: "gid://gitlab/Iterations::Cadence/7",
    });
    assert.equal(result.id, CREATED_ITERATION_ID);
    assert.equal(result.iid, "14");
    assert.equal(result.title, "Sprint 2");
    assert.equal(result.start_date, "2026-09-08");
    assert.equal(result.due_date, "2026-09-21");
  });

  test("passes only the given fields to iterationCreate", async () => {
    await callTool(
      "create_group_iteration",
      { group_id: GROUP_ID, start_date: "2026-09-08", due_date: "2026-09-21" },
      env()
    );

    assert.deepEqual(mutationInput, {
      groupPath: "test-group",
      startDate: "2026-09-08",
      dueDate: "2026-09-21",
    });
    assert.equal(cadenceListVariables.length, 0);
    assert.equal(graphqlRequests, 1);
  });

  test("surfaces GitLab create errors", async () => {
    mutationErrors = ["Dates cannot overlap with other existing Iterations"];

    await assert.rejects(
      () =>
        callTool(
          "create_group_iteration",
          { group_id: GROUP_ID, start_date: "2026-09-01", due_date: "2026-09-07" },
          env()
        ),
      /Dates cannot overlap with other existing Iterations/
    );
  });

  test("deletes an iteration found by IID through iterationDelete", async () => {
    const result = await callTool(
      "delete_group_iteration",
      { group_id: GROUP_ID, iteration_id: "13" },
      env()
    );

    assert.deepEqual(mutationVariables, { id: `gid://gitlab/Iteration/${ITERATION_ID}` });
    assert.equal(result.status, "success");
  });

  test("surfaces GitLab delete errors", async () => {
    mutationErrors = ["Iteration cannot be deleted"];

    await assert.rejects(
      () =>
        callTool(
          "delete_group_iteration",
          { group_id: GROUP_ID, iteration_id: ITERATION_ID },
          env()
        ),
      /Iteration cannot be deleted/
    );
  });

  test("lists a project's iterations with the REST filters", async () => {
    const result = await callTool(
      "list_project_iterations",
      {
        project_id: PROJECT_ID,
        state: "current",
        search: "Sprint",
        search_in: ["title", "cadence_title"],
        include_ancestors: false,
      },
      env()
    );

    assert.deepEqual(projectIterationQuery, {
      state: "current",
      search: "Sprint",
      in: "title,cadence_title",
      include_ancestors: "false",
    });
    assert.equal(result.length, 1);
    assert.equal(result[0].id, ITERATION_ID);
  });

  test("lists cadences across pages with filters and maps their fields", async () => {
    cadencePages = [
      [cadenceNode()],
      [
        cadenceNode({
          id: "gid://gitlab/Iterations::Cadence/8",
          title: "Releases",
          description: null,
          automatic: null,
          active: false,
          startDate: null,
          durationInWeeks: null,
        }),
      ],
    ];

    const result = await callTool(
      "list_group_iteration_cadences",
      { group_id: 5, automatic: false, duration_in_weeks: "2", include_ancestor_groups: "true" },
      env()
    );

    const expectedVariables = {
      fullPath: "test-group",
      automatic: false,
      durationInWeeks: 2,
      includeAncestorGroups: true,
    };
    assert.deepEqual(cadenceListVariables, [
      expectedVariables,
      { ...expectedVariables, after: "1" },
    ]);
    assert.deepEqual(result, [
      {
        id: "gid://gitlab/Iterations::Cadence/7",
        title: "Sprints",
        description: "Two-week sprints",
        automatic: false,
        active: true,
        start_date: "2026-09-01",
        duration_in_weeks: 2,
        iterations_in_advance: null,
        roll_over: false,
      },
      {
        id: "gid://gitlab/Iterations::Cadence/8",
        title: "Releases",
        description: null,
        automatic: null,
        active: false,
        start_date: null,
        duration_in_weeks: null,
        iterations_in_advance: null,
        roll_over: false,
      },
    ]);
  });

  test("looks up one cadence by numeric ID as a cadence GID", async () => {
    cadencePages = [[cadenceNode()]];

    await callTool("list_group_iteration_cadences", { group_id: GROUP_ID, id: 7 }, env());

    assert.deepEqual(cadenceListVariables, [
      { fullPath: "test-group", id: "gid://gitlab/Iterations::Cadence/7" },
    ]);
  });

  test("reports a group GraphQL cannot see when listing cadences", async () => {
    cadenceGroupFound = false;

    await assert.rejects(
      () => callTool("list_group_iteration_cadences", { group_id: GROUP_ID }, env()),
      /Group test-group was not found/
    );
  });

  test("creates a cadence through iterationCadenceCreate", async () => {
    const result = await callTool(
      "create_group_iteration_cadence",
      {
        group_id: GROUP_ID,
        title: "Sprints",
        automatic: false,
        active: "true",
        duration_in_weeks: 2,
        roll_over: false,
      },
      env()
    );

    assert.deepEqual(mutationInput, {
      groupPath: "test-group",
      title: "Sprints",
      automatic: false,
      active: true,
      durationInWeeks: 2,
      rollOver: false,
    });
    assert.equal(result.id, "gid://gitlab/Iterations::Cadence/7");
    assert.equal(result.duration_in_weeks, 2);
  });

  test("updates a cadence by numeric ID through iterationCadenceUpdate", async () => {
    const result = await callTool(
      "update_group_iteration_cadence",
      { iteration_cadence_id: "8", title: "Releases", active: false },
      env()
    );

    assert.deepEqual(mutationInput, {
      id: "gid://gitlab/Iterations::Cadence/8",
      title: "Releases",
      active: false,
    });
    assert.equal(result.id, "gid://gitlab/Iterations::Cadence/8");
    assert.equal(result.title, "Releases");
    assert.equal(result.active, false);
  });

  test("rejects an empty cadence update before calling GitLab", async () => {
    await assert.rejects(
      () => callTool("update_group_iteration_cadence", { iteration_cadence_id: "8" }, env()),
      /Provide at least one iteration cadence field/
    );
    assert.equal(graphqlRequests, 0);
  });

  test("deletes a cadence through iterationCadenceDestroy", async () => {
    const result = await callTool(
      "delete_group_iteration_cadence",
      { iteration_cadence_id: "gid://gitlab/Iterations::Cadence/8" },
      env()
    );

    assert.deepEqual(mutationVariables, { id: "gid://gitlab/Iterations::Cadence/8" });
    assert.equal(result.status, "success");
  });

  test("surfaces GitLab cadence errors", async () => {
    mutationErrors = ["Title has already been taken"];

    await assert.rejects(
      () =>
        callTool(
          "create_group_iteration_cadence",
          { group_id: GROUP_ID, title: "Sprints", automatic: false, active: true },
          env()
        ),
      /Title has already been taken/
    );
  });

  test("rejects every group iteration tool while a project allowlist is in effect", async () => {
    const strictEnv = {
      ...env(),
      ENABLE_STRICT_PROJECT_SCOPE: "true",
      GITLAB_ALLOWED_PROJECT_IDS: "1",
    };
    const calls: [string, Record<string, unknown>][] = [
      ["list_group_iterations", { group_id: GROUP_ID }],
      ["get_group_iteration", { group_id: GROUP_ID, iteration_id: ITERATION_ID }],
      ["update_group_iteration", { group_id: GROUP_ID, iteration_id: ITERATION_ID, title: "X" }],
      [
        "create_group_iteration",
        { group_id: GROUP_ID, start_date: "2026-09-08", due_date: "2026-09-21" },
      ],
      ["delete_group_iteration", { group_id: GROUP_ID, iteration_id: ITERATION_ID }],
      ["list_group_iteration_cadences", { group_id: GROUP_ID }],
      [
        "create_group_iteration_cadence",
        { group_id: GROUP_ID, automatic: false, active: true },
      ],
      ["update_group_iteration_cadence", { iteration_cadence_id: "7", title: "X" }],
      ["delete_group_iteration_cadence", { iteration_cadence_id: "7" }],
    ];

    for (const [name, args] of calls) {
      await assert.rejects(
        () => callTool(name, args, strictEnv),
        new RegExp(`${name} is not allowed while a project allowlist is in effect`)
      );
    }
    assert.equal(graphqlRequests, 0);
    assert.equal(mutationInput, undefined);
  });
});
