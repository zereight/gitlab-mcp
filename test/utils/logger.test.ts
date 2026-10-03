import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createLogger } from "../../utils/logger.js";

function withLogFormat(format: string | undefined, run: () => void): void {
  const previous = process.env.LOG_FORMAT;
  if (format === undefined) {
    delete process.env.LOG_FORMAT;
  } else {
    process.env.LOG_FORMAT = format;
  }
  try {
    run();
  } finally {
    if (previous === undefined) {
      delete process.env.LOG_FORMAT;
    } else {
      process.env.LOG_FORMAT = previous;
    }
  }
}

describe("When createLogger builds a logger", () => {
  describe("with LOG_FORMAT=json", () => {
    it("should construct a logger", () => {
      withLogFormat("json", () => {
        const logger = createLogger("json-test");
        assert.equal(typeof logger.info, "function");
      });
    });
  });

  describe("with LOG_FORMAT unset", () => {
    it("should construct a pretty logger", () => {
      withLogFormat(undefined, () => {
        const logger = createLogger("pretty-test");
        assert.equal(typeof logger.info, "function");
      });
    });
  });
});
