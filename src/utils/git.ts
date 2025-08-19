import { simpleGit } from "simple-git";

/**
 * Detect the current git branch in the working directory
 */
export async function detectCurrentBranch(workingDirectory?: string): Promise<string> {
  const cwd = workingDirectory || process.cwd();
  const git = simpleGit(cwd);
  
  try {
    const branch = await git.revparse(["--abbrev-ref", "HEAD"]);
    return branch.trim();
  } catch (error) {
    throw new Error(`Failed to detect current branch: ${error}`);
  }
}

/**
 * Check if there are uncommitted changes in the working directory
 */
export async function hasUncommittedChanges(workingDirectory?: string): Promise<boolean> {
  const cwd = workingDirectory || process.cwd();
  const git = simpleGit(cwd);
  
  try {
    const status = await git.status();
    return status.files.length > 0;
  } catch (error) {
    console.warn(`Failed to check git status: ${error}`);
    return false;
  }
}

/**
 * Get detailed git status information
 */
export async function getGitStatus(workingDirectory?: string): Promise<{
  isClean: boolean;
  staged: number;
  unstaged: number;
  untracked: number;
  files: string[];
}> {
  const cwd = workingDirectory || process.cwd();
  const git = simpleGit(cwd);
  
  try {
    const status = await git.status();
    return {
      isClean: status.files.length === 0,
      staged: status.staged.length,
      unstaged: status.modified.length + status.deleted.length,
      untracked: status.not_added.length,
      files: status.files.map(f => f.path)
    };
  } catch (error) {
    console.warn(`Failed to get git status: ${error}`);
    return {
      isClean: false,
      staged: 0,
      unstaged: 0,
      untracked: 0,
      files: []
    };
  }
}