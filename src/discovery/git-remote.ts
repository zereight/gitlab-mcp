/**
 * Git remote URL parser for auto-discovery
 *
 * Parses git remote URLs to extract host and project path.
 * Supports SSH and HTTPS formats, including nested groups.
 */

import * as fs from "fs/promises";
import * as path from "path";
import { logger } from "../logger";

// ============================================================================
// Types
// ============================================================================

export interface GitRemoteInfo {
  /** GitLab host (e.g., gitlab.company.com) */
  host: string;
  /** Project path (e.g., group/project or group/subgroup/project) */
  projectPath: string;
  /** Remote URL protocol */
  protocol: "ssh" | "https";
  /** Original remote URL */
  url: string;
  /** Remote name (e.g., origin, upstream) */
  remoteName: string;
}

export interface ParseGitRemoteOptions {
  /** Remote name to use (default: origin) */
  remoteName?: string;
  /** Path to repository (default: current directory) */
  repoPath?: string;
}

// ============================================================================
// URL Parsing
// ============================================================================

/**
 * Parse a git remote URL into host and project path
 *
 * Supports:
 * - SSH: git@host:group/project.git
 * - SSH with port: ssh://git@host:port/group/project.git
 * - HTTPS: https://host/group/project.git
 * - HTTPS with port: https://host:port/group/project.git
 *
 * @param url Git remote URL
 * @returns Parsed info or null if not a valid GitLab URL
 */
export function parseRemoteUrl(url: string): Omit<GitRemoteInfo, "remoteName"> | null {
  // Normalize URL: trim whitespace
  const normalizedUrl = url.trim();

  // SSH format: git@host:path.git
  const sshMatch = normalizedUrl.match(/^git@([^:]+):(.+?)(?:\.git)?$/);
  if (sshMatch) {
    return {
      host: sshMatch[1],
      projectPath: normalizeProjectPath(sshMatch[2]),
      protocol: "ssh",
      url: normalizedUrl,
    };
  }

  // SSH with explicit protocol: ssh://git@host/path.git or ssh://git@host:port/path.git
  const sshProtocolMatch = normalizedUrl.match(
    /^ssh:\/\/git@([^/:]+)(?::(\d+))?\/(.+?)(?:\.git)?$/
  );
  if (sshProtocolMatch) {
    const sshHost = sshProtocolMatch[2]
      ? `${sshProtocolMatch[1]}:${sshProtocolMatch[2]}`
      : sshProtocolMatch[1];
    return {
      host: sshHost,
      projectPath: normalizeProjectPath(sshProtocolMatch[3]),
      protocol: "ssh",
      url: normalizedUrl,
    };
  }

  // HTTPS format: https://host/path.git or https://host:port/path.git
  const httpsMatch = normalizedUrl.match(/^https?:\/\/([^/:]+)(?::(\d+))?\/(.+?)(?:\.git)?$/);
  if (httpsMatch) {
    const httpsHost = httpsMatch[2] ? `${httpsMatch[1]}:${httpsMatch[2]}` : httpsMatch[1];
    return {
      host: httpsHost,
      projectPath: normalizeProjectPath(httpsMatch[3]),
      protocol: "https",
      url: normalizedUrl,
    };
  }

  logger.debug({ url: normalizedUrl }, "Could not parse remote URL");
  return null;
}

/**
 * Normalize project path: remove leading/trailing slashes
 */
function normalizeProjectPath(projectPath: string): string {
  return projectPath.replace(/^\/+|\/+$/g, "");
}

// ============================================================================
// Git Config Parsing
// ============================================================================

/**
 * Parse git config file content to extract remote URLs
 *
 * Uses a state-based line-by-line parser to correctly handle multiline
 * configurations where url may not immediately follow the remote header.
 *
 * @param content Git config file content
 * @returns Map of remote name to URL
 */
