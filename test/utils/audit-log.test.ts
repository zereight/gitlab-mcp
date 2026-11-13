import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AUDIT_EVENT_TYPE,
  AUDIT_FIELD_ALLOWLIST,
  buildAuditRecord,
  classifyAuditFailure,
  createToolCallAuditor,
  extractAuditResourceIds,
  readKnownGitLabUserId,
  readKnownGitLabUsername,
  recordToolCallAudit,
  resetAuditLogWriteWarningForTests,
  resolveAuditAuthMethod,
  sanitizeAuditSessionId,
  type ToolCallAuditFields,
} from "../../utils/audit-log.js";

const SECRET_TOKEN = "glpat-should-never-appear-in-audit";
const SECRET_BODY = "confidential-issue-body-do-not-log";
const FIXED_NOW = new Date("2026-11-13T12:00:00.000Z");
const ALLOWLISTED_FIELDS = new Set<string>(AUDIT_FIELD_ALLOWLIST);

function isAllowlistedField(key: string): boolean {
  return ALLOWLISTED_FIELDS.has(key);
}

function baseFields(overrides: Partial<ToolCallAuditFields> = {}): ToolCallAuditFields {
  return {
    timestamp: FIXED_NOW.toISOString(),
    transport: "stdio",
    tool: "get_project",
    outcome: "success",
    durationMs: 12,
    ...overrides,
  };
}

function stringifyRecord(fields: Partial<ToolCallAuditFields> = {}): string {
  return JSON.stringify(buildAuditRecord(baseFields(fields)));
}

describe("When building an audit record", () => {
  describe("with a successful tool call", () => {
    it("should emit only the allowlisted SIEM fields", () => {
      const record = buildAuditRecord(
        baseFields({
          sessionId: "sess-1",
          authMethod: "pat",
          gitlabUserId: 42,
          gitlabUsername: "alice",
          projectId: "group/project",
          groupId: "10",
        })
      );

      assert.deepEqual(record, {
        timestamp: "2026-11-13T12:00:00.000Z",
        event: AUDIT_EVENT_TYPE,
        transport: "stdio",
        sessionId: "sess-1",
        authMethod: "pat",
        gitlabUserId: 42,
        gitlabUsername: "alice",
        tool: "get_project",
        projectId: "group/project",
        groupId: "10",
        outcome: "success",
        durationMs: 12,
      });
      for (const key of Object.keys(record)) {
        assert.equal(isAllowlistedField(key), true, `unexpected field ${key}`);
      }
    });
  });

  describe("with optional identity and resource fields omitted", () => {
    it("should drop undefined allowlisted keys", () => {
      const record = buildAuditRecord(baseFields());

      assert.equal("sessionId" in record, false);
      assert.equal("authMethod" in record, false);
      assert.equal("gitlabUserId" in record, false);
      assert.equal("gitlabUsername" in record, false);
      assert.equal("projectId" in record, false);
      assert.equal("groupId" in record, false);
      assert.equal("errorClass" in record, false);
      assert.equal("httpStatus" in record, false);
      assert.equal(record.event, "tool_call");
      assert.equal(record.outcome, "success");
    });
  });

  describe("with a failing GitLab API call", () => {
    it("should include error class and HTTP status without a message", () => {
      const record = buildAuditRecord(
        baseFields({
          outcome: "error",
          errorClass: "GitLabApiError",
          httpStatus: 404,
        })
      );

      assert.equal(record.outcome, "error");
      assert.equal(record.errorClass, "GitLabApiError");
      assert.equal(record.httpStatus, 404);
      assert.equal(JSON.stringify(record).includes("Not Found"), false);
    });
  });
});

describe("When extracting resource ids from tool arguments", () => {
  describe("with project_id and group_id present", () => {
    it("should copy only those scalar ids", () => {
      const ids = extractAuditResourceIds({
        project_id: "group/project",
        group_id: 99,
        token: SECRET_TOKEN,
        body: SECRET_BODY,
        title: "secret title",
      });

      assert.deepEqual(ids, { projectId: "group/project", groupId: "99" });
    });
  });

  describe("with a token and body in the arguments", () => {
    it("should never copy those values onto the audit record", () => {
      const line = stringifyRecord({
        projectId: extractAuditResourceIds({
          project_id: "1",
          token: SECRET_TOKEN,
          body: SECRET_BODY,
        }).projectId,
      });

      assert.equal(line.includes(SECRET_TOKEN), false);
      assert.equal(line.includes(SECRET_BODY), false);
      assert.equal(line.includes("token"), false);
      assert.equal(line.includes("body"), false);
    });
  });

  describe("with non-scalar project_id", () => {
    it("should omit the field instead of stringifying the object", () => {
      assert.deepEqual(
        extractAuditResourceIds({
          project_id: { path: "group/project", token: SECRET_TOKEN },
          group_id: ["10", SECRET_TOKEN],
        }),
        {}
      );
    });
  });

  describe("with inherited keys on the prototype", () => {
    it("should ignore them", () => {
      const args = Object.create({ project_id: "inherited", group_id: "nope" });
      args.title = "ok";
      assert.deepEqual(extractAuditResourceIds(args), {});
    });
  });
});

