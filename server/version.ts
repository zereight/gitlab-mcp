import fs from "node:fs";
import path, { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const packageJsonPaths = [
  // Source file under tsx/node:test: server/version.ts -> ../package.json
  path.resolve(__dirname, "../package.json"),
  // Built file: build/server/version.js -> ../../package.json
  path.resolve(__dirname, "../../package.json"),
];

export const SERVER_VERSION: string = (() => {
  for (const packageJsonPath of packageJsonPaths) {
    try {
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
        const version = packageJson.version;
        if (typeof version === "string" && version.length > 0) {
          return version;
        }
      }
    } catch {
      // Intentionally ignored: version read failure is non-critical.
    }
  }
  return "unknown";
})();
