// Vulnerability API functions for GitLab MCP
import fetch from 'node-fetch';
import { 
  GITLAB_API_URL, 
  GITLAB_PERSONAL_ACCESS_TOKEN 
} from '../config/gitlab.js';
import { 
  handleGitLabError, 
  validateGitLabToken 
} from '../utils/index.js';
import {
  GitLabGraphQLVulnerabilitySchema,
  type GitLabGraphQLVulnerability
} from '../../schemas.js';

/**
 * Get vulnerabilities by IDs using GraphQL API
 * (for get_vulnerabilities_by_ids tool)
 */
export async function getVulnerabilitiesByIds(
  projectId: string,
  vulnerabilityIds: string[]
): Promise<GitLabGraphQLVulnerability[]> {
  validateGitLabToken();
  projectId = decodeURIComponent(projectId);

  if (!vulnerabilityIds || vulnerabilityIds.length === 0) {
    throw new Error("At least one vulnerability ID must be provided");
  }

  if (vulnerabilityIds.length > 100) {
    throw new Error("Maximum 100 vulnerability IDs allowed per request");
  }

  // Build the GraphQL query dynamically for multiple vulnerabilities
  const vulnerabilityQueries = vulnerabilityIds.map((id, index) => `
    vuln${index}: vulnerability(id: "gid://gitlab/Vulnerability/${id}") {
      title
      description
      state
      severity
      reportType
      project {
        id
        name
        fullPath
      }
      detectedAt
      confirmedAt
      resolvedAt
      resolvedBy {
        id
        username
      }
      location {
        ... on VulnerabilityLocationDependencyScanning {
          file
          dependency {
            package {
              name
            }
            version
          }
        }
        ... on VulnerabilityLocationSast {
          file
          startLine
          endLine
        }
        ... on VulnerabilityLocationSecretDetection {
          file
          startLine
          endLine
        }
        ... on VulnerabilityLocationContainerScanning {
          image
          operatingSystem
        }
      }
      solution
      identifiers {
        name
        externalType
        externalId
        url
      }
      scanner {
        id
        name
        vendor
      }
      primaryIdentifier {
        name
        externalType
        externalId
        url
      }
    }
  `).join('\n');

  const graphqlQuery = {
    query: `
      query GetMultipleVulnerabilities {
        ${vulnerabilityQueries}
      }
    `
  };

  const graphqlUrl = `${GITLAB_API_URL.replace('/api/v4', '/api')}/graphql`;
  
  const response = await fetch(graphqlUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'PRIVATE-TOKEN': GITLAB_PERSONAL_ACCESS_TOKEN!,
    },
    body: JSON.stringify(graphqlQuery),
  });

  if (response.status === 404) {
    throw new Error("GraphQL API not available");
  }

  await handleGitLabError(response);
  const result: any = await response.json();

  if (result.errors) {
    throw new Error(`GraphQL Error: ${result.errors.map((e: any) => e.message).join(', ')}`);
  }

  if (!result.data) {
    throw new Error("No data returned from GraphQL query");
  }

  // Extract vulnerabilities from the response, filtering out null values
  const vulnerabilities: GitLabGraphQLVulnerability[] = [];
  for (let i = 0; i < vulnerabilityIds.length; i++) {
    const vulnData = result.data[`vuln${i}`];
    if (vulnData) {
      try {
        vulnerabilities.push(GitLabGraphQLVulnerabilitySchema.parse(vulnData));
      } catch (parseError) {
        console.warn(`Failed to parse vulnerability ${vulnerabilityIds[i]}: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
        // Continue processing other vulnerabilities instead of failing completely
      }
    }
  }

  return vulnerabilities;
} 