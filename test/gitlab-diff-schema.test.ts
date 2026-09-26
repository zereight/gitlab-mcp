import assert from "node:assert/strict";
import { test } from "node:test";
import { GitLabDiffSchema } from "../schemas.js";

test("diff schema keeps GitLab's generated_file, too_large and collapsed flags", () => {
  const parsed = GitLabDiffSchema.parse({
    diff: "@@ -1 +1 @@",
    new_path: "src/Foo.php",
    old_path: "src/Foo.php",
    a_mode: "100644",
    b_mode: "100644",
    new_file: false,
    renamed_file: false,
    deleted_file: false,
    generated_file: true,
    too_large: true,
    collapsed: false,
  });

  assert.equal(parsed.generated_file, true);
  assert.equal(parsed.too_large, true);
  assert.equal(parsed.collapsed, false);
});

test("diff schema still parses entries without the optional flags", () => {
  const parsed = GitLabDiffSchema.parse({
    diff: "@@ -1 +1 @@",
    new_path: "src/Foo.php",
    old_path: "src/Foo.php",
    a_mode: "100644",
    b_mode: "100644",
    new_file: false,
    renamed_file: false,
    deleted_file: false,
  });

  assert.equal("generated_file" in parsed, false);
  assert.equal("too_large" in parsed, false);
  assert.equal("collapsed" in parsed, false);
});
