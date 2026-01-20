import * as z from "zod";
import { BrowseFilesSchema } from "./schema-readonly";
import { ManageFilesSchema } from "./schema";
import { gitlab, toQuery } from "../../utils/gitlab-api";
import { normalizeProjectId } from "../../utils/projectIdentifier";
import { enhancedFetch } from "../../utils/fetch";
import { ToolRegistry, EnhancedToolDefinition } from "../../types";
import { isActionDenied } from "../../config";

/**
 * Files tools registry - 2 CQRS tools replacing 5 individual tools
 *
 * browse_files (Query): tree listing + file content reading
 * manage_files (Command): single file, batch commit, markdown upload
 */
export const filesToolRegistry: ToolRegistry = new Map<string, EnhancedToolDefinition>([
  // ============================================================================
  // browse_files - CQRS Query Tool (discriminated union schema)
  // TypeScript automatically narrows types in each switch case
  // ============================================================================
  [
    "browse_files",
    {
      name: "browse_files",
      description:
        'BROWSE repository files. Actions: "tree" lists files/folders with pagination, "content" reads file contents. Use for exploring project structure or reading source code.',
      inputSchema: z.toJSONSchema(BrowseFilesSchema),
      gate: { envVar: "USE_FILES", defaultValue: true },
      handler: async (args: unknown) => {
        const input = BrowseFilesSchema.parse(args);

        // Runtime validation: reject denied actions even if they bypass schema filtering
        if (isActionDenied("browse_files", input.action)) {
          throw new Error(`Action '${input.action}' is not allowed for browse_files tool`);
        }

        switch (input.action) {
          case "tree": {
            // TypeScript knows: input has path, recursive, per_page, page (optional)
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
            // TypeScript knows: input has file_path (required)
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

          /* istanbul ignore next -- unreachable with Zod discriminatedUnion */
          default:
            throw new Error(`Unknown action: ${(input as { action: string }).action}`);
        }
      },
    },
  ],

  // ============================================================================
  // manage_files - CQRS Command Tool (discriminated union schema)
  // TypeScript automatically narrows types in each switch case
  // ============================================================================
  [
    "manage_files",
    {
      name: "manage_files",
      description:
        'MANAGE repository files. Actions: "single" creates/updates one file, "batch" commits multiple files atomically, "upload" adds markdown attachments.',
      inputSchema: z.toJSONSchema(ManageFilesSchema),
      gate: { envVar: "USE_FILES", defaultValue: true },
      handler: async (args: unknown) => {
        const input = ManageFilesSchema.parse(args);

        // Runtime validation: reject denied actions even if they bypass schema filtering
        if (isActionDenied("manage_files", input.action)) {
          throw new Error(`Action '${input.action}' is not allowed for manage_files tool`);
        }

        switch (input.action) {
          case "single": {
            // TypeScript knows: input has file_path, content, commit_message, branch (required)
            const { project_id, file_path, action: _action, ...body } = input;

            return gitlab.post(
              `projects/${normalizeProjectId(project_id)}/repository/files/${encodeURIComponent(file_path)}`,
              { body, contentType: "form" }
            );
          }

          case "batch": {
            // TypeScript knows: input has files, branch, commit_message (required)
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
            // TypeScript knows: input has file, filename (required)
            const formData = new FormData();
            const buffer = Buffer.from(input.file, "base64");
            // Buffer is a Uint8Array subclass, can be passed directly to File constructor
            const fileObj = new File([buffer], input.filename, {
              type: "application/octet-stream",
            });
            formData.append("file", fileObj);

            return gitlab.post(`projects/${normalizeProjectId(input.project_id)}/uploads`, {
              body: formData,
            });
          }

          /* istanbul ignore next -- unreachable with Zod discriminatedUnion */
          default:
            throw new Error(`Unknown action: ${(input as { action: string }).action}`);
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
