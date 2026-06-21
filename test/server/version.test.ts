import { test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path, { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { SERVER_VERSION } from "../../server/version.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJsonPath = path.resolve(__dirname, "../../package.json");
const packageVersion = JSON.parse(fs.readFileSync(packageJsonPath, "utf8")).version;

test("SERVER_VERSION matches package.json", () => {
  assert.strictEqual(SERVER_VERSION, packageVersion);
});
