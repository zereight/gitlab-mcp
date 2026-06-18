#!/usr/bin/env node
import { builtinModules } from "node:module";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const declared = new Set(Object.keys(packageJson.dependencies ?? {}));
const builtins = new Set([...builtinModules, ...builtinModules.map((name) => `node:${name}`)]);
const ignoredDirs = new Set([
  ".git",
  ".github",
  "build",
  "docs",
  "mcp-server",
  "node_modules",
  "scripts",
  "test",
]);

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (ignoredDirs.has(entry.name)) continue;

    const filePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(filePath));
    } else if (entry.isFile() && filePath.endsWith(".ts")) {
      files.push(filePath);
    }
  }
  return files;
}

function packageName(specifier) {
  if (specifier.startsWith(".") || specifier.startsWith("/") || builtins.has(specifier)) {
    return null;
  }

  if (specifier.startsWith("node:")) return null;

  if (specifier.startsWith("@")) {
    return specifier.split("/").slice(0, 2).join("/");
  }

  const [name] = specifier.split("/");
  return builtins.has(name) ? null : name;
}

const importPattern = /(?:import\s+(?:type\s+)?(?:[^'";]+\s+from\s+)?|export\s+(?:type\s+)?[^'";]+\s+from\s+|import\s*\()\s*["']([^"']+)["']/g;
const missing = new Map();

for (const file of walk(".")) {
  const source = readFileSync(file, "utf8");
  let match;
  while ((match = importPattern.exec(source)) !== null) {
    const pkg = packageName(match[1]);
    if (!pkg || declared.has(pkg)) continue;

    if (!missing.has(pkg)) missing.set(pkg, new Set());
    missing.get(pkg).add(file);
  }
}

if (missing.size > 0) {
  console.error("Runtime imports must be declared in package.json dependencies:");
  for (const [pkg, files] of [...missing.entries()].sort()) {
    console.error(`- ${pkg}: ${[...files].sort().join(", ")}`);
  }
  process.exit(1);
}

console.log("Runtime dependency declarations are complete.");
