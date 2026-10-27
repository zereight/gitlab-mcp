import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import {
  DEFAULT_TOOLSET_IDS,
  parseEnabledToolsets,
  parseIndividualTools,
} from "../../tools/registry.js";

function captureWarnings<T>(run: () => T): { result: T; warnings: string[] } {
  const warnings: string[] = [];
  const warn = mock.method(console, "warn", (message: unknown) => {
    warnings.push(String(message));
  });
  try {
    return { result: run(), warnings };
  } finally {
    warn.mock.restore();
  }
}

describe("When GITLAB_TOOLSETS names a toolset that does not exist", () => {
  describe("with one typo next to a valid toolset", () => {
    it("should keep the valid toolset and warn once about the typo", () => {
      const { result, warnings } = captureWarnings(() => parseEnabledToolsets("core,pipelnes"));

      assert.deepEqual([...result], ["core"]);
      assert.equal(warnings.length, 1);
      assert.match(
        warnings[0],
        /^Unknown toolset names in GITLAB_TOOLSETS \(will be ignored\): pipelnes\. /
      );
      assert.match(warnings[0], /Known toolsets: core, merge_requests, .*pipelines/);
    });
  });

  describe("with the same unknown name repeated", () => {
    it("should name it once", () => {
      const { warnings } = captureWarnings(() => parseEnabledToolsets("default,core,default"));

      assert.equal(warnings.length, 1);
      assert.match(warnings[0], /\(will be ignored\): default\. /);
    });
  });

  describe("with all combined with another toolset", () => {
    it("should keep the current selection and explain that all works on its own", () => {
      const { result, warnings } = captureWarnings(() => parseEnabledToolsets("all,api"));

      assert.deepEqual([...result], ["api"]);
      assert.equal(warnings.length, 1);
      assert.match(warnings[0], /\(will be ignored\): all\. "all" only works on its own/);
    });
  });

  describe("with no valid toolset at all", () => {
    it("should fall back to the defaults with one warning that lists known toolsets", () => {
      const { result, warnings } = captureWarnings(() => parseEnabledToolsets("pipelnes"));

      assert.equal(result, DEFAULT_TOOLSET_IDS);
      assert.equal(warnings.length, 1);
      assert.match(
        warnings[0],
        /^No valid toolsets found in configuration \(pipelnes\)\. Falling back to default toolsets\. Known toolsets: core, /
      );
    });
  });
});

describe("When the same settings are parsed again in one process", () => {
  describe("with an unknown toolset and an unknown tool name", () => {
    it("should not repeat either warning", () => {
      const { warnings } = captureWarnings(() => {
        parseEnabledToolsets("core,wikki");
        parseEnabledToolsets("core,wikki");
        parseIndividualTools("get_projekt");
        parseIndividualTools("get_projekt");
      });

      assert.equal(warnings.length, 2);
      assert.match(warnings[0], /\(will be ignored\): wikki\. /);
      assert.equal(
        warnings[1],
        "Unknown tool names in GITLAB_TOOLS (will be ignored): get_projekt"
      );
    });
  });
});

describe("When GITLAB_TOOLSETS names only known toolsets", () => {
  for (const raw of ["core,pipelines", " Core , PIPELINES ,", "all", ""]) {
    describe(`with ${JSON.stringify(raw)}`, () => {
      it("should not warn", () => {
        const { warnings } = captureWarnings(() => parseEnabledToolsets(raw));

        assert.deepEqual(warnings, []);
      });
    });
  }
});
