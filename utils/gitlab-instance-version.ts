export type GitLabInstanceVersionMetadata = {
  version: string;
  revision?: string;
  enterprise?: boolean;
};

export function parseGitLabVersionApiResponse(
  data: unknown
): GitLabInstanceVersionMetadata | null {
  if (typeof data !== "object" || data === null || !("version" in data)) {
    return null;
  }
  if (typeof data.version !== "string") {
    return null;
  }

  const metadata: GitLabInstanceVersionMetadata = { version: data.version };

  if ("revision" in data && typeof data.revision === "string") {
    metadata.revision = data.revision;
  }
  if ("enterprise" in data && typeof data.enterprise === "boolean") {
    metadata.enterprise = data.enterprise;
  }

  return metadata;
}
