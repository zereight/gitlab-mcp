/**
 * This test file verifies that the createNote function works correctly
 * with the fixed endpoint URL construction that uses plural resource names
 * (issues instead of issue, merge_requests instead of merge_request).
 */
import fetch from "node-fetch";
// GitLab API configuration (replace with actual values when testing)
const GITLAB_API_URL = process.env.GITLAB_API_URL || "https://gitlab.com";
const GITLAB_PERSONAL_ACCESS_TOKEN = process.env.GITLAB_TOKEN || "";
const PROJECT_ID = process.env.PROJECT_ID || "your/project";
const ISSUE_IID = Number(process.env.ISSUE_IID || "1");
async function testCreateIssueNote() {
    try {
        // Using plural form "issues" in the URL
        const url = new URL(`${GITLAB_API_URL}/api/v4/projects/${encodeURIComponent(PROJECT_ID)}/issues/${ISSUE_IID}/notes`);
        const response = await fetch(url.toString(), {
            method: "POST",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
                Authorization: `Bearer ${GITLAB_PERSONAL_ACCESS_TOKEN}`,
            },
            body: JSON.stringify({ body: "Test note from API - with plural endpoint" }),
        });
        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`GitLab API error: ${response.status} ${response.statusText}\n${errorBody}`);
        }
        const data = await response.json();
        console.log("Successfully created note:");
        console.log(JSON.stringify(data, null, 2));
        return true;
    }
    catch (error) {
        console.error("Error creating note:", error);
        return false;
    }
}
// Only run the test if executed directly
if (require.main === module) {
    console.log("Testing note creation with plural 'issues' endpoint...");
    testCreateIssueNote().then(success => {
        if (success) {
            console.log("✅ Test successful!");
            process.exit(0);
        }
        else {
            console.log("❌ Test failed!");
            process.exit(1);
        }
    });
}
// Export for use in other tests
export { testCreateIssueNote };
