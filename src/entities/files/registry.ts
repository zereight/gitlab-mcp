import * as z from "zod";
import { BrowseFilesSchema, BrowseFilesInput } from "./schema-readonly";
import { ManageFilesSchema, ManageFilesInput } from "./schema";
import { gitlab, toQuery } from "../../utils/gitlab-api";
import { normalizeProjectId } from "../../utils/projectIdentifier";
import { enhancedFetch } from "../../utils/fetch";
import { ToolRegistry, EnhancedToolDefinition } from "../../types";

/**
 * Files tools registry - 2 CQRS tools replacing 5 individual tools
 *
 * browse_files (Query): tree listing + file content reading
 * manage_files (Command): single file, batch commit, markdown upload
 */
export const filesToolRegistry: ToolRegistry = new Map<string, EnhancedToolDefinition>([
  [
    "browse_files",
    {
      name: "browse_files",
      description:
        'BROWSE repository files. Actions: "tree" lists files/folders with pagination, "content" reads file contents. Use for exploring project structure or reading source code.',
      inputSchema: z.toJSONSchema(BrowseFilesSchema),
      handler: async (args: unknown) => {
        const input = BrowseFilesSchema.parse(args);

        switch (input.action) {
          case "tree": {
            const query: Record<string, string | number | boolean | undefined> = {};
            if (input.path) query.path = input.path;
            if (input.ref) query.ref = input.ref;
            if (input.recursive !== undefined) query.recursive = input.recursive;
            if (input.per_page !== undefined) query.per_page = input.per_page;
            if (input.page !== undefined) query.page = input.page;

            return gitlab.get(`projects/${normalizeProjectId(input.project_id)}/repository/tree`, {
              query: toQuery(query, []),
            });
          }
          case "content": {
            const queryParams = new URLSearchParams();
            if (input.ref) queryParams.set("ref", input.ref);

            const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/projects/${normalizeProjectId(input.project_id)}/repository/files/${encodeURIComponent(input.file_path)}/raw?${queryParams}`;
            const response = await enhancedFetch(apiUrl);

            if (!response.ok) {
              throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
            }

            const content = await response.text();
            return {
              file_path: input.file_path,
              ref: input.ref ?? "HEAD",
              size: content.length,
              content: content,
              content_type: response.headers.get("content-type") ?? "text/plain",
            };
          }
          default: {
            const _exhaustive: never = input;
            throw new Error(`Unknown action: ${(_exhaustive as BrowseFilesInput).action}`);
          }
        }
      },
    },
  ],
  [
    "manage_files",
    {
      name: "manage_files",
      description:
        'MANAGE repository files. Actions: "single" creates/updates one file, "batch" commits multiple files atomically, "upload" adds markdown attachments.',
      inputSchema: z.toJSONSchema(ManageFilesSchema),
      handler: async (args: unknown) => {
        const input = ManageFilesSchema.parse(args);

        switch (input.action) {
          case "single": {
            const { project_id, file_path, action: _action, ...body } = input;
            return gitlab.post(
              `projects/${normalizeProjectId(project_id)}/repository/files/${encodeURIComponent(file_path)}`,
              { body, contentType: "form" }
            );
          }
          case "batch": {
            const actions = input.files.map(file => ({
              action: "create",
              file_path: file.file_path,
              content: file.content,
              encoding: file.encoding ?? "text",
              execute_filemode: file.execute_filemode ?? false,
            }));

            const body: Record<string, unknown> = {
              branch: input.branch,
              commit_message: input.commit_message,
              actions,
            };

            if (input.start_branch) body.start_branch = input.start_branch;
            if (input.author_email) body.author_email = input.author_email;
            if (input.author_name) body.author_name = input.author_name;

            return gitlab.post(
              `projects/${normalizeProjectId(input.project_id)}/repository/commits`,
              { body, contentType: "json" }
            );
          }
          case "upload": {
            const formData = new FormData();
            const buffer = Buffer.from(input.file, "base64");
            const fileObj = new File([buffer], input.filename, {
              type: "application/octet-stream",
            });
            formData.append("file", fileObj);

            return gitlab.post(`projects/${normalizeProjectId(input.project_id)}/uploads`, {
              body: formData,
            });
          }
          default: {
            const _exhaustive: never = input;
            throw new Error(`Unknown action: ${(_exhaustive as ManageFilesInput).action}`);
          }
        }
      },
    },
  ],
]);

export function getFilesReadOnlyToolNames(): string[] {
  return ["browse_files"];
}

export function getFilesToolDefinitions(): EnhancedToolDefinition[] {
  return Array.from(filesToolRegistry.values());
}

export function getFilteredFilesTools(readOnlyMode: boolean = false): EnhancedToolDefinition[] {
  if (readOnlyMode) {
    const readOnlyNames = getFilesReadOnlyToolNames();
    return Array.from(filesToolRegistry.values()).filter(tool => readOnlyNames.includes(tool.name));
  }
  return getFilesToolDefinitions();
}