describe("When classifying a tool-call failure", () => {
  describe("with a GitLabApiError-shaped error", () => {
    it("should keep the class name and HTTP status", () => {
      const error = new Error("GitLab API error: 403 Forbidden\nsecret body");
      error.name = "GitLabApiError";
      Object.assign(error, { status: 403 });

      assert.deepEqual(classifyAuditFailure(error), {
        errorClass: "GitLabApiError",
        httpStatus: 403,
      });
    });
  });

  describe("with no thrown error", () => {
    it("should use ToolError without an HTTP status", () => {
      assert.deepEqual(classifyAuditFailure(undefined), { errorClass: "ToolError" });
    });
  });

  describe("with a free-text name", () => {
    it("should fall back to Error instead of logging the message as a class", () => {
      const error = new Error("leaked token " + SECRET_TOKEN);
      error.name = "boom " + SECRET_TOKEN;
      assert.deepEqual(classifyAuditFailure(error), { errorClass: "Error" });
    });
  });
});

describe("When resolving the audit auth method", () => {
  describe("with MCP OAuth enabled", () => {
    it("should report oauth even when a PAT is also configured", () => {
      assert.equal(
        resolveAuditAuthMethod({
          remoteAuthorization: false,
          mcpOAuth: true,
          useOAuth: false,
          hasPat: true,
          hasJobToken: true,
          hasCookie: true,
        }),
        "oauth"
      );
    });
  });

  describe("with remote authorization", () => {
    it("should report remote-header", () => {
      assert.equal(
        resolveAuditAuthMethod({
          remoteAuthorization: true,
          mcpOAuth: false,
          useOAuth: false,
          hasPat: false,
          hasJobToken: false,
          hasCookie: false,
        }),
        "remote-header"
      );
    });
  });

  describe("with a personal access token", () => {
    it("should report pat ahead of a job token", () => {
      assert.equal(
        resolveAuditAuthMethod({
          remoteAuthorization: false,
          mcpOAuth: false,
          useOAuth: false,
          hasPat: true,
          hasJobToken: true,
          hasCookie: true,
        }),
        "pat"
      );
    });
  });

  describe("with only a cookie file", () => {
    it("should report cookie", () => {
      assert.equal(
        resolveAuditAuthMethod({
          remoteAuthorization: false,
          mcpOAuth: false,
          useOAuth: false,
          hasPat: false,
          hasJobToken: false,
          hasCookie: true,
        }),
        "cookie"
      );
    });
  });
});

describe("When sanitizing a session id", () => {
  describe("with a sealed stateless sid", () => {
    it("should redact the ciphertext", () => {
      assert.equal(sanitizeAuditSessionId("v1.sid.ciphertext-secret"), "v1.sid.<redacted>");
    });
  });

  describe("with a UUID session id", () => {
    it("should keep it for correlation", () => {
      assert.equal(
        sanitizeAuditSessionId("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"),
        "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
      );
    });
  });
});

describe("When reading a known GitLab identity", () => {
  describe("with a resourceOwnerId already on the auth extra", () => {
    it("should return the numeric id and ignore tokens", () => {
      assert.equal(
        readKnownGitLabUserId({
          resourceOwnerId: 7,
          token: SECRET_TOKEN,
        }),
        7
      );
      assert.equal(readKnownGitLabUsername({ username: "alice", token: SECRET_TOKEN }), "alice");
    });
  });

  describe("with no cached identity", () => {
    it("should omit rather than invent a user", () => {
      assert.equal(readKnownGitLabUserId(undefined), undefined);
      assert.equal(readKnownGitLabUsername({ token: SECRET_TOKEN }), undefined);
    });
  });
});

