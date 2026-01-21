/**
 * GitLab API Integration Tests
 *
 * These tests validate that the GitLab API connection works properly.
 * They require GITLAB_TOKEN environment variable.
 */

const GITLAB_API_URL = process.env.GITLAB_API_URL || "https://gitlab.com";
const GITLAB_TOKEN = process.env.GITLAB_TOKEN_TEST || process.env.GITLAB_TOKEN;

describe("GitLab API Validation", () => {
  beforeAll(() => {
    if (!GITLAB_TOKEN) {
      console.warn("⚠️  Skipping GitLab API tests: GITLAB_TOKEN required");
    }
  });

  const shouldSkipUserTests = !GITLAB_TOKEN;

  (shouldSkipUserTests ? it.skip : it)(
    "should fetch current user information",
    async () => {
      const response = await fetch(`${GITLAB_API_URL}/api/v4/user`, {
        headers: {
          "PRIVATE-TOKEN": GITLAB_TOKEN!,
          "Content-Type": "application/json",
        },
      });

      expect(response.ok).toBe(true);

      const data = (await response.json()) as { id: number; username: string; name: string };
      expect(data).toHaveProperty("id");
      expect(data).toHaveProperty("username");
      expect(data).toHaveProperty("name");
    },
    10000
  );
});
