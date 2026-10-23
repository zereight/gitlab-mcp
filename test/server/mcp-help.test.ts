import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  HELP_TOPICS,
  formatUnknownHelpTopic,
  getWorkflowGuide,
  readHelpTopic,
} from "../../server/mcp-help.js";

describe("When the help workflow guide is requested", () => {
  describe("with no topic", () => {
    it("should return the overview and the topic list", () => {
      const guide = getWorkflowGuide();

      assert.match(guide, /workflow guide/i);
      assert.match(guide, /code-review/);
      assert.match(guide, /discover_tools/);
    });
  });

  describe("with each published topic", () => {
    it("should return a non-empty guide that names a real tool", () => {
      for (const topic of HELP_TOPICS) {
        const guide = getWorkflowGuide(topic);
        assert.ok(guide.length > 40, `${topic} guide is too short`);
        assert.match(guide, /[a-z]+_[a-z_]+/);
      }
    });
  });

  describe("with code-review", () => {
    it("should describe the two-step diff workflow", () => {
      const guide = getWorkflowGuide("code-review");

      assert.match(guide, /list_merge_request_changed_files/);
      assert.match(guide, /get_merge_request_file_diff/);
      assert.match(guide, /Do not dump get_merge_request_diffs/);
    });
  });

  describe("with token-saving", () => {
    it("should prefer jmespath, compact results, and paginated logs", () => {
      const guide = getWorkflowGuide("token-saving");

      assert.match(guide, /jmespath/);
      assert.match(guide, /GITLAB_MCP_COMPACT_RESULTS/);
      assert.match(guide, /get_pipeline_job_output/);
    });
  });

  describe("with an unknown topic argument", () => {
    it("should report the available topics", () => {
      assert.equal(readHelpTopic("not-a-topic"), "invalid");
      assert.match(formatUnknownHelpTopic("not-a-topic"), /code-review/);
    });
  });
});
