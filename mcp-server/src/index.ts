#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerStateTools } from "./state-tools.js";
import { registerPrdTools } from "./prd-tools.js";
import { registerWorkflowTools } from "./workflow-tools.js";
import { registerMemoryTools } from "./memory-tools.js";
import { registerModelRouter } from "./model-router.js";

const server = new McpServer({
  name: "omg-workflow",
  version: "1.0.0",
});

// Register all tool groups
registerStateTools(server);
registerPrdTools(server);
registerWorkflowTools(server);
registerMemoryTools(server);
registerModelRouter(server);

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("OMG MCP Server failed to start:", error);
  process.exit(1);
});
