#!/usr/bin/env npx ts-node
/**
 * Test script for merge request approval tools
 *
 * Usage:
 *   GITLAB_PERSONAL_ACCESS_TOKEN=<token> GITLAB_PROJECT_ID=<project> npx ts-node test/test-merge-request-approvals.ts
 *
 * Optional: Set MERGE_REQUEST_IID to test a specific merge request
 */

import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GITLAB_TOKEN = process.env.GITLAB_PERSONAL_ACCESS_TOKEN || process.env.GITLAB_TOKEN;
const GITLAB_PROJECT_ID = process.env.GITLAB_PROJECT_ID;
const GITLAB_API_URL = process.env.GITLAB_API_URL || "https://gitlab.com/api/v4";
const MERGE_REQUEST_IID = process.env.MERGE_REQUEST_IID;

interface McpResponse {
  result?: {
    content?: Array<{ type: string; text: string }>;
  };
  error?: {
    message: string;
  };
}

async function sendMcpRequest(
  serverProcess: ReturnType<typeof spawn>,
  method: string,
  params: Record<string, unknown>
): Promise<McpResponse> {
  return new Promise((resolve, reject) => {
    const request = {
      jsonrpc: "2.0",
      id: Date.now(),
      method,
      params,
    };

    let responseData = "";

    const onData = (data: Buffer) => {
      responseData += data.toString();
      const lines = responseData.split("\n");
      for (const line of lines) {
        if (line.trim()) {
          try {
            const parsed = JSON.parse(line);
            serverProcess.stdout?.off("data", onData);
            resolve(parsed);
            return;
          } catch {
            // Continue accumulating data
          }
        }
      }
    };

    serverProcess.stdout?.on("data", onData);
    serverProcess.stdin?.write(JSON.stringify(request) + "\n");

    setTimeout(() => {
      serverProcess.stdout?.off("data", onData);
      reject(new Error("Request timeout"));
    }, 30000);
  });
}

async function runTests() {
  console.log("=== Merge Request Approval Tools Test ===\n");

  if (!GITLAB_TOKEN) {
    console.error(
      "Error: GITLAB_PERSONAL_ACCESS_TOKEN or GITLAB_TOKEN environment variable is required"
    );
    process.exit(1);
  }

  if (!GITLAB_PROJECT_ID) {
    console.error("Error: GITLAB_PROJECT_ID environment variable is required");
    process.exit(1);
  }

  console.log(`GitLab API URL: ${GITLAB_API_URL}`);
  console.log(`Project ID: ${GITLAB_PROJECT_ID}`);
  console.log(`Merge Request IID: ${MERGE_REQUEST_IID || "(will find one)"}\n`);

  // Start the MCP server
  const serverPath = path.join(__dirname, "..", "build", "index.js");
  const serverProcess = spawn("node", [serverPath], {
    env: {
      ...process.env,
      GITLAB_PERSONAL_ACCESS_TOKEN: GITLAB_TOKEN,
      GITLAB_API_URL,
    },
    stdio: ["pipe", "pipe", "pipe"],
  });

  serverProcess.stderr?.on("data", data => {
    const msg = data.toString();
    if (!msg.includes("GitLab MCP Server running")) {
      console.error("Server stderr:", msg);
    }
  });

  // Wait for server to start
  await new Promise(resolve => setTimeout(resolve, 2000));

  try {
    // Initialize the MCP connection
    console.log("1. Initializing MCP connection...");
    await sendMcpRequest(serverProcess, "initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "test-client", version: "1.0.0" },
    });
    console.log("   ✓ Connected\n");

    // Find a merge request to test with
    let mrIid = MERGE_REQUEST_IID;
    if (!mrIid) {
      console.log("2. Finding an open merge request...");
      const listResponse = await sendMcpRequest(serverProcess, "tools/call", {
        name: "list_merge_requests",
        arguments: {
          project_id: GITLAB_PROJECT_ID,
          state: "opened",
          per_page: 1,
        },
      });

      if (listResponse.error) {
        console.error("   ✗ Error:", listResponse.error.message);
        process.exit(1);
      }

      const mrs = JSON.parse(listResponse.result?.content?.[0]?.text || "[]");
      if (mrs.length === 0) {
        console.log("   ⚠ No open merge requests found. Create one to test approval tools.");
        process.exit(0);
      }
      mrIid = mrs[0].iid;
      console.log(`   ✓ Found MR !${mrIid}: ${mrs[0].title}\n`);
    }

    // Test get_merge_request_approval_state
    console.log("3. Testing get_merge_request_approval_state...");
    const approvalStateResponse = await sendMcpRequest(serverProcess, "tools/call", {
      name: "get_merge_request_approval_state",
      arguments: {
        project_id: GITLAB_PROJECT_ID,
        merge_request_iid: mrIid,
      },
    });

    if (approvalStateResponse.error) {
      console.error("   ✗ Error:", approvalStateResponse.error.message);
    } else {
      const state = JSON.parse(approvalStateResponse.result?.content?.[0]?.text || "{}");
      console.log("   ✓ Got approval state");
      console.log(`     Rules: ${state.rules?.length || 0}`);

      // Show details for each rule
      for (const rule of state.rules || []) {
        const approvedBy = rule.approved_by || [];
        const approvedNames = approvedBy.map((u: { name: string }) => u.name).join(", ") || "none";
        const status = rule.approved ? "✓ APPROVED" : "○ pending";

        console.log(`\n     Rule: "${rule.name}"`);
        console.log(`       Status: ${status}`);
        console.log(`       Required: ${rule.approvals_required} approval(s)`);
        console.log(
          `       Approved by: ${approvedNames} (${approvedBy.length}/${rule.approvals_required})`
        );
      }
      console.log();
    }

    // Test approve_merge_request (commented out by default to avoid actually approving)
    console.log("4. Testing approve_merge_request...");
    const approveResponse = await sendMcpRequest(serverProcess, "tools/call", {
      name: "approve_merge_request",
      arguments: {
        project_id: GITLAB_PROJECT_ID,
        merge_request_iid: mrIid,
      },
    });
    if (approveResponse.error) {
      console.log("   ✗ Approve error:", approveResponse.error);
    } else {
      console.log("   ✓ Approved successfully");
    }

    // Wait 3 seconds before unapproving
    console.log("\n   Waiting 3 seconds...");
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Test unapprove_merge_request
    console.log("\n5. Testing unapprove_merge_request...");
    const unapproveResponse = await sendMcpRequest(serverProcess, "tools/call", {
      name: "unapprove_merge_request",
      arguments: {
        project_id: GITLAB_PROJECT_ID,
        merge_request_iid: mrIid,
      },
    });
    if (unapproveResponse.error) {
      console.log("   ✗ Unapprove error:", unapproveResponse.error);
    } else {
      console.log("   ✓ Unapproved successfully");
    }

    console.log("\n=== Tests Complete ===");
  } finally {
    serverProcess.kill();
  }
}

runTests().catch(error => {
  console.error("Test failed:", error);
  process.exit(1);
});
