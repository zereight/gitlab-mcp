// Error handling utilities for GitLab API operations

/**
 * Utility function for handling GitLab API errors
 * API 에러 처리를 위한 유틸리티 함수 (Utility function for handling API errors)
 *
 * @param {import("node-fetch").Response} response - The response from GitLab API
 * @throws {Error} Throws an error with response details if the request failed
 */
export async function handleGitLabError(
  response: import("node-fetch").Response
): Promise<void> {
  if (!response.ok) {
    const errorBody = await response.text();
    // Check specifically for Rate Limit error
    if (
      response.status === 403 &&
      errorBody.includes("User API Key Rate limit exceeded")
    ) {
      console.error("GitLab API Rate Limit Exceeded:", errorBody);
      console.log("User API Key Rate limit exceeded. Please try again later.");
      throw new Error(`GitLab API Rate Limit Exceeded: ${errorBody}`);
    } else {
      // Handle other API errors
      throw new Error(
        `GitLab API error: ${response.status} ${response.statusText}\n${errorBody}`
      );
    }
  }
} 