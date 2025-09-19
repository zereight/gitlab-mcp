#!/usr/bin/env node

import { startServer } from './server';
import { logger } from './logger';

// Start the server
startServer().catch((error: unknown) => {
  logger.error(`Failed to start GitLab MCP Server: ${String(error)}`);
  process.exit(1);
});