describe("When recording a tool-call audit line", () => {
  describe("with audit logging disabled", () => {
    it("should write nothing", () => {
      const lines: string[] = [];
      recordToolCallAudit(
        {
          toolName: "get_project",
          args: { project_id: "1", token: SECRET_TOKEN, body: SECRET_BODY },
          outcome: "success",
          startedAtMs: FIXED_NOW.getTime() - 8,
        },
        {
          enabled: false,
          now: () => FIXED_NOW,
          writeLine: line => {
            lines.push(line);
          },
        }
      );

      assert.deepEqual(lines, []);
    });
  });

  describe("with a token and body in the arguments", () => {
    it("should write one allowlisted JSON line that does not contain them", () => {
      const lines: string[] = [];
      recordToolCallAudit(
        {
          toolName: "create_issue",
          sessionId: "session-123",
          args: {
            project_id: "42",
            group_id: "group/sub",
            token: SECRET_TOKEN,
            body: SECRET_BODY,
            title: SECRET_BODY,
          },
          gitlabUserId: 9,
          outcome: "success",
          startedAtMs: FIXED_NOW.getTime() - 15,
        },
        {
          enabled: true,
          now: () => FIXED_NOW,
          writeLine: line => {
            lines.push(line);
          },
        }
      );

      assert.equal(lines.length, 1);
      const parsed: unknown = JSON.parse(lines[0]);
      assert.ok(parsed !== null && typeof parsed === "object" && !Array.isArray(parsed));
      const record = parsed;
      for (const key of Object.keys(record)) {
        assert.equal(isAllowlistedField(key), true);
      }
      assert.equal(lines[0].includes(SECRET_TOKEN), false);
      assert.equal(lines[0].includes(SECRET_BODY), false);
      assert.equal(lines[0].includes("title"), false);
      assert.equal("token" in record, false);
      assert.equal("body" in record, false);
      assert.equal("args" in record, false);
      assert.equal(Reflect.get(record, "projectId"), "42");
      assert.equal(Reflect.get(record, "groupId"), "group/sub");
      assert.equal(Reflect.get(record, "tool"), "create_issue");
      assert.equal(Reflect.get(record, "outcome"), "success");
      assert.equal(Reflect.get(record, "event"), "tool_call");
      assert.equal(Reflect.get(record, "timestamp"), "2026-11-13T12:00:00.000Z");
      assert.equal(Reflect.get(record, "durationMs"), 15);
    });
  });

  describe("with a writer that throws", () => {
    it("should warn once and not throw to the caller", () => {
      resetAuditLogWriteWarningForTests();
      const warnings: unknown[] = [];
      const boom = new Error("disk full");

      recordToolCallAudit(
        {
          toolName: "get_project",
          outcome: "success",
          startedAtMs: FIXED_NOW.getTime(),
        },
        {
          enabled: true,
          now: () => FIXED_NOW,
          writeLine: () => {
            throw boom;
          },
          warn: error => {
            warnings.push(error);
          },
        }
      );
      recordToolCallAudit(
        {
          toolName: "get_project",
          outcome: "error",
          error: new Error("ignored"),
          startedAtMs: FIXED_NOW.getTime(),
        },
        {
          enabled: true,
          now: () => FIXED_NOW,
          writeLine: () => {
            throw boom;
          },
          warn: error => {
            warnings.push(error);
          },
        }
      );

      assert.deepEqual(warnings, [boom]);
    });
  });

  describe("with GITLAB_AUDIT_LOG_FILE pointing at stdout", () => {
    it("should refuse to write and warn instead of using stdout", () => {
      resetAuditLogWriteWarningForTests();
      const warnings: unknown[] = [];

      assert.doesNotThrow(() => {
        recordToolCallAudit(
          {
            toolName: "get_project",
            outcome: "success",
            startedAtMs: FIXED_NOW.getTime(),
          },
          {
            enabled: true,
            filePath: "/dev/stdout",
            now: () => FIXED_NOW,
            warn: error => {
              warnings.push(error);
            },
          }
        );
      });

      assert.equal(warnings.length, 1);
    });
  });
});

describe("When creating a tool-call auditor", () => {
  describe("with a success result then an error", () => {
    it("should write a single success line", () => {
      const lines: string[] = [];
      const auditor = createToolCallAuditor(
        {
          toolName: "get_project",
          args: { project_id: "1", token: SECRET_TOKEN },
          startedAtMs: FIXED_NOW.getTime() - 3,
        },
        {
          enabled: true,
          now: () => FIXED_NOW,
          writeLine: line => {
            lines.push(line);
          },
        }
      );

      auditor.recordResult({ content: [{ type: "text", text: SECRET_BODY }] });
      auditor.recordError(new Error(SECRET_TOKEN));

      assert.equal(lines.length, 1);
      const parsed: unknown = JSON.parse(lines[0]);
      assert.ok(parsed !== null && typeof parsed === "object");
      assert.equal(Reflect.get(parsed, "outcome"), "success");
      assert.equal(lines[0].includes(SECRET_TOKEN), false);
      assert.equal(lines[0].includes(SECRET_BODY), false);
    });
  });

  describe("with an isError tool result", () => {
    it("should record outcome error as ToolError", () => {
      const lines: string[] = [];
      const auditor = createToolCallAuditor(
        {
          toolName: "help",
          startedAtMs: FIXED_NOW.getTime(),
        },
        {
          enabled: true,
          now: () => FIXED_NOW,
          writeLine: line => {
            lines.push(line);
          },
        }
      );

      auditor.recordResult({
        isError: true,
        content: [{ type: "text", text: SECRET_BODY }],
      });

      assert.equal(lines.length, 1);
      const parsed: unknown = JSON.parse(lines[0]);
      assert.ok(parsed !== null && typeof parsed === "object");
      assert.equal(Reflect.get(parsed, "outcome"), "error");
      assert.equal(Reflect.get(parsed, "errorClass"), "ToolError");
      assert.equal(lines[0].includes(SECRET_BODY), false);
    });
  });
});
