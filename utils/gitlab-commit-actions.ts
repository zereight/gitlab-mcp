import type { FileOperation } from "../schemas.js";

export type RepoFileEncoding = "text" | "base64";

export type GitLabCommitAction = {
  action: "create" | "update" | "delete" | "move";
  file_path: string;
  previous_path?: string;
  content?: string;
  encoding?: RepoFileEncoding;
};

export function encodeRepoFilePayloadContent(
  content: string,
  globalEncoding: RepoFileEncoding
): string {
  if (globalEncoding === "base64") {
    return Buffer.from(content).toString("base64");
  }
  return content;
}

function applyContentAndEncoding(
  entry: GitLabCommitAction,
  content: string,
  encoding: RepoFileEncoding | undefined,
  globalEncoding: RepoFileEncoding
): void {
  if (encoding !== undefined) {
    entry.content = content;
    entry.encoding = encoding;
    return;
  }
  entry.content = encodeRepoFilePayloadContent(content, globalEncoding);
  entry.encoding = globalEncoding;
}

export function toGitLabCommitActions(
  actions: FileOperation[],
  globalEncoding: RepoFileEncoding
): GitLabCommitAction[] {
  return actions.map(action => {
    const act = action.action ?? "create";
    const entry: GitLabCommitAction = { action: act, file_path: action.path };

    if (act === "delete") {
      return entry;
    }

    if (act === "move") {
      if (action.previous_path) {
        entry.previous_path = action.previous_path;
      }
      if (action.content === undefined) {
        return entry;
      }
      applyContentAndEncoding(entry, action.content, action.encoding, globalEncoding);
      return entry;
    }

    if (action.content === undefined) {
      throw new Error(`content is required when action is '${act}'`);
    }

    applyContentAndEncoding(entry, action.content, action.encoding, globalEncoding);
    return entry;
  });
}
