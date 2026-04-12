import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as path from "node:path";
import { getWorkspaceRoot, ensureDir, safeReadFile, safeWriteFile, safeJsonParse, errorResponse } from "./utils.js";

const MAX_ENTRIES = 500;
const MAX_VALUE_LENGTH = 10_000;

function getMemoryPath(): string {
  return path.join(getWorkspaceRoot(), ".omc", "project-memory.json");
}

interface MemoryEntry {
  key: string;
  value: string;
  category: string;
  created_at: string;
  updated_at: string;
}

interface MemoryStore {
  entries: MemoryEntry[];
}

function readMemory(): MemoryStore {
  const memPath = getMemoryPath();
  const data = safeReadFile(memPath);
  if (!data) return { entries: [] };
  const result = safeJsonParse(data);
  if (!result.ok) return { entries: [] };
  return result.data as unknown as MemoryStore;
}

function writeMemory(store: MemoryStore): void {
  const memPath = getMemoryPath();
  ensureDir(path.dirname(memPath));
  safeWriteFile(memPath, JSON.stringify(store, null, 2));
}

export function registerMemoryTools(server: McpServer): void {
  server.tool(
    "omg_read_memory",
    "Read project memory entries. Optionally filter by category or key.",
    {
      category: z.string().optional().describe("Filter by category (e.g., project, user, feedback, reference)"),
      key: z.string().optional().describe("Filter by specific key"),
    },
    async ({ category, key }) => {
      const store = readMemory();
      let entries = store.entries;

      if (category) {
        entries = entries.filter((e) => e.category === category);
      }
      if (key) {
        entries = entries.filter((e) => e.key === key);
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              total: entries.length,
              entries: entries.map((e) => ({
                key: e.key,
                value: e.value,
                category: e.category,
                updated_at: e.updated_at,
              })),
            }),
          },
        ],
      };
    }
  );

  server.tool(
    "omg_write_memory",
    "Write or update a project memory entry",
    {
      key: z.string().describe("Unique key for this memory entry"),
      value: z.string().describe("The memory content"),
      category: z
        .string()
        .default("project")
        .describe("Category: project, user, feedback, reference"),
    },
    async ({ key, value, category }) => {
      if (value.length > MAX_VALUE_LENGTH) {
        return errorResponse(`Value exceeds maximum length of ${MAX_VALUE_LENGTH} characters`);
      }

      const store = readMemory();
      const existing = store.entries.findIndex((e) => e.key === key);
      const now = new Date().toISOString();

      if (existing < 0 && store.entries.length >= MAX_ENTRIES) {
        return errorResponse(`Memory store full (max ${MAX_ENTRIES} entries)`);
      }

      if (existing >= 0) {
        store.entries[existing].value = value;
        store.entries[existing].category = category;
        store.entries[existing].updated_at = now;
      } else {
        store.entries.push({
          key,
          value,
          category,
          created_at: now,
          updated_at: now,
        });
      }

      writeMemory(store);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              key,
              action: existing >= 0 ? "updated" : "created",
            }),
          },
        ],
      };
    }
  );

  server.tool(
    "omg_delete_memory",
    "Delete a project memory entry by key",
    {
      key: z.string().describe("Key of the memory entry to delete"),
    },
    async ({ key }) => {
      const store = readMemory();
      const before = store.entries.length;
      store.entries = store.entries.filter((e) => e.key !== key);
      const deleted = before - store.entries.length > 0;
      if (deleted) {
        writeMemory(store);
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              deleted,
              key,
            }),
          },
        ],
      };
    }
  );
}
