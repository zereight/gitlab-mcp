/**
 * Todos toolset: the to-do list tool handlers and the GitLab API helpers only they call.
 *
 * index.ts owns the request plumbing these handlers use (the auth-retry fetch, GitLab
 * error handling, the strict project scope guard) and hands it over once with
 * configureTodoTools(). The fetch is read at call time, since index.ts replaces it when
 * the cookie jar reloads.
 */
import type { Response as UndiciResponse } from "undici";
import { z } from "zod";
import type { FetchFn } from "../auth-retry.js";
import {
  GitLabTodoSchema,
  ListTodosSchema,
  MarkAllTodosDoneSchema,
  MarkTodoDoneSchema,
  type GitLabTodo,
  type ListTodosOptions,
} from "../schemas.js";
import { getEffectiveApiUrl, getFetchConfig } from "../server/gitlab-request-context.js";
import { appendFilterParams } from "../utils/tool-args.js";

export interface TodoToolDeps {
  /** The auth-retry fetch from index.ts, re-read on every call because it is reassigned. */
  getFetch: () => FetchFn;
  handleGitLabError: (response: UndiciResponse) => Promise<void>;
  rejectIfStrictProjectScope: (toolName: string) => void;
}

let deps: TodoToolDeps | undefined;

export function configureTodoTools(next: TodoToolDeps): void {
  deps = next;
}

function requireDeps(): TodoToolDeps {
  if (!deps) {
    throw new Error("Todo tools used before configureTodoTools()");
  }
  return deps;
}

const fetch: FetchFn = (input, init) => requireDeps().getFetch()(input, init);

function handleGitLabError(response: UndiciResponse): Promise<void> {
  return requireDeps().handleGitLabError(response);
}

function rejectIfStrictProjectScope(toolName: string): void {
  requireDeps().rejectIfStrictProjectScope(toolName);
}

async function listTodos(options: ListTodosOptions = {}): Promise<GitLabTodo[]> {
  const url = new URL(`${getEffectiveApiUrl()}/todos`);

  appendFilterParams(url.searchParams, options);

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
  });

  await handleGitLabError(response);
  const data = await response.json();
  return z.array(GitLabTodoSchema).parse(data);
}

async function markTodoDone(id: number): Promise<GitLabTodo> {
  const response = await fetch(`${getEffectiveApiUrl()}/todos/${id}/mark_as_done`, {
    ...getFetchConfig(),
    method: "POST",
  });

  await handleGitLabError(response);
  const data = await response.json();
  return GitLabTodoSchema.parse(data);
}

async function markAllTodosDone(): Promise<void> {
  const response = await fetch(`${getEffectiveApiUrl()}/todos/mark_as_done`, {
    ...getFetchConfig(),
    method: "POST",
  });

  await handleGitLabError(response);
}

export interface TodoToolCallParams {
  name: string;
  arguments: unknown;
}

export interface TodoToolResult {
  content: Array<{ type: "text"; text: string }>;
}

export async function handleTodoToolCall(params: TodoToolCallParams): Promise<TodoToolResult> {
  switch (params.name) {
    case "list_todos": {
      rejectIfStrictProjectScope("list_todos");
      const args = ListTodosSchema.parse(params.arguments);
      const todos = await listTodos(args);
      return {
        content: [{ type: "text", text: JSON.stringify(todos) }],
      };
    }

    case "mark_todo_done": {
      rejectIfStrictProjectScope("mark_todo_done");
      const args = MarkTodoDoneSchema.parse(params.arguments);
      const todo = await markTodoDone(args.id);
      return {
        content: [{ type: "text", text: JSON.stringify(todo) }],
      };
    }

    case "mark_all_todos_done": {
      rejectIfStrictProjectScope("mark_all_todos_done");
      MarkAllTodosDoneSchema.parse(params.arguments);
      await markAllTodosDone();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              status: "success",
              message: "All pending to-do items marked as done",
            }),
          },
        ],
      };
    }

    default:
      throw new Error(`Unknown tool: ${params.name}`);
  }
}
