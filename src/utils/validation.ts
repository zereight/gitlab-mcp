// Token validation utilities for GitLab API operations
import { GITLAB_PERSONAL_ACCESS_TOKEN } from '../config/gitlab.js';

/**
 * Validate that GitLab token is available for API operations
 * @throws {Error} If token is not set
 */
export function validateGitLabToken(): void {
  if (!GITLAB_PERSONAL_ACCESS_TOKEN) {
    throw new Error("GitLab API operation requires GITLAB_PERSONAL_ACCESS_TOKEN to be set");
  }
} 