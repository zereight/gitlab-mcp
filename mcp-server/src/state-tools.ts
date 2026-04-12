import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as fs from "node:fs";
import * as path from "node:path";
import { getWorkspaceRoot, ensureDir, validateMode, safeReadFile, safeWriteFile, safeJsonParse, errorResponse } from "./utils.js";

export function getStateDir(): string {
  return path.join(getWorkspaceRoot(), ".omc", "state");
}

export function getStatePath(mode: string): string {
  validateMode(mode);
  return path.join(getStateDir(), `${mode}-state.json`);
}

export function registerStateTools(server: McpServer): void {
  server.tool(
    "omg_read_state",
    "Read the current state for a given OMG mode (omg-autopilot, ralph, ultrawork, ultraqa, team, self-improve)",
    {
      mode: z.string().describe("The mode to read state for (e.g., omg-autopilot, ralph, team)"),
    },
    async ({ mode }) => {
      try {
        const statePath = getStatePath(mode);
        const data = safeReadFile(statePath);
        if (!data) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({ active: false, mode, message: "No state found" }),
              },
            ],
          };
        }
        return {
          content: [{ type: "text" as const, text: data }],
        };
      } catch (err) {
        return errorResponse((err as Error).message);
      }
    }
  );

  server.tool(
    "omg_write_state",
    "Write or update state for a given OMG mode. Merges with existing state.",
    {
      mode: z.string().describe("The mode to write state for"),
      state: z.string().describe("JSON string of state to write/merge"),
    },
    async ({ mode, state }) => {
      try {
        const stateDir = getStateDir();
        ensureDir(stateDir);
        const statePath = getStatePath(mode);

        let existing: Record<string, unknown> = {};
        const existingData = safeReadFile(statePath);
        if (existingData) {
          const existingParsed = safeJsonParse(existingData);
          if (existingParsed.ok) {
            existing = existingParsed.data;
          }
          // Corrupted or polluted state — overwrite
        }

        const parsed = safeJsonParse(state);
        if (!parsed.ok) {
          return errorResponse(parsed.error);
        }

        const newState = { ...existing, ...parsed.data, updated_at: new Date().toISOString() };
        safeWriteFile(statePath, JSON.stringify(newState, null, 2));

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ success: true, mode, state: newState }),
            },
          ],
        };
      } catch (err) {
        return errorResponse((err as Error).message);
      }
    }
  );

  server.tool(
    "omg_clear_state",
    "Clear state for a given OMG mode or all modes",
    {
      mode: z
        .string()
        .optional()
        .describe("Mode to clear. Omit to clear all modes."),
    },
    async ({ mode }) => {
      try {
        const stateDir = getStateDir();
        if (!fs.existsSync(stateDir)) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ success: true, message: "No state directory" }) }],
          };
        }

        if (mode) {
          const statePath = getStatePath(mode);
          if (fs.existsSync(statePath)) {
            fs.unlinkSync(statePath);
          }
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ success: true, cleared: mode }) }],
          };
        }

        // Clear all state files
        const files = fs.readdirSync(stateDir).filter((f) => f.endsWith("-state.json"));
        for (const file of files) {
          fs.unlinkSync(path.join(stateDir, file));
        }
        return {
          content: [
            { type: "text" as const, text: JSON.stringify({ success: true, cleared: "all", files: files.length }) },
          ],
        };
      } catch (err) {
        return errorResponse((err as Error).message);
      }
    }
  );

  server.tool(
    "omg_list_active",
    "List all currently active OMG modes",
    {},
    async () => {
      const stateDir = getStateDir();
      if (!fs.existsSync(stateDir)) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ active_modes: [] }) }],
        };
      }

      const files = fs.readdirSync(stateDir).filter((f) => f.endsWith("-state.json"));
      const activeModes: Array<{ mode: string; phase?: string; updated_at?: string }> = [];

      for (const file of files) {
        try {
          const raw = safeReadFile(path.join(stateDir, file));
          if (!raw) continue;
          const parsed = safeJsonParse(raw);
          if (!parsed.ok) continue;
          const data = parsed.data;
          if (data.active) {
            activeModes.push({
              mode: file.replace("-state.json", ""),
              phase: String(data.current_phase || data.phase || "") || undefined,
              updated_at: typeof data.updated_at === "string" ? data.updated_at : undefined,
            });
          }
        } catch {
          // Skip corrupted files
        }
      }

      return {
        content: [{ type: "text" as const, text: JSON.stringify({ active_modes: activeModes }) }],
      };
    }
  );
}
