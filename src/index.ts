#!/usr/bin/env node

// Main entry point for the refactored GitLab MCP Server
// This file now focuses only on starting the server
import { runServer } from './server.js';

// Start the server and handle any fatal errors
runServer().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
}); 