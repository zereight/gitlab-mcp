import { describe, test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  assertSafeRelativePath,
  resolveSafeExistingPath,
  resolveSafeOutputDir,
  resolveSafeOutputFile,
} from "../../utils/helpers.js";

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

describe("resolveSafeExistingPath / resolveSafeOutputDir", () => {
  let base: string;

  test("setup base dir", () => {
    base = fs.mkdtempSync(path.join(os.tmpdir(), "safe-path-"));
  });

  test("resolves an existing file inside the base", () => {
    const file = path.join(base, "ok.txt");
    fs.writeFileSync(file, "hello");
    const resolved = resolveSafeExistingPath("ok.txt", "file_path", base);
    assert.strictEqual(resolved, fs.realpathSync(file));
  });

  test("rejects symlink file escape on read", () => {
    const target = path.join(os.tmpdir(), `outside-target-${process.pid}.txt`);
    fs.writeFileSync(target, "secret");
    fs.symlinkSync(target, path.join(base, "link.txt"));
    try {
      assert.throws(
        () => resolveSafeExistingPath("link.txt", "file_path", base),
        /symbolic links|escapes/
      );
    } finally {
      fs.unlinkSync(target);
    }
  });

  test("rejects symlink directory escape on write", () => {
    fs.symlinkSync(os.tmpdir(), path.join(base, "escape-dir"));
    assert.throws(
      () => resolveSafeOutputDir("escape-dir", "local_path", base),
      /symbolic links|escapes/
    );
  });

  test("creates nested output dirs that stay inside the base", () => {
    const out = resolveSafeOutputDir(path.join("artifacts", "run-1"), "local_path", base);
    const baseReal = fs.realpathSync(base);
    const rel = path.relative(baseReal, out);
    assert.ok(rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel)));
    assert.ok(fs.statSync(out).isDirectory());
  });

  test("resolveSafeOutputFile rejects destination file symlink", () => {
    const outDir = path.join(base, "out");
    fs.mkdirSync(outDir, { recursive: true });
    const target = path.join(os.tmpdir(), `outside-write-${process.pid}.txt`);
    fs.writeFileSync(target, "before");
    fs.symlinkSync(target, path.join(outDir, "payload.bin"));
    try {
      assert.throws(
        () => resolveSafeOutputFile("payload.bin", "out", "local_path", base),
        /symbolic links/
      );
    } finally {
      fs.unlinkSync(target);
    }
  });

  test("resolveSafeOutputFile returns contained path for new files", () => {
    const dest = resolveSafeOutputFile("fresh.bin", "downloads", "local_path", base);
    assert.ok(dest.startsWith(fs.realpathSync(base) + path.sep));
    assert.ok(dest.endsWith(`${path.sep}fresh.bin`));
  });

  test("cleanup base dir", () => {
    fs.rmSync(base, { recursive: true, force: true });
  });
});
