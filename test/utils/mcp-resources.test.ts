import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import {
  listMcpResources,
  listMcpResourceTemplates,
  readMcpResource,
} from "../../server/mcp-resources.js";

const AUTH_SETUP_URI = "gitlab-mcp://docs/auth-setup";
const TOOLSETS_URI = "gitlab-mcp://docs/toolsets";
const PERMISSION_MODES_URI = "gitlab-mcp://docs/permission-modes";

function readText(uri: string): string {
  const content = readMcpResource(uri).contents[0];
  assert.ok(content);
  return content.text;
}

describe("When listing MCP resources", () => {
  describe("with the inlined catalog", () => {
    it("should return auth-setup, toolsets, and permission-modes in order", () => {
      assert.deepEqual(
        listMcpResources().resources.map(resource => resource.uri),
        [AUTH_SETUP_URI, TOOLSETS_URI, PERMISSION_MODES_URI]
      );
    });

    it("should mark every resource as text/markdown", () => {
      assert.deepEqual(
        listMcpResources().resources.map(resource => resource.mimeType),
        ["text/markdown", "text/markdown", "text/markdown"]
      );
    });
  });
});

describe("When listing MCP resource templates", () => {
  describe("with the inlined catalog", () => {
    it("should return an empty list", () => {
      assert.deepEqual(listMcpResourceTemplates().resourceTemplates, []);
    });
  });
});

describe("When reading an MCP resource", () => {
  describe("with gitlab-mcp://docs/auth-setup", () => {
    it("should include GITLAB_PERSONAL_ACCESS_TOKEN", () => {
      assert.equal(readText(AUTH_SETUP_URI).includes("GITLAB_PERSONAL_ACCESS_TOKEN"), true);
    });

    it("should include GITLAB_USE_OAUTH", () => {
      assert.equal(readText(AUTH_SETUP_URI).includes("GITLAB_USE_OAUTH"), true);
    });

    it("should name GITLAB_OAUTH_CLIENT_ID for browser OAuth", () => {
      assert.equal(
        readText(AUTH_SETUP_URI).includes("GITLAB_USE_OAUTH and set GITLAB_OAUTH_CLIENT_ID"),
        true
      );
    });

    it("should echo the requested uri", () => {
      const content = readMcpResource(AUTH_SETUP_URI).contents[0];
      assert.ok(content);
      assert.equal(content.uri, AUTH_SETUP_URI);
    });
  });

  describe("with gitlab-mcp://docs/toolsets", () => {
    it("should include GITLAB_TOOLSETS", () => {
      assert.equal(readText(TOOLSETS_URI).includes("GITLAB_TOOLSETS"), true);
    });

    it("should say an explicit list does not merge with core", () => {
      assert.equal(readText(TOOLSETS_URI).includes("does not merge"), true);
    });

    it("should echo the requested uri", () => {
      const content = readMcpResource(TOOLSETS_URI).contents[0];
      assert.ok(content);
      assert.equal(content.uri, TOOLSETS_URI);
    });
  });

  describe("with gitlab-mcp://docs/permission-modes", () => {
    it("should include readonly", () => {
      assert.equal(readText(PERMISSION_MODES_URI).includes("readonly"), true);
    });

    it("should include modify", () => {
      assert.equal(readText(PERMISSION_MODES_URI).includes("modify"), true);
    });

    it("should include full", () => {
      assert.equal(readText(PERMISSION_MODES_URI).includes("full"), true);
    });

    it("should echo the requested uri", () => {
      const content = readMcpResource(PERMISSION_MODES_URI).contents[0];
      assert.ok(content);
      assert.equal(content.uri, PERMISSION_MODES_URI);
    });
  });

  describe("with gitlab-mcp://docs/nope", () => {
    it("should throw McpError with InvalidParams", () => {
      assert.throws(
        () => {
          readMcpResource("gitlab-mcp://docs/nope");
        },
        (error: unknown): boolean =>
          error instanceof McpError && error.code === ErrorCode.InvalidParams
      );
    });
  });
});
