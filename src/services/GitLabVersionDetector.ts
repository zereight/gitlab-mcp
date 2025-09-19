import { GraphQLClient } from '../graphql/client';
import { gql } from 'graphql-tag';
import { enhancedFetch } from '../utils/fetch';
import { logger } from '../logger';

export type GitLabTier = 'free' | 'premium' | 'ultimate';

export interface GitLabFeatures {
  // Core features
  workItems: boolean;
  epics: boolean;
  iterations: boolean;
  roadmaps: boolean;
  portfolioManagement: boolean;
  advancedSearch: boolean;
  codeReview: boolean;
  securityDashboard: boolean;
  complianceFramework: boolean;
  valueStreamAnalytics: boolean;
  customFields: boolean;
  okrs: boolean;
  healthStatus: boolean;
  weight: boolean;
  multiLevelEpics: boolean;
  serviceDesk: boolean;
  requirements: boolean;
  qualityManagement: boolean;

  // Widget-specific features
  timeTracking: boolean;
  crmContacts: boolean;
  vulnerabilities: boolean;
  errorTracking: boolean;
  designManagement: boolean;
  linkedResources: boolean;
  emailParticipants: boolean;
}

export interface GitLabInstanceInfo {
  version: string;
  tier: GitLabTier;
  features: GitLabFeatures;
  detectedAt: Date;
}

interface VersionMetadata {
  version: string;
  revision: string;
  kas?: {
    enabled: boolean;
    version?: string;
  };
  enterprise?: boolean;
}

const VERSION_QUERY = gql`
  query GetVersionInfo {
    metadata {
      version
      revision
      kas {
        enabled
        version
      }
      enterprise
    }
    currentUser {
      id
      username
      name
    }
  }
`;

const LICENSE_QUERY = gql`
  query GetLicenseInfo {
    currentLicense {
      id
      type
      plan
      expiresAt
      activatedAt
      lastSync
      billableUsersCount
      maximumUserCount
      usersInLicenseCount
    }
  }
`;

const FEATURE_DETECTION_QUERY = gql`
  query DetectFeatures($groupPath: String!) {
    group(fullPath: $groupPath) {
      id
      epicsEnabled
      iterationsEnabled: iterationCadences(first: 1) {
        nodes {
          id
        }
      }
      workItemTypesEnabled: workItemTypes {
        nodes {
          id
          name
        }
      }
    }
  }
`;

export class GitLabVersionDetector {
  private client: GraphQLClient;
  private cachedInfo: GitLabInstanceInfo | null = null;
  private testGroupPath: string = 'test';

  constructor(client: GraphQLClient) {
    this.client = client;
  }

  public getCachedInfo(): GitLabInstanceInfo | null {
    return this.cachedInfo;
  }

  public async detectInstance(): Promise<GitLabInstanceInfo> {
    if (this.cachedInfo && this.isRecentCache(this.cachedInfo.detectedAt)) {
      return this.cachedInfo;
    }

    const version = await this.detectVersion();
    const tier = await this.detectTier();
    const features = this.determineFeatures(version, tier);

    this.cachedInfo = {
      version,
      tier,
      features,
      detectedAt: new Date(),
    };

    return this.cachedInfo;
  }

  private async detectVersion(): Promise<string> {
    try {
      const response = await this.client.request<{ metadata: VersionMetadata }>(VERSION_QUERY);
      return response.metadata.version;
    } catch (error) {
      logger.warn(
        `Failed to detect GitLab version via GraphQL, trying alternative methods: ${error instanceof Error ? error.message : String(error)}`,
      );
      return await this.detectVersionFallback();
    }
  }

