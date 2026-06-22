import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { resolveNestedWikiUpdateTitle } from "../../utils/wiki-title.js";

describe("When resolveNestedWikiUpdateTitle runs", () => {
  describe("with nested wiki slugs", () => {
    test("should prefix leaf titles using the existing hierarchical title", () => {
      assert.equal(
        resolveNestedWikiUpdateTitle(
          "00-map/infra-servers",
          "infra servers v2",
          "00-map/infra servers"
        ),
        "00-map/infra servers v2"
      );
    });

    test("should prefix leaf titles using the slug parent when the existing title is flat", () => {
      assert.equal(
        resolveNestedWikiUpdateTitle("00-map/infra-servers", "infra servers v2", "infra servers"),
        "00-map/infra servers v2"
      );
    });

    test("should keep full hierarchical titles unchanged", () => {
      assert.equal(
        resolveNestedWikiUpdateTitle(
          "00-map/infra-servers",
          "00-map/infra servers v2",
          "00-map/infra servers"
        ),
        "00-map/infra servers v2"
      );
    });
  });

  describe("with flat wiki slugs", () => {
    test("should keep leaf titles unchanged", () => {
      assert.equal(
        resolveNestedWikiUpdateTitle("infra-servers", "infra servers v2", "infra servers"),
        "infra servers v2"
      );
    });
  });
});
