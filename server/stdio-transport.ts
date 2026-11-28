import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { TransportDeps } from "./transport-shared.js";

/**
 * Start server with stdio transport
 */
export async function startStdioServer(deps: TransportDeps): Promise<void> {
  const { createServer, logger, clientPool } = deps;
  const serverInstance = createServer();
  const transport = new StdioServerTransport();
  transport.onclose = () => {
    logger.info("Stdio transport closed, releasing client pool");
    clientPool.closeAll();
  };
  await serverInstance.connect(transport);
}
