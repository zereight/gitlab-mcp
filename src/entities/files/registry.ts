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
            // file_path is required for content action (validated by .refine())
            const filePath = input.file_path!;

            const queryParams = new URLSearchParams();
            if (input.ref) queryParams.set("ref", input.ref);

            const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/projects/${normalizeProjectId(input.project_id)}/repository/files/${encodeURIComponent(filePath)}/raw?${queryParams}`;
            const response = await enhancedFetch(apiUrl);

            if (!response.ok) {
              throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
            }

            const content = await response.text();
            return {
              file_path: filePath,
              ref: input.ref ?? "HEAD",
              size: content.length,
              content: content,
              content_type: response.headers.get("content-type") ?? "text/plain",
            };
          }
          /* istanbul ignore next -- unreachable with Zod validation */
          default:
            throw new Error(`Unknown action: ${input.action}`);
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
            // file_path, content, commit_message, branch are required for single action (validated by .refine())
            const { project_id, file_path, action: _action, ...body } = input;
            const filePath = file_path!;

            return gitlab.post(
              `projects/${normalizeProjectId(project_id)}/repository/files/${encodeURIComponent(filePath)}`,
              { body, contentType: "form" }
            );
          }
          case "batch": {
            // files, branch, commit_message are required for batch action (validated by .refine())
            const files = input.files!;
            const branch = input.branch!;
            const commitMessage = input.commit_message!;

            const actions = files.map(file => ({
              action: "create",
              file_path: file.file_path,
              content: file.content,
              encoding: file.encoding ?? "text",
              execute_filemode: file.execute_filemode ?? false,
            }));

            const body: Record<string, unknown> = {
              branch,
              commit_message: commitMessage,
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
            // file, filename are required for upload action (validated by .refine())
            const file = input.file!;
            const filename = input.filename!;

            const formData = new FormData();
            const buffer = Buffer.from(file, "base64");
            const fileObj = new File([new Uint8Array(buffer)], filename, {
              type: "application/octet-stream",
            });
            formData.append("file", fileObj);

            return gitlab.post(`projects/${normalizeProjectId(input.project_id)}/uploads`, {
              body: formData,
            });
          }
          /* istanbul ignore next -- unreachable with Zod validation */
          default:
            throw new Error(`Unknown action: ${input.action}`);
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
