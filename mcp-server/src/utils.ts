import * as fs from "node:fs";
import * as path from "node:path";
import { randomUUID } from "node:crypto";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

export function getWorkspaceRoot(): string {
  return path.resolve(process.env.WORKSPACE_ROOT || process.cwd());
}

export function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function validateMode(mode: string): void {
  if (!/^[a-zA-Z0-9_-]+$/.test(mode)) {
    throw new Error(`Invalid mode name: "${mode}". Only alphanumeric, hyphens, and underscores allowed.`);
  }
}

export function safeReadFile(filePath: string): string | null {
  try {
    const stat = fs.lstatSync(filePath);
    if (stat.isSymbolicLink()) return null;
    if (stat.size > MAX_FILE_SIZE) return null;
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}

export function safeWriteFile(filePath: string, data: string): void {
  try {
    const stat = fs.lstatSync(filePath);
    if (stat.isSymbolicLink()) {
      throw new Error("Refusing to write to symlink");
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    // File doesn't exist yet — safe to create
  }
  fs.writeFileSync(filePath, data);
}

export function safeJsonParse(input: string): { ok: true; data: Record<string, unknown> } | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(input);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return { ok: false, error: "Expected a JSON object" };
    }
    // Strip prototype pollution keys
    const clean: Record<string, unknown> = {};
    for (const key of Object.keys(parsed)) {
      if (key === "__proto__" || key === "constructor" || key === "prototype") continue;
      clean[key] = parsed[key];
    }
    return { ok: true, data: clean };
  } catch {
    return { ok: false, error: "Invalid JSON" };
  }
}

export function generateId(): string {
  return randomUUID().slice(0, 8);
}

export function errorResponse(message: string) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify({ success: false, error: message }) }],
  };
}
