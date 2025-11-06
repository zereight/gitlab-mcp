/**
 * GitLab Files & Repository Tools
 *
 * Privacy preservation: File contents stay in execution environment,
 * can be processed before exposing to model context.
 */

import { callMCPTool } from "../callMCPTool.js";
import type {
  GitLabContent,
  GetFileContentsInput,
  CreateOrUpdateFileInput,
  PushFilesInput,
} from "../types.js";

/**
 * Get file contents from a GitLab repository
 *
 * @example
 * ```typescript
 * const file = await getFileContents({
 *   projectId: '123',
 *   filePath: 'src/main.ts',
 *   ref: 'main'
 * });
 *
 * // Privacy: Decode and process file locally
 * const content = Buffer.from(file.content, file.encoding).toString();
 * const lineCount = content.split('\n').length;
 * // Only return summary, not full content
 * console.log(`File has ${lineCount} lines`);
 * ```
 */
export async function getFileContents(
  input: GetFileContentsInput
): Promise<GitLabContent | GitLabContent[]> {
  return callMCPTool<GitLabContent | GitLabContent[]>(
    "get_file_contents",
    input
  );
}

/**
 * Create or update a single file
 *
 * @example
 * ```typescript
 * await createOrUpdateFile({
 *   projectId: '123',
 *   filePath: 'README.md',
 *   content: '# My Project\n\nDescription here',
 *   branch: 'main',
 *   commitMessage: 'Update README'
 * });
 * ```
 */
export async function createOrUpdateFile(
  input: CreateOrUpdateFileInput
): Promise<any> {
  return callMCPTool("create_or_update_file", input);
}

/**
 * Push multiple files in a single commit
 *
 * Control flow: Build file actions programmatically
 *
 * @example
 * ```typescript
 * const files = ['file1.ts', 'file2.ts', 'file3.ts'];
 * const actions = files.map(file => ({
 *   action: 'create' as const,
 *   file_path: file,
 *   content: generateFileContent(file)
 * }));
 *
 * await pushFiles({
 *   projectId: '123',
 *   branch: 'feature-branch',
 *   commitMessage: 'Add new files',
 *   actions
 * });
 * ```
 */
export async function pushFiles(input: PushFilesInput): Promise<any> {
  return callMCPTool("push_files", input);
}

/**
 * Get repository tree (list files and directories)
 *
 * Data filtering: Process large directory trees locally
 *
 * @example
 * ```typescript
 * const tree = await getRepositoryTree({
 *   projectId: '123',
 *   path: 'src',
 *   recursive: true
 * });
 *
 * // Filter to only TypeScript files in execution environment
 * const tsFiles = tree.filter(item =>
 *   item.type === 'blob' && item.path.endsWith('.ts')
 * );
 * console.log(`Found ${tsFiles.length} TypeScript files`);
 * ```
 */
export async function getRepositoryTree(input: {
  projectId: string;
  path?: string;
  ref?: string;
  recursive?: boolean;
  perPage?: number;
  page?: number;
}): Promise<any[]> {
  return callMCPTool<any[]>("get_repository_tree", input);
}

/**
 * Get file content by path - simplified helper
 */
export async function getFile(
  projectId: string,
  filePath: string,
  ref: string = "main"
): Promise<string> {
  const result = await getFileContents({ projectId, filePath, ref });

  if (Array.isArray(result)) {
    throw new Error("Expected single file, got directory listing");
  }

  // Decode base64 content
  return Buffer.from(result.content, result.encoding as BufferEncoding).toString();
}

/**
 * Update file content - simplified helper
 */
export async function updateFile(
  projectId: string,
  filePath: string,
  content: string,
  branch: string,
  commitMessage: string
): Promise<any> {
  return createOrUpdateFile({
    projectId,
    filePath,
    content,
    branch,
    commitMessage,
  });
}
