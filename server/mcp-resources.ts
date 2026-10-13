// npm ships build/ only, so the text is inlined.

import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";

const TEXT_MARKDOWN = "text/markdown";

const resources = [
  {
    uri: "gitlab-mcp://docs/auth-setup",
    name: "auth-setup",
    description: "Local token auth and browser OAuth.",
    text:
      "A personal access token is the local default path. Set GITLAB_PERSONAL_ACCESS_TOKEN and GITLAB_API_URL. OAuth is the browser path. Enable it with GITLAB_USE_OAUTH.",
  },
  {
    uri: "gitlab-mcp://docs/toolsets",
    name: "toolsets",
    description: "How the enabled toolset list is chosen.",
    text:
      "When GITLAB_TOOLSETS is unset, the server uses the lean core toolset. GITLAB_TOOLSETS or --toolsets sets an explicit list. An explicit list replaces core. It does not merge with core.",
  },
  {
    uri: "gitlab-mcp://docs/permission-modes",
    name: "permission-modes",
    description: "How permission mode limits tool calls.",
    text:
      "Set GITLAB_PERMISSION_MODE or pass --permission-mode. readonly blocks writes. modify blocks delete and teardown. full is the default.",
  },
];

export function listMcpResources(): {
  resources: readonly {
    uri: string;
    name: string;
    description: string;
    mimeType: "text/markdown";
  }[];
} {
  return {
    resources: resources.map(resource => ({
      uri: resource.uri,
      name: resource.name,
      description: resource.description,
      mimeType: TEXT_MARKDOWN,
    })),
  };
}

export function readMcpResource(uri: string): {
  contents: readonly {
    uri: string;
    mimeType: "text/markdown";
    text: string;
  }[];
} {
  const resource = resources.find(entry => entry.uri === uri);
  if (resource === undefined) {
    throw new McpError(ErrorCode.InvalidParams, `Resource ${uri} not found`);
  }

  return {
    contents: [
      {
        uri: resource.uri,
        mimeType: TEXT_MARKDOWN,
        text: resource.text,
      },
    ],
  };
}