  private async detectVersionFallback(): Promise<string> {
    try {
      const baseUrl = this.client.endpoint.replace('/api/graphql', '');
      const response = await enhancedFetch(`${baseUrl}/api/v4/version`);
      if (response.ok) {
        const data = (await response.json()) as { version: string };
        return data.version;
      }
    } catch (error) {
      logger.warn(
        `Failed to detect version via REST API: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return 'unknown';
  }

  private async detectTier(): Promise<GitLabTier> {
    try {
      interface LicenseResponse {
        currentLicense: {
          plan?: string;
        };
      }
      const response = await this.client.request<LicenseResponse>(LICENSE_QUERY);

      if (response.currentLicense) {
        const plan = response.currentLicense.plan?.toLowerCase() ?? '';

        if (plan.includes('ultimate') || plan.includes('gold')) {
          return 'ultimate';
        } else if (plan.includes('premium') || plan.includes('silver')) {
          return 'premium';
        }
      }
    } catch (error) {
      logger.debug(
        `License query not available, attempting feature detection: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return await this.detectTierByFeatures();
  }

  private async detectTierByFeatures(): Promise<GitLabTier> {
    try {
      interface FeatureResponse {
        group: {
          epicsEnabled?: boolean;
          iterationsEnabled?: { nodes: unknown[] };
          workItemTypesEnabled?: {
            nodes: Array<{ name: string }>;
          };
        };
      }
      const response = await this.client.request<FeatureResponse>(FEATURE_DETECTION_QUERY, {
        groupPath: this.testGroupPath,
      });

      const group = response.group;

      if (group?.epicsEnabled) {
        const hasIterations = (group.iterationsEnabled?.nodes?.length ?? 0) > 0;

        const hasAdvancedWorkItems =
          group.workItemTypesEnabled?.nodes?.some((type) =>
            ['OBJECTIVE', 'KEY_RESULT', 'REQUIREMENT'].includes(type.name),
          ) ?? false;

        if (hasAdvancedWorkItems) {
          return 'ultimate';
        } else if (hasIterations) {
          return 'premium';
        } else {
          return 'premium';
        }
      }
    } catch (error) {
      logger.debug(
        `Feature detection failed, assuming free tier: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return 'free';
  }

  private determineFeatures(version: string, tier: GitLabTier): GitLabFeatures {
    const versionNumber = this.parseVersion(version);

    const features: GitLabFeatures = {
      // Core features aligned with WORK.md Feature Availability Matrix
      workItems: versionNumber >= 15.0,
      epics: tier !== 'free' && versionNumber >= 10.2,
      iterations: tier !== 'free' && versionNumber >= 13.1,
      roadmaps: tier !== 'free' && versionNumber >= 10.8,
      portfolioManagement: tier === 'ultimate' && versionNumber >= 12.0,
      advancedSearch: tier !== 'free' && versionNumber >= 11.0,
      codeReview: tier !== 'free' && versionNumber >= 11.0,
      securityDashboard: tier === 'ultimate' && versionNumber >= 11.1,
      complianceFramework: tier === 'ultimate' && versionNumber >= 13.0,
      valueStreamAnalytics: tier !== 'free' && versionNumber >= 12.3,
      customFields: tier === 'ultimate' && versionNumber >= 17.0,
      okrs: tier === 'ultimate' && versionNumber >= 15.7,
      healthStatus: tier === 'ultimate' && versionNumber >= 13.1,
      weight: tier !== 'free' && versionNumber >= 12.0,
      multiLevelEpics: tier === 'ultimate' && versionNumber >= 11.7,
      serviceDesk: tier !== 'free' && versionNumber >= 9.1,
      requirements: tier === 'ultimate' && versionNumber >= 13.1,
      qualityManagement: tier === 'ultimate' && versionNumber >= 13.0,

      // Widget-specific features aligned with WORK.md
      timeTracking: tier !== 'free' && versionNumber >= 8.14,
      crmContacts: tier === 'ultimate' && versionNumber >= 14.0,
      vulnerabilities: tier === 'ultimate' && versionNumber >= 12.5,
      errorTracking: tier === 'ultimate' && versionNumber >= 12.7,
      designManagement: tier !== 'free' && versionNumber >= 12.2,
      linkedResources: tier !== 'free' && versionNumber >= 16.5,
      emailParticipants: tier !== 'free' && versionNumber >= 16.0,
    };

    return features;
  }

  private parseVersion(version: string): number {
    if (!version || version === 'unknown') return 0;

    const match = version.match(/^(\d+)\.(\d+)/);
    if (!match) return 0;

    const major = parseInt(match[1], 10);
    const minor = parseInt(match[2], 10);

    return major + minor / 10;
  }

  private isRecentCache(detectedAt: Date): boolean {
    const cacheLifetime = 24 * 60 * 60 * 1000;
    return Date.now() - detectedAt.getTime() < cacheLifetime;
  }

  public isFeatureAvailable(feature: keyof GitLabFeatures): boolean {
    if (!this.cachedInfo) {
      throw new Error('Instance info not detected yet. Call detectInstance() first.');
    }

    return this.cachedInfo.features[feature];
  }

  public getTier(): GitLabTier {
    if (!this.cachedInfo) {
      throw new Error('Instance info not detected yet. Call detectInstance() first.');
    }

    return this.cachedInfo.tier;
  }

  public getVersion(): string {
    if (!this.cachedInfo) {
      throw new Error('Instance info not detected yet. Call detectInstance() first.');
    }

    return this.cachedInfo.version;
  }
}
