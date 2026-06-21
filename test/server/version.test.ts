import { test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import { SERVER_VERSION } from "../../server/version.js";

const packageVersion = JSON.parse(fs.readFileSync("package.json", "utf8")).version;

test("SERVER_VERSION matches package.json", () => {
  assert.strictEqual(SERVER_VERSION, packageVersion);
});
