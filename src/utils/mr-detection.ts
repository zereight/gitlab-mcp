import { detectCurrentBranch } from "./git.js";

export interface MRDetectionResult {
  found: boolean;
  mrUrl?: string;
  projectPath?: string;
  projectId?: string;
  mrIid?: string;
  mergeRequest?: any;
  branch?: string;
  error?: string;
}

/**
 * Detect the MR associated with the current git branch
 */
export async function detectMRFromBranch(
  workingDirectory?: string,
  gitlabApiUrl?: string,
  gitlabToken?: string,
  projectId?: string
): Promise<MRDetectionResult> {
  try {
    // Detect current branch
    const currentBranch = await detectCurrentBranch(workingDirectory);
    console.log(`🌿 Detected current branch: ${currentBranch}`);

    if (currentBranch === 'main' || currentBranch === 'master' || currentBranch === 'develop') {
      return {
        found: false,
        branch: currentBranch,
        error: `Branch '${currentBranch}' is typically not associated with an MR`
      };
    }

    // Get GitLab configuration
    const apiUrl = gitlabApiUrl || process.env.GITLAB_API_URL || 'https://gitlab.com/api/v4';
    const token = gitlabToken || process.env.GITLAB_PERSONAL_ACCESS_TOKEN;
    const defaultProjectId = projectId || process.env.GITLAB_PROJECT_ID;

    if (!token) {
      return {
        found: false,
        branch: currentBranch,
        error: 'GitLab token not found. Set GITLAB_PERSONAL_ACCESS_TOKEN environment variable.'
      };
    }

    if (!defaultProjectId) {
      return {
        found: false,
        branch: currentBranch,
        error: 'GitLab project ID not found. Set GITLAB_PROJECT_ID environment variable or pass projectId parameter.'
      };
    }

    console.log(`🔍 Searching for MRs with source branch '${currentBranch}' in project ${defaultProjectId}...`);

    // Search for merge requests with this branch as source
    const searchUrl = `${apiUrl}/projects/${encodeURIComponent(defaultProjectId)}/merge_requests?source_branch=${encodeURIComponent(currentBranch)}&state=opened`;
    
    const response = await fetch(searchUrl, {
      headers: {
        'PRIVATE-TOKEN': token,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
    }

    const mergeRequests = await response.json();
    
    if (!Array.isArray(mergeRequests) || mergeRequests.length === 0) {
      return {
        found: false,
        branch: currentBranch,
        error: `No open merge requests found for branch '${currentBranch}'`
      };
    }

    // Use the first (most recent) MR found
    const mergeRequest = mergeRequests[0];
    
    // Extract project information from the MR's web_url
    const projectMatch = mergeRequest.web_url.match(/https?:\/\/[^\/]+\/(.+?)\/-\/merge_requests\/(\d+)/);
    if (!projectMatch) {
      return {
        found: false,
        branch: currentBranch,
        error: 'Could not parse project information from MR URL'
      };
    }

    const [, projectPath, mrIid] = projectMatch;

    console.log(`✅ Found MR: ${mergeRequest.title} (!${mergeRequest.iid})`);
    console.log(`🔗 URL: ${mergeRequest.web_url}`);

    return {
      found: true,
      mrUrl: mergeRequest.web_url,
      projectPath,
      projectId: encodeURIComponent(projectPath),
      mrIid,
      mergeRequest,
      branch: currentBranch
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      found: false,
      error: `Failed to detect MR from branch: ${errorMessage}`
    };
  }
}

/**
 * Parse project information from a GitLab URL or detect from current directory
 */
export async function getProjectInfo(
  urlOrPath?: string,
  workingDirectory?: string
): Promise<{
  projectPath?: string;
  projectId?: string;
  mrIid?: string;
  isAutoDetected: boolean;
}> {
  if (urlOrPath) {
    // Parse provided URL
    try {
      const url = new URL(urlOrPath);
      const pathParts = url.pathname.split('/').filter(part => part);
      const mrIndex = pathParts.indexOf('merge_requests');
      
      if (mrIndex === -1) {
        throw new Error('URL must contain /merge_requests/');
      }

      const mrIid = pathParts[mrIndex + 1];
      const projectPath = pathParts.slice(0, pathParts.indexOf('-')).join('/');
      
      return {
        projectPath,
        projectId: encodeURIComponent(projectPath),
        mrIid,
        isAutoDetected: false
      };
    } catch (error) {
      throw new Error(`Failed to parse GitLab URL: ${error instanceof Error ? error.message : String(error)}`);
    }
  } else {
    // Auto-detect from current branch
    const detection = await detectMRFromBranch(workingDirectory);
    
    if (!detection.found) {
      throw new Error(detection.error || 'Could not auto-detect MR from current branch');
    }
    
    return {
      projectPath: detection.projectPath,
      projectId: detection.projectId,
      mrIid: detection.mrIid,
      isAutoDetected: true
    };
  }
}