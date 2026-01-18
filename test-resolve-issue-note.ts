/**
 * This test file demonstrates the new resolve functionality for issue notes.
 * It shows how to use the update_issue_note tool to resolve or unresolve
 * issue discussion threads.
 */

import fetch from "node-fetch";

// GitLab API configuration (replace with actual values when testing)
const GITLAB_API_URL = process.env.GITLAB_API_URL || "https://gitlab.com";
const GITLAB_PERSONAL_ACCESS_TOKEN = process.env.GITLAB_TOKEN || "";
const PROJECT_ID = process.env.PROJECT_ID || "your/project";
const ISSUE_IID = Number(process.env.ISSUE_IID || "1");
const DISCUSSION_ID = process.env.DISCUSSION_ID || "your-discussion-id";
const NOTE_ID = process.env.NOTE_ID || "your-note-id";

/**
 * Test resolving an issue note
 */
async function testResolveIssueNote() {
  try {
    const url = new URL(
      `${GITLAB_API_URL}/api/v4/projects/${encodeURIComponent(
        PROJECT_ID
      )}/issues/${ISSUE_IID}/discussions/${DISCUSSION_ID}/notes/${NOTE_ID}`
    );

    const response = await fetch(url.toString(), {
      method: "PUT",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${GITLAB_PERSONAL_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({ resolved: true }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`GitLab API error: ${response.status} ${response.statusText}\n${errorBody}`);
    }

    const data = await response.json();
    console.log("Successfully resolved issue note:");
    console.log(JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error("Error resolving issue note:", error);
    return false;
  }
}

/**
 * Test unresolving an issue note
 */
async function testUnresolveIssueNote() {
  try {
    const url = new URL(
      `${GITLAB_API_URL}/api/v4/projects/${encodeURIComponent(
        PROJECT_ID
      )}/issues/${ISSUE_IID}/discussions/${DISCUSSION_ID}/notes/${NOTE_ID}`
    );

    const response = await fetch(url.toString(), {
      method: "PUT",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${GITLAB_PERSONAL_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({ resolved: false }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`GitLab API error: ${response.status} ${response.statusText}\n${errorBody}`);
    }

    const data = await response.json();
    console.log("Successfully unresolved issue note:");
    console.log(JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error("Error unresolving issue note:", error);
    return false;
  }
}

/**
 * Test updating note body (existing functionality should still work)
 */
async function testUpdateIssueNoteBody() {
  try {
    const url = new URL(
      `${GITLAB_API_URL}/api/v4/projects/${encodeURIComponent(
        PROJECT_ID
      )}/issues/${ISSUE_IID}/discussions/${DISCUSSION_ID}/notes/${NOTE_ID}`
    );

    const response = await fetch(url.toString(), {
      method: "PUT",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${GITLAB_PERSONAL_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({ body: "Updated note content" }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`GitLab API error: ${response.status} ${response.statusText}\n${errorBody}`);
    }

    const data = await response.json();
    console.log("Successfully updated issue note body:");
    console.log(JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error("Error updating issue note body:", error);
    return false;
  }
}

// Only run the test if executed directly
if (require.main === module) {
  console.log("Testing issue note resolve functionality...\n");
  
  console.log("Note: This is a demonstration test file.");
  console.log("To run actual tests, set the following environment variables:");
  console.log("  - GITLAB_API_URL");
  console.log("  - GITLAB_TOKEN");
  console.log("  - PROJECT_ID");
  console.log("  - ISSUE_IID");
  console.log("  - DISCUSSION_ID");
  console.log("  - NOTE_ID");
  console.log("\nExample MCP tool usage:");
  console.log(`
  {
    "name": "update_issue_note",
    "arguments": {
      "project_id": "your/project",
      "issue_iid": "1",
      "discussion_id": "abc123",
      "note_id": "456",
      "resolved": true
    }
  }
  `);
}

// Export for use in other tests
export { testResolveIssueNote, testUnresolveIssueNote, testUpdateIssueNoteBody };
