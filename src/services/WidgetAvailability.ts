import { WorkItemWidgetType, WorkItemWidgetTypes } from '../graphql/workItems';
import { ConnectionManager } from './ConnectionManager';
import { GitLabTier } from './GitLabVersionDetector';

interface WidgetRequirement {
  tier: GitLabTier | 'free';
  minVersion: number;
}

export class WidgetAvailability {
  private static widgetRequirements: Record<WorkItemWidgetType, WidgetRequirement> = {
    // Free tier widgets (available to all)
    [WorkItemWidgetTypes.ASSIGNEES]: { tier: 'free', minVersion: 15.0 },
    [WorkItemWidgetTypes.DESCRIPTION]: { tier: 'free', minVersion: 15.0 },
    [WorkItemWidgetTypes.HIERARCHY]: { tier: 'free', minVersion: 15.0 },
    [WorkItemWidgetTypes.LABELS]: { tier: 'free', minVersion: 15.0 },
    [WorkItemWidgetTypes.MILESTONE]: { tier: 'free', minVersion: 15.0 },
    [WorkItemWidgetTypes.NOTES]: { tier: 'free', minVersion: 15.0 },
    [WorkItemWidgetTypes.START_AND_DUE_DATE]: { tier: 'free', minVersion: 15.0 },
    [WorkItemWidgetTypes.STATUS]: { tier: 'free', minVersion: 15.0 },
    [WorkItemWidgetTypes.NOTIFICATIONS]: { tier: 'free', minVersion: 15.0 },
    [WorkItemWidgetTypes.CURRENT_USER_TODOS]: { tier: 'free', minVersion: 15.0 },
    [WorkItemWidgetTypes.AWARD_EMOJI]: { tier: 'free', minVersion: 15.0 },
    [WorkItemWidgetTypes.PARTICIPANTS]: { tier: 'free', minVersion: 15.0 },
    [WorkItemWidgetTypes.DESIGNS]: { tier: 'free', minVersion: 15.0 },
    [WorkItemWidgetTypes.DEVELOPMENT]: { tier: 'free', minVersion: 15.0 },
    [WorkItemWidgetTypes.TIME_TRACKING]: { tier: 'free', minVersion: 15.0 },
    [WorkItemWidgetTypes.ERROR_TRACKING]: { tier: 'free', minVersion: 15.0 },

    // Premium tier widgets
    [WorkItemWidgetTypes.WEIGHT]: { tier: 'premium', minVersion: 15.0 },
    [WorkItemWidgetTypes.ITERATION]: { tier: 'premium', minVersion: 15.0 },
    [WorkItemWidgetTypes.LINKED_ITEMS]: { tier: 'premium', minVersion: 15.0 },
    [WorkItemWidgetTypes.CRM_CONTACTS]: { tier: 'premium', minVersion: 16.0 },
    [WorkItemWidgetTypes.EMAIL_PARTICIPANTS]: { tier: 'premium', minVersion: 16.0 },
    [WorkItemWidgetTypes.LINKED_RESOURCES]: { tier: 'premium', minVersion: 16.5 },

    // Ultimate tier widgets
    [WorkItemWidgetTypes.HEALTH_STATUS]: { tier: 'ultimate', minVersion: 15.0 },
    [WorkItemWidgetTypes.CUSTOM_FIELDS]: { tier: 'ultimate', minVersion: 17.0 },
    [WorkItemWidgetTypes.VULNERABILITIES]: { tier: 'ultimate', minVersion: 15.0 },

    // Legacy widgets (may not be available)
    [WorkItemWidgetTypes.PROGRESS]: { tier: 'free', minVersion: 15.0 },
    [WorkItemWidgetTypes.REQUIREMENT_LEGACY]: { tier: 'ultimate', minVersion: 13.1 },
    [WorkItemWidgetTypes.TEST_REPORTS]: { tier: 'ultimate', minVersion: 13.6 },
    [WorkItemWidgetTypes.COLOR]: { tier: 'free', minVersion: 15.0 },
  };

  public static isWidgetAvailable(widget: WorkItemWidgetType): boolean {
    const connectionManager = ConnectionManager.getInstance();

    try {
      const instanceInfo = connectionManager.getInstanceInfo();
      const requirement = this.widgetRequirements[widget];

      if (!requirement) {
        // Unknown widget, assume not available
        return false;
      }

      // Check version requirement
      const version = this.parseVersion(instanceInfo.version);
      if (version < requirement.minVersion) {
        return false;
      }

      // Check tier requirement
      if (requirement.tier === 'free') {
        return true; // Available to all tiers
      }

      const tierHierarchy: Record<GitLabTier, number> = {
        free: 0,
        premium: 1,
        ultimate: 2,
      };

      const requiredTierLevel = tierHierarchy[requirement.tier as GitLabTier];
      const actualTierLevel = tierHierarchy[instanceInfo.tier];

      return actualTierLevel >= requiredTierLevel;
    } catch {
      // If connection not initialized, assume widget not available
      return false;
    }
  }

  public static getAvailableWidgets(): WorkItemWidgetType[] {
    return Object.values(WorkItemWidgetTypes).filter(
      (widget): widget is WorkItemWidgetType =>
        typeof widget === 'string' && this.isWidgetAvailable(widget as WorkItemWidgetType),
    );
  }

  public static getWidgetRequirement(widget: WorkItemWidgetType): WidgetRequirement | undefined {
    return this.widgetRequirements[widget];
  }

  private static parseVersion(version: string): number {
    if (version === 'unknown') return 0;

    const match = version.match(/^(\d+)\.(\d+)/);
    if (!match) return 0;

    const major = parseInt(match[1], 10);
    const minor = parseInt(match[2], 10);

    return major + minor / 10;
  }
}
