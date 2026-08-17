import fs from "node:fs";
import path from "node:path";
import { allTools } from "../tools/registry.js";

async function main() {
  const pkgPath = path.resolve(process.cwd(), "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));

  const serverCard = {
    serverInfo: {
      name: pkg.mcpName || pkg.name,
      version: pkg.version,
    },
    authentication: {
      required: true,
      schemes: ["bearer", "oauth2"],
    },
    tools: allTools.map(t => {
      const tool: Record<string, unknown> = { ...t };
      if (
        tool.inputSchema &&
        typeof tool.inputSchema === "object" &&
        "$schema" in (tool.inputSchema as Record<string, unknown>)
      ) {
        const schema = { ...(tool.inputSchema as Record<string, unknown>) };
        delete schema["$schema"];
        tool.inputSchema = schema;
      }
      return tool;
    }),
    resources: [],
    prompts: [],
  };

  const outDir = path.resolve(process.cwd(), ".well-known", "mcp");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, "server-card.json");
  fs.writeFileSync(outFile, JSON.stringify(serverCard, null, 2), "utf8");

  console.log(`Successfully generated ${outFile} (${allTools.length} tools)`);
}

main().catch(err => {
  console.error("Failed to generate server card:", err);
  process.exit(1);
});
