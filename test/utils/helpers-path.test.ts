import { describe, test } from "node:test";
import assert from "node:assert";
import path from "node:path";
import { assertSafeRelativePath } from "../../utils/helpers.js";

describe("assertSafeRelativePath", () => {
  test("allows relative paths", () => {
    assert.strictEqual(assertSafeRelativePath("uploads"), "uploads");
    assert.strictEqual(assertSafeRelativePath("uploads/nested"), path.normalize("uploads/nested"));
  });

  test("rejects absolute paths", () => {
    assert.throws(() => assertSafeRelativePath("/etc/passwd", "file_path"), /traversal/);
  });

  test("rejects parent-directory traversal", () => {
    assert.throws(() => assertSafeRelativePath("../../../tmp", "local_path"), /traversal/);
    assert.throws(() => assertSafeRelativePath("foo/../../etc", "local_path"), /traversal/);
  });
});
