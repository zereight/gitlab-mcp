#!/usr/bin/env node

/**
 * Integration test for the greeting tool
 */

import { spawn } from "child_process";
import { writeFileSync, mkdtempSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

async function testGreetingTool() {
  console.log("🧪 Testing Greeting Tool Integration...\n");

  // Create a temporary directory for the test
  const tempDir = mkdtempSync(join(tmpdir(), "mcp-greeting-test-"));

  // Test cases
  const testCases = [
    {
      name: "Korean greeting",
      request: {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "greeting",
          arguments: {
            message: "안녕하세요",
            language: "ko",
          },
        },
      },
    },
    {
      name: "English greeting",
      request: {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "greeting",
          arguments: {
            message: "Hello",
            language: "en",
          },
        },
      },
    },
    {
      name: "Auto detection",
      request: {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: {
          name: "greeting",
          arguments: {
            message: "안녕?",
            language: "auto",
          },
        },
      },
    },
    {
      name: "Default case",
      request: {
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: {
          name: "greeting",
          arguments: {},
        },
      },
    },
  ];

  for (const testCase of testCases) {
    console.log(`Testing ${testCase.name}...`);

    try {
      const result = await callMCPTool(testCase.request);
      console.log(`✅ ${testCase.name} passed`);
      console.log(`   Response: ${result}\n`);
    } catch (error) {
      console.error(`❌ ${testCase.name} failed:`, error.message);
    }
  }

  console.log("🎉 Greeting tool integration tests completed!");
}

function callMCPTool(request) {
  return new Promise((resolve, reject) => {
    // Start the MCP server
    const mcpServer = spawn("node", ["build/index.js"], {
      stdio: ["pipe", "pipe", "pipe"],
      cwd: process.cwd(),
    });

    let output = "";
    let errorOutput = "";

    mcpServer.stdout.on("data", data => {
      output += data.toString();
    });

    mcpServer.stderr.on("data", data => {
      errorOutput += data.toString();
    });

    mcpServer.on("close", code => {
      if (code === 0) {
        // Parse the JSON-RPC response
        try {
          const lines = output.trim().split("\n");
          // Look for the response to our request
          for (const line of lines) {
            if (line.trim() && line.includes('"id"')) {
              const response = JSON.parse(line);
              if (response.id === request.id) {
                if (response.result && response.result.content) {
                  resolve(response.result.content[0].text);
                  return;
                }
              }
            }
          }
          reject(new Error("No valid response found"));
        } catch (error) {
          reject(new Error(`Failed to parse response: ${error.message}`));
        }
      } else {
        reject(new Error(`Process exited with code ${code}. Error: ${errorOutput}`));
      }
    });

    // Send the initialize request first
    const initRequest = {
      jsonrpc: "2.0",
      id: 0,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {
          tools: {},
        },
        clientInfo: {
          name: "test-client",
          version: "1.0.0",
        },
      },
    };

    // Send requests
    mcpServer.stdin.write(JSON.stringify(initRequest) + "\n");
    mcpServer.stdin.write(JSON.stringify(request) + "\n");
    mcpServer.stdin.end();
  });
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testGreetingTool().catch(error => {
    console.error("Test failed:", error);
    process.exit(1);
  });
}