export function parseGitConfig(content: string): Map<string, string> {
  const remotes = new Map<string, string>();
  const lines = content.split(/\r?\n/);
  let currentRemote: string | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (line.length === 0) {
      continue;
    }

    // Detect start of a [remote "name"] section
    const remoteHeaderMatch = line.match(/^\[remote\s+"([^"]+)"\]\s*$/);
    if (remoteHeaderMatch) {
      currentRemote = remoteHeaderMatch[1];
      continue;
    }

    // Any other section header ends the current remote section
    if (line.startsWith("[") && line.endsWith("]")) {
      currentRemote = null;
      continue;
    }

    if (currentRemote === null) {
      continue;
    }

    // Capture url = ... lines within the current remote section
    const urlMatch = line.match(/^url\s*=\s*(.+)$/);
    if (urlMatch) {
      const url = urlMatch[1].trim();
      if (url !== "") {
        remotes.set(currentRemote, url);
      }
    }
  }

  return remotes;
}

/**
 * Find the best GitLab remote from available remotes
 *
 * Priority:
 * 1. Specified remote name (if provided)
 * 2. "origin" remote
 * 3. First available remote
 *
 * @param remotes Map of remote name to URL
 * @param preferredRemote Preferred remote name
 * @returns Best remote entry or null
 */
export function selectBestRemote(
  remotes: Map<string, string>,
  preferredRemote?: string
): { name: string; url: string } | null {
  if (remotes.size === 0) {
    return null;
  }

  // If preferred remote is specified and exists, use it
  if (preferredRemote) {
    const url = remotes.get(preferredRemote);
    if (url !== undefined) {
      return { name: preferredRemote, url };
    }
  }

  // Prefer "origin"
  const originUrl = remotes.get("origin");
  if (originUrl !== undefined) {
    return { name: "origin", url: originUrl };
  }

  // Fall back to first remote
  const firstEntry = remotes.entries().next();
  if (firstEntry.done) {
    return null;
  }
  const [name, url] = firstEntry.value;
  return { name, url };
}

// ============================================================================
// Main API
// ============================================================================

/**
 * Parse git remote from a repository
 *
 * @param options Parsing options
 * @returns GitRemoteInfo or null if no valid remote found
 */
export async function parseGitRemote(
  options: ParseGitRemoteOptions = {}
): Promise<GitRemoteInfo | null> {
  const repoPath = options.repoPath ?? process.cwd();
  const gitConfigPath = path.join(repoPath, ".git", "config");

  // Check if .git/config exists
  try {
    await fs.access(gitConfigPath);
  } catch {
    logger.debug({ path: repoPath }, "No .git/config found - not a git repository");
    return null;
  }

  // Read and parse git config
  let content: string;
  try {
    content = await fs.readFile(gitConfigPath, "utf-8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn({ error: message, path: gitConfigPath }, "Failed to read git config");
    return null;
  }

  // Parse remotes from config
  const remotes = parseGitConfig(content);
  if (remotes.size === 0) {
    logger.debug({ path: repoPath }, "No remotes found in git config");
    return null;
  }

  // Select best remote
  const selected = selectBestRemote(remotes, options.remoteName);
  if (!selected) {
    return null;
  }

  // Parse the remote URL
  const parsed = parseRemoteUrl(selected.url);
  if (!parsed) {
    logger.warn({ remote: selected.name, url: selected.url }, "Could not parse remote URL format");
    return null;
  }

  logger.debug(
    {
      remote: selected.name,
      host: parsed.host,
      projectPath: parsed.projectPath,
      protocol: parsed.protocol,
    },
    "Parsed git remote"
  );

  return {
    ...parsed,
    remoteName: selected.name,
  };
}

/**
 * List all remotes from a repository
 *
 * @param repoPath Path to repository
 * @returns Array of parsed remote info
 */
export async function listGitRemotes(repoPath?: string): Promise<GitRemoteInfo[]> {
  const gitConfigPath = path.join(repoPath ?? process.cwd(), ".git", "config");

  try {
    const content = await fs.readFile(gitConfigPath, "utf-8");
    const remotes = parseGitConfig(content);
    const result: GitRemoteInfo[] = [];

    for (const [name, url] of remotes) {
      const parsed = parseRemoteUrl(url);
      if (parsed) {
        result.push({ ...parsed, remoteName: name });
      }
    }

    return result;
  } catch {
    return [];
  }
}
