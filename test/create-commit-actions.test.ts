import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FileOperationSchema } from "../schemas.js";
import {
  fileOperationsIncludeDeleteOrMove,
  toGitLabCommitActions,
} from "../utils/gitlab-commit-actions.js";

function firstAction(actions: ReturnType<typeof toGitLabCommitActions>) {
  const entry = actions[0];
  if (!entry) {
    throw new Error("expected at least one commit action");
  }
  return entry;
}

describe("When mapping file operations to GitLab commit actions", () => {
  describe("with a plain text file and no per-file encoding", () => {
    it("should default the action to create", () => {
      const entry = firstAction(toGitLabCommitActions([{ path: "a.txt", content: "hi" }], "text"));
      assert.equal(entry.action, "create");
    });

    it("should keep the content unchanged when the global encoding is text", () => {
      const entry = firstAction(toGitLabCommitActions([{ path: "a.txt", content: "hi" }], "text"));
      assert.equal(entry.content, "hi");
    });

    it("should set encoding to the global text value", () => {
      const entry = firstAction(toGitLabCommitActions([{ path: "a.txt", content: "hi" }], "text"));
      assert.equal(entry.encoding, "text");
    });
  });

  describe("with a plain text file and global base64 encoding", () => {
    it("should base64-encode the content", () => {
      const entry = firstAction(toGitLabCommitActions([{ path: "a.txt", content: "hi" }], "base64"));
      assert.equal(entry.content, Buffer.from("hi").toString("base64"));
    });

    it("should set encoding to base64", () => {
      const entry = firstAction(toGitLabCommitActions([{ path: "a.txt", content: "hi" }], "base64"));
      assert.equal(entry.encoding, "base64");
    });
  });

  describe("with an explicit per-file encoding", () => {
    it("should pass text content through when encoding is text even if global is base64", () => {
      const entry = firstAction(
        toGitLabCommitActions([{ path: "a.txt", content: "hi", encoding: "text" }], "base64")
      );
      assert.equal(entry.content, "hi");
    });

    it("should keep the explicit text encoding on the payload", () => {
      const entry = firstAction(
        toGitLabCommitActions([{ path: "a.txt", content: "hi", encoding: "text" }], "base64")
      );
      assert.equal(entry.encoding, "text");
    });

    it("should pass base64 content through without encoding it again", () => {
      const entry = firstAction(
        toGitLabCommitActions([{ path: "logo.png", content: "aGk=", encoding: "base64" }], "text")
      );
      assert.equal(entry.content, "aGk=");
    });
  });

  describe("with action delete", () => {
    it("should omit content from the payload", () => {
      const entry = firstAction(toGitLabCommitActions([{ path: "a.txt", action: "delete" }], "text"));
      assert.equal("content" in entry, false);
    });

    it("should omit encoding from the payload", () => {
      const entry = firstAction(toGitLabCommitActions([{ path: "a.txt", action: "delete" }], "text"));
      assert.equal("encoding" in entry, false);
    });
  });

  describe("with action move", () => {
    it("should omit content when the move has no new content", () => {
      const entry = firstAction(
        toGitLabCommitActions([{ path: "b.txt", action: "move", previous_path: "a.txt" }], "text")
      );
      assert.equal("content" in entry, false);
    });

    it("should include previous_path", () => {
      const entry = firstAction(
        toGitLabCommitActions([{ path: "b.txt", action: "move", previous_path: "a.txt" }], "text")
      );
      assert.equal(entry.previous_path, "a.txt");
    });

    it("should include content when a move supplies replacement content", () => {
      const entry = firstAction(
        toGitLabCommitActions(
          [{ path: "b.txt", action: "move", previous_path: "a.txt", content: "new" }],
          "text"
        )
      );
      assert.equal(entry.content, "new");
    });
  });

  describe("with create or update missing content", () => {
    it("should reject a create without content before sending an empty file", () => {
      assert.throws(
        () => toGitLabCommitActions([{ path: "a.txt" }], "text"),
        /content is required when action is 'create'/
      );
    });

    it("should reject the FileOperation schema for create without content", () => {
      const parsed = FileOperationSchema.safeParse({ path: "a.txt" });
      assert.equal(parsed.success, false);
    });
  });
});

describe("When checking push_files actions against modify mode", () => {
  describe("with delete or move entries", () => {
    it("should treat delete as blocked", () => {
      assert.equal(fileOperationsIncludeDeleteOrMove([{ action: "delete" }]), true);
    });

    it("should treat move as blocked", () => {
      assert.equal(fileOperationsIncludeDeleteOrMove([{ action: "move" }]), true);
    });
  });

  describe("with create or update entries", () => {
    it("should allow omitted action", () => {
      assert.equal(fileOperationsIncludeDeleteOrMove([{}]), false);
    });

    it("should allow update", () => {
      assert.equal(fileOperationsIncludeDeleteOrMove([{ action: "update" }]), false);
    });
  });
});
