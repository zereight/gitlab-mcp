import { GraphQLClient } from "../graphql/client";
import { GitLabVersionDetector, GitLabInstanceInfo } from "./GitLabVersionDetector";
import { SchemaIntrospector, SchemaInfo } from "./SchemaIntrospector";
import { GITLAB_BASE_URL, GITLAB_TOKEN } from "../config";
import { isOAuthEnabled } from "../oauth/index";
import { logger } from "../logger";

interface CacheEntry {
  schemaInfo: SchemaInfo;
  instanceInfo: GitLabInstanceInfo;
  timestamp: number;
}

export class ConnectionManager {
  private static instance: ConnectionManager | null = null;
  private client: GraphQLClient | null = null;
  private versionDetector: GitLabVersionDetector | null = null;
  private schemaIntrospector: SchemaIntrospector | null = null;
  private instanceInfo: GitLabInstanceInfo | null = null;
  private schemaInfo: SchemaInfo | null = null;
  private isInitialized: boolean = false;
  private static introspectionCache = new Map<string, CacheEntry>();
  private static readonly CACHE_TTL = 10 * 60 * 1000; // 10 minutes in milliseconds

  private constructor() {}

  public static getInstance(): ConnectionManager {
    ConnectionManager.instance ??= new ConnectionManager();
    return ConnectionManager.instance;
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      const oauthMode = isOAuthEnabled();

      // In OAuth mode, token comes from request context via enhancedFetch
      // In static mode, require both base URL and token
      if (!GITLAB_BASE_URL) {
        throw new Error("GitLab base URL is required");
      }

      if (!oauthMode && !GITLAB_TOKEN) {
        throw new Error("GitLab token is required in static authentication mode");
      }

      // Construct GraphQL endpoint from base URL
      const endpoint = `${GITLAB_BASE_URL}/api/graphql`;

      // In OAuth mode, don't set static Authorization header
      // enhancedFetch will add the token from request context
      const clientOptions = oauthMode
        ? {}
        : { headers: { Authorization: `Bearer ${GITLAB_TOKEN}` } };

      this.client = new GraphQLClient(endpoint, clientOptions);

      this.versionDetector = new GitLabVersionDetector(this.client);
      this.schemaIntrospector = new SchemaIntrospector(this.client);

      // In OAuth mode, try unauthenticated version detection first
      // Many GitLab instances expose /api/v4/version without auth
      if (oauthMode) {
        logger.info("OAuth mode: attempting unauthenticated version detection");
        try {
          const versionResponse = await fetch(`${GITLAB_BASE_URL}/api/v4/version`);
          if (versionResponse.ok) {
            const versionData = (await versionResponse.json()) as {
              version: string;
              enterprise?: boolean;
            };
            logger.info(
              { version: versionData.version },
              "Detected GitLab version without authentication"
            );

            // Create basic instance info from unauthenticated response
            // Default to "ultimate" tier to allow all tools - will be refined on first authenticated request
            this.instanceInfo = {
              version: versionData.version,
              tier: versionData.enterprise ? "ultimate" : "free",
              features: this.getDefaultFeatures(versionData.enterprise ?? false),
              detectedAt: new Date(),
            };

            // Schema introspection still deferred (requires auth for full introspection)
            logger.info(
              "OAuth mode: version detected, full introspection deferred until first authenticated request"
            );
          } else {
            logger.info(
              { status: versionResponse.status },
              "OAuth mode: unauthenticated version detection failed, deferring all introspection"
            );
          }
        } catch (error) {
          logger.info(
            { error: error instanceof Error ? error.message : String(error) },
            "OAuth mode: unauthenticated version detection failed, deferring all introspection"
          );
        }
        this.isInitialized = true;
        return;
      }

      // Check cache first
      const cached = ConnectionManager.introspectionCache.get(endpoint);
      const now = Date.now();

      if (cached && now - cached.timestamp < ConnectionManager.CACHE_TTL) {
        logger.info("Using cached GraphQL introspection data");
        this.instanceInfo = cached.instanceInfo;
        this.schemaInfo = cached.schemaInfo;
      } else {
        logger.debug("Introspecting GitLab GraphQL schema...");

        // Detect instance info and introspect schema in parallel
        const [instanceInfo, schemaInfo] = await Promise.all([
          this.versionDetector.detectInstance(),
          this.schemaIntrospector.introspectSchema(),
        ]);

        this.instanceInfo = instanceInfo;
        this.schemaInfo = schemaInfo;

        // Cache the results
        ConnectionManager.introspectionCache.set(endpoint, {
          instanceInfo,
          schemaInfo,
          timestamp: now,
        });

        logger.info("GraphQL schema introspection completed");
      }

      this.isInitialized = true;

      logger.info(
        {
          version: this.instanceInfo?.version,
          tier: this.instanceInfo?.tier,
          features: this.instanceInfo
            ? Object.entries(this.instanceInfo.features)
                .filter(([, enabled]) => enabled)
                .map(([feature]) => feature)
            : [],
          widgetTypes: this.schemaInfo?.workItemWidgetTypes.length || 0,
          schemaTypes: this.schemaInfo?.typeDefinitions.size || 0,
        },
        "GitLab instance and schema detected"
      );
    } catch (error) {
      logger.error({ err: error as Error }, "Failed to initialize connection");
      throw error;
    }
  }

  /**
   * Ensure schema introspection has been performed.
   * In OAuth mode, this should be called within a token context.
   */
  public async ensureIntrospected(): Promise<void> {
    // Already introspected
    if (this.instanceInfo && this.schemaInfo) {
      return;
    }

    if (!this.client || !this.versionDetector || !this.schemaIntrospector) {
      throw new Error("Connection not initialized. Call initialize() first.");
    }

    const endpoint = this.client.endpoint;

    // Check cache first
    const cached = ConnectionManager.introspectionCache.get(endpoint);
    const now = Date.now();

    if (cached && now - cached.timestamp < ConnectionManager.CACHE_TTL) {
      logger.info("Using cached GraphQL introspection data");
      this.instanceInfo = cached.instanceInfo;
      this.schemaInfo = cached.schemaInfo;
      return;
    }

    logger.debug("Introspecting GitLab GraphQL schema (deferred OAuth mode)...");

    // Detect instance info and introspect schema in parallel
    const [instanceInfo, schemaInfo] = await Promise.all([
      this.versionDetector.detectInstance(),
      this.schemaIntrospector.introspectSchema(),
    ]);

    this.instanceInfo = instanceInfo;
    this.schemaInfo = schemaInfo;

    // Cache the results
    ConnectionManager.introspectionCache.set(endpoint, {
      instanceInfo,
      schemaInfo,
      timestamp: now,
    });

    logger.info(
      {
        version: this.instanceInfo?.version,
        tier: this.instanceInfo?.tier,
        widgetTypes: this.schemaInfo?.workItemWidgetTypes.length || 0,
      },
      "GraphQL schema introspection completed (deferred)"
    );
  }

  public getClient(): GraphQLClient {
    if (!this.client) {
      throw new Error("Connection not initialized. Call initialize() first.");
    }
    return this.client;
  }

  public getVersionDetector(): GitLabVersionDetector {
    if (!this.versionDetector) {
      throw new Error("Connection not initialized. Call initialize() first.");
    }
    return this.versionDetector;
  }

  public getSchemaIntrospector(): SchemaIntrospector {
    if (!this.schemaIntrospector) {
      throw new Error("Connection not initialized. Call initialize() first.");
    }
    return this.schemaIntrospector;
  }

  public getInstanceInfo(): GitLabInstanceInfo {
    if (!this.instanceInfo) {
      throw new Error("Connection not initialized. Call initialize() first.");
    }
    return this.instanceInfo;
  }

  public getSchemaInfo(): SchemaInfo {
    if (!this.schemaInfo) {
      throw new Error("Connection not initialized. Call initialize() first.");
    }
    return this.schemaInfo;
  }

  public isFeatureAvailable(feature: keyof GitLabInstanceInfo["features"]): boolean {
    if (!this.instanceInfo) {
      return false;
    }
    return this.instanceInfo.features[feature];
  }

  public getTier(): string {
    if (!this.instanceInfo) {
      return "unknown";
    }
    return this.instanceInfo.tier;
  }

  public getVersion(): string {
    if (!this.instanceInfo) {
      return "unknown";
    }
    return this.instanceInfo.version;
  }

  public isWidgetAvailable(widgetType: string): boolean {
    if (!this.schemaIntrospector) {
      return false;
    }
    return this.schemaIntrospector.isWidgetTypeAvailable(widgetType);
  }

  /**
   * Get default features based on whether GitLab is enterprise edition.
   * In OAuth mode without full introspection, we default to enabling most features
   * to allow tools to be available - they will fail gracefully if not actually available.
   */
  private getDefaultFeatures(isEnterprise: boolean): GitLabInstanceInfo["features"] {
    // Default to enabling most features - better to allow and fail gracefully
    // than to block tools that might actually be available
    return {
      workItems: true,
      epics: isEnterprise,
      iterations: isEnterprise,
      roadmaps: isEnterprise,
      portfolioManagement: isEnterprise,
      advancedSearch: true,
      codeReview: true,
      securityDashboard: isEnterprise,
      complianceFramework: isEnterprise,
      valueStreamAnalytics: isEnterprise,
      customFields: isEnterprise,
      okrs: isEnterprise,
      healthStatus: isEnterprise,
      weight: isEnterprise,
      multiLevelEpics: isEnterprise,
      serviceDesk: true,
      requirements: isEnterprise,
      qualityManagement: isEnterprise,
      timeTracking: true,
      crmContacts: true,
      vulnerabilities: isEnterprise,
      errorTracking: true,
      designManagement: true,
      linkedResources: true,
      emailParticipants: true,
    };
  }

  public reset(): void {
    this.client = null;
    this.versionDetector = null;
    this.schemaIntrospector = null;
    this.instanceInfo = null;
    this.schemaInfo = null;
    this.isInitialized = false;
  }
}
