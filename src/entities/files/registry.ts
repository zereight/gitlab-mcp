/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import * as z from "zod";
import { GetRepositoryTreeSchema, GetFileContentsSchema } from "./schema-readonly";
import { CreateOrUpdateFileSchema, PushFilesSchema, MarkdownUploadSchema } from "./schema";
import { enhancedFetch } from "../../utils/fetch";
import { normalizeProjectId } from "../../utils/projectIdentifier";
import { cleanGidsFromObject } from "../../utils/idConversion";
import { ToolRegistry, EnhancedToolDefinition } from "../../types";

/**
 * Files tools registry - unified registry containing all file operation tools with their handlers
 */
export const filesToolRegistry: ToolRegistry = new Map<string, EnhancedToolDefinition>([
  // Read-only tools
  [
    "get_repository_tree",
    {
      name: "get_repository_tree",
      description:
        "BROWSE: List files/folders WITHOUT reading content. Use when: Exploring project structure, Finding file locations, Checking what exists. Returns: names, types (blob=file, tree=folder), sizes. Set recursive=true for full tree. Does NOT return file contents! See also: get_file_contents to READ actual content.",
      inputSchema: z.toJSONSchema(GetRepositoryTreeSchema),
      handler: async (args: unknown): Promise<unknown> => {
        const options = GetRepositoryTreeSchema.parse(args);
        const { project_id } = options;

        const queryParams = new URLSearchParams();
        Object.entries(options).forEach(([key, value]) => {
          if (value !== undefined && key !== "project_id") {
            queryParams.set(key, String(value));
          }
        });

        const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/projects/${normalizeProjectId(project_id)}/repository/tree?${queryParams}`;
        const response = await enhancedFetch(apiUrl, {
          headers: {
            Authorization: `Bearer ${process.env.GITLAB_TOKEN}`,
          },
        });

        if (!response.ok) {
          throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
        }

        const tree = await response.json();
        return cleanGidsFromObject(tree);
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
      handler: async (args: unknown): Promise<unknown> => {
        const options = GetFileContentsSchema.parse(args);
        const { project_id, file_path, ref } = options;

        const queryParams = new URLSearchParams();
        if (ref) {
          queryParams.set("ref", ref);
        }

        const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/projects/${normalizeProjectId(project_id)}/repository/files/${encodeURIComponent(file_path)}/raw?${queryParams}`;
        const response = await enhancedFetch(apiUrl, {
          headers: {
            Authorization: `Bearer ${process.env.GITLAB_TOKEN}`,
          },
        });

        if (!response.ok) {
          throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
        }

        // Raw endpoint returns the file content directly, not JSON
        const content = await response.text();

        // Return structured response with file metadata
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
  // Write tools
  [
    "create_or_update_file",
    {
      name: "create_or_update_file",
      description:
        "SINGLE FILE: Create new OR update existing file in one commit. Use when: Changing ONE file only, Quick edits, Adding single document. Auto-detects create vs update. Content must be base64-encoded! For multiple files use push_files instead. Creates commit with your message.",
      inputSchema: z.toJSONSchema(CreateOrUpdateFileSchema),
      handler: async (args: unknown): Promise<unknown> => {
        const options = CreateOrUpdateFileSchema.parse(args);
        const { project_id, file_path } = options;

        const body = new URLSearchParams();
        Object.entries(options).forEach(([key, value]) => {
          if (value !== undefined && key !== "project_id" && key !== "file_path") {
            body.set(key, String(value));
          }
        });

        const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/projects/${normalizeProjectId(project_id)}/repository/files/${encodeURIComponent(file_path)}`;
        const response = await enhancedFetch(apiUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.GITLAB_TOKEN}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: body.toString(),
        });

        if (!response.ok) {
          throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();
        return cleanGidsFromObject(result);
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
      handler: async (args: unknown): Promise<unknown> => {
        const options = PushFilesSchema.parse(args);
        const { project_id } = options;

        // Convert files to actions format for GitLab API
        const actions = options.files.map(file => ({
          action: "create",
          file_path: file.file_path,
          content: file.content,
          encoding: file.encoding ?? "text",
          execute_filemode: file.execute_filemode ?? false,
        }));

        const body = {
          branch: options.branch,
          commit_message: options.commit_message,
          actions: actions,
          start_branch: options.start_branch,
          author_email: options.author_email,
          author_name: options.author_name,
        };

        // Remove undefined fields
        Object.keys(body).forEach(key => {
          if (body[key as keyof typeof body] === undefined) {
            delete body[key as keyof typeof body];
          }
        });

        const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/projects/${normalizeProjectId(project_id)}/repository/commits`;
        const response = await enhancedFetch(apiUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.GITLAB_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
        }

        const commit = await response.json();
        return cleanGidsFromObject(commit);
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
      handler: async (args: unknown): Promise<unknown> => {
        const options = MarkdownUploadSchema.parse(args);
        const { project_id, file, filename } = options;

        // Create FormData for file upload
        const formData = new FormData();

        // Convert base64 file content to File object
        // Node.js requires File (not Blob with filename) for proper multipart handling
        const buffer = Buffer.from(file, "base64");
        const fileObj = new File([buffer], filename, { type: "application/octet-stream" });

        formData.append("file", fileObj);

        const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/projects/${normalizeProjectId(project_id)}/uploads`;
        const response = await enhancedFetch(apiUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.GITLAB_TOKEN}`,
          },
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
        }

        const upload = await response.json();
        return cleanGidsFromObject(upload);
      },
    },
  ],
]);

/**
 * Get read-only tool names from the registry
 */
export function getFilesReadOnlyToolNames(): string[] {
  return ["get_repository_tree", "get_file_contents"];
}

/**
 * Get all tool definitions from the registry (for backward compatibility)
 */
export function getFilesToolDefinitions(): EnhancedToolDefinition[] {
  return Array.from(filesToolRegistry.values());
}

/**
 * Get filtered tools based on read-only mode
 */
export function getFilteredFilesTools(readOnlyMode: boolean = false): EnhancedToolDefinition[] {
  if (readOnlyMode) {
    const readOnlyNames = getFilesReadOnlyToolNames();
    return Array.from(filesToolRegistry.values()).filter(tool => readOnlyNames.includes(tool.name));
  }
  return getFilesToolDefinitions();
}
