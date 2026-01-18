import * as z from "zod";
import { GetRepositoryTreeSchema, GetFileContentsSchema } from "./schema-readonly";
import { CreateOrUpdateFileSchema, PushFilesSchema, MarkdownUploadSchema } from "./schema";
import { gitlab, toQuery } from "../../utils/gitlab-api";
import { normalizeProjectId } from "../../utils/projectIdentifier";
import { enhancedFetch } from "../../utils/fetch";
import { ToolRegistry, EnhancedToolDefinition } from "../../types";

/**
 * Files tools registry - unified registry containing all file operation tools with their handlers
 */
export const filesToolRegistry: ToolRegistry = new Map<string, EnhancedToolDefinition>([
  [
    "get_repository_tree",
    {
      name: "get_repository_tree",
      description:
        "BROWSE: List files/folders WITHOUT reading content. Use when: Exploring project structure, Finding file locations, Checking what exists. Returns: names, types (blob=file, tree=folder), sizes. Set recursive=true for full tree. Does NOT return file contents! See also: get_file_contents to READ actual content.",
      inputSchema: z.toJSONSchema(GetRepositoryTreeSchema),
      handler: async (args: unknown) => {
        const options = GetRepositoryTreeSchema.parse(args);

        return gitlab.get(`projects/${normalizeProjectId(options.project_id)}/repository/tree`, {
          query: toQuery(options, ["project_id"]),
        });
      },
    },
  ],
  [
    "get_file_contents",
    {
      name: "get_file_contents",
      description:
        "READ: Get actual file content from repository. Use when: Reading source code, Viewing configs/docs, Getting file data. Returns base64-encoded content (decode required!) plus metadata. For browsing structure use get_repository_tree instead. Supports any branch/tag/commit via ref param.",
      inputSchema: z.toJSONSchema(GetFileContentsSchema),
      handler: async (args: unknown) => {
        const options = GetFileContentsSchema.parse(args);
        const { project_id, file_path, ref } = options;

        const queryParams = new URLSearchParams();
        if (ref) {
          queryParams.set("ref", ref);
        }

        // Raw endpoint returns file content directly, not JSON - need custom handling
        const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/projects/${normalizeProjectId(project_id)}/repository/files/${encodeURIComponent(file_path)}/raw?${queryParams}`;
        const response = await enhancedFetch(apiUrl);

        if (!response.ok) {
          throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
        }

        const content = await response.text();

        return {
          file_path: file_path,
          ref: ref ?? "HEAD",
          size: content.length,
          content: content,
          content_type: response.headers.get("content-type") ?? "text/plain",
        };
      },
    },
  ],
  [
    "create_or_update_file",
    {
      name: "create_or_update_file",
      description:
        "SINGLE FILE: Create new OR update existing file in one commit. Use when: Changing ONE file only, Quick edits, Adding single document. Auto-detects create vs update. Content must be base64-encoded! For multiple files use push_files instead. Creates commit with your message.",
      inputSchema: z.toJSONSchema(CreateOrUpdateFileSchema),
      handler: async (args: unknown) => {
        const options = CreateOrUpdateFileSchema.parse(args);
        const { project_id, file_path, ...body } = options;

        return gitlab.post(
          `projects/${normalizeProjectId(project_id)}/repository/files/${encodeURIComponent(file_path)}`,
          { body, contentType: "form" }
        );
      },
    },
  ],
  [
    "push_files",
    {
      name: "push_files",
      description:
        "BATCH: Commit MULTIPLE file changes atomically. Use when: Changing 2+ files together, Refactoring across files, Coordinated updates. More efficient than multiple single commits. Supports: create/update/delete/move operations. All changes in ONE commit. For single file use create_or_update_file.",
      inputSchema: z.toJSONSchema(PushFilesSchema),
      handler: async (args: unknown) => {
        const options = PushFilesSchema.parse(args);

        const actions = options.files.map(file => ({
          action: "create",
          file_path: file.file_path,
          content: file.content,
          encoding: file.encoding ?? "text",
          execute_filemode: file.execute_filemode ?? false,
        }));

        const body: Record<string, unknown> = {
          branch: options.branch,
          commit_message: options.commit_message,
          actions: actions,
        };

        if (options.start_branch) body.start_branch = options.start_branch;
        if (options.author_email) body.author_email = options.author_email;
        if (options.author_name) body.author_name = options.author_name;

        return gitlab.post(
          `projects/${normalizeProjectId(options.project_id)}/repository/commits`,
          { body, contentType: "json" }
        );
      },
    },
  ],
  [
    "upload_markdown",
    {
      name: "upload_markdown",
      description:
        "UPLOAD ASSET: Add images/docs for markdown embedding. Use when: Adding screenshots to issues/MRs, Uploading diagrams for wikis, Attaching files to documentation. Returns markdown-ready URL like ![](url). Stored in uploads, NOT repository. Supports: images, PDFs, any binary files.",
      inputSchema: z.toJSONSchema(MarkdownUploadSchema),
      handler: async (args: unknown) => {
        const options = MarkdownUploadSchema.parse(args);

        const formData = new FormData();
        const buffer = Buffer.from(options.file, "base64");
        const fileObj = new File([buffer], options.filename, { type: "application/octet-stream" });
        formData.append("file", fileObj);

        return gitlab.post(`projects/${normalizeProjectId(options.project_id)}/uploads`, {
          body: formData,
        });
      },
    },
  ],
]);

export function getFilesReadOnlyToolNames(): string[] {
  return ["get_repository_tree", "get_file_contents"];
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
