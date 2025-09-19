import { gql } from 'graphql-tag';
import { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { SchemaIntrospector, FieldInfo } from '../services/SchemaIntrospector';
import { logger } from '../logger';

export interface DynamicWorkItem {
  id: string;
  iid: string;
  title: string;
  description?: string;
  state: string;
  workItemType: {
    id: string;
    name: string;
  };
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
  webUrl: string;
  widgets: Array<{ type: string; [key: string]: unknown }>;
}

export class DynamicWorkItemsQueryBuilder {
  private schemaIntrospector: SchemaIntrospector;

  constructor(schemaIntrospector: SchemaIntrospector) {
    this.schemaIntrospector = schemaIntrospector;
  }

  /**
   * Build a safe WorkItems query based on available schema
   */
  public buildWorkItemsQuery(
    requestedWidgets?: string[],
  ): TypedDocumentNode<
    { group: { workItems: { nodes: DynamicWorkItem[] } } },
    { groupPath: string; types?: string[]; first?: number; after?: string }
  > {
    // Use all available widgets if none specified
    const widgets = requestedWidgets ?? this.schemaIntrospector.getAvailableWidgetTypes();

    // Filter to only widgets that are actually available
    const availableWidgets = widgets.filter((widget) =>
      this.schemaIntrospector.isWidgetTypeAvailable(widget),
    );

    logger.info(
      {
        requested: widgets.length,
        available: availableWidgets.length,
        widgetTypes: availableWidgets.slice(0, 5),
      },
      'Building dynamic WorkItems query',
    );

    const widgetFragments = this.buildWidgetFragments(availableWidgets);

    const query = gql`
      query GetWorkItems($groupPath: ID!, $types: [IssueType!], $first: Int, $after: String) {
        group(fullPath: $groupPath) {
          workItems(types: $types, first: $first, after: $after) {
            nodes {
              id
              iid
              title
              description
              state
              workItemType {
                id
                name
              }
              createdAt
              updatedAt
              closedAt
              webUrl
              widgets {
                type
                ${widgetFragments}
              }
            }
          }
        }
      }
    `;

    return query as TypedDocumentNode<
      { group: { workItems: { nodes: DynamicWorkItem[] } } },
      { groupPath: string; types?: string[]; first?: number; after?: string }
    >;
  }

  /**
   * Build widget fragments based on schema-validated fields
   */
  private buildWidgetFragments(widgetTypes: string[]): string {
    const fragments: string[] = [];

    for (const widgetType of widgetTypes) {
      const fragment = this.buildWidgetFragment(widgetType);
      if (fragment) {
        fragments.push(fragment);
      }
    }

    return fragments.join('\n');
  }

  /**
   * Build a single widget fragment with validated fields
   */
  private buildWidgetFragment(widgetType: string): string | null {
    const typeName = this.getWidgetTypeName(widgetType);
    const fields = this.schemaIntrospector.getFieldsForType(typeName);

    if (fields.length === 0) {
      return null;
    }

    // Build safe field selections
    const safeFields = this.buildSafeFields(widgetType, fields);

    if (safeFields.length === 0) {
      return null;
    }

    return `
      ... on ${typeName} {
        ${safeFields.join('\n        ')}
      }
    `;
  }

  /**
   * Convert widget type to GraphQL type name
   */
  private getWidgetTypeName(widgetType: string): string {
    // Convert SNAKE_CASE to PascalCase
    const pascalCase = widgetType
      .split('_')
      .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
      .join('');

    return `WorkItemWidget${pascalCase}`;
  }

  /**
   * Build safe field selections for a widget type
   */
  private buildSafeFields(widgetType: string, fields: FieldInfo[]): string[] {
    const safeFields: string[] = [];

    // Widget-specific field mappings
    const widgetFieldMappings: Record<string, () => string[]> = {
      ASSIGNEES: () => this.buildAssigneesFields(),
      LABELS: () => this.buildLabelsFields(),
      MILESTONE: () => this.buildMilestoneFields(),
      DESCRIPTION: () => this.buildDescriptionFields(),
      START_AND_DUE_DATE: () => ['startDate', 'dueDate'],
      WEIGHT: () => ['weight'],
      TIME_TRACKING: () => ['timeEstimate', 'totalTimeSpent'],
      HEALTH_STATUS: () => ['healthStatus'],
      COLOR: () => ['color'],
      NOTIFICATIONS: () => ['subscribed'],
    };

    const mapper = widgetFieldMappings[widgetType];
    if (mapper) {
      return mapper();
    }

    // Default: include only scalar/enum fields
    for (const field of fields) {
      if (field.name === 'type') continue; // Skip type field as it's already included

      if (field.type?.kind === 'SCALAR' || field.type?.kind === 'ENUM') {
        safeFields.push(field.name);
      }
    }

    return safeFields;
  }

  private buildAssigneesFields(): string[] {
    if (this.schemaIntrospector.hasField('WorkItemWidgetAssignees', 'assignees')) {
      return [
        'assignees {',
        '  nodes {',
        '    id',
        '    username',
        '    name',
        '    avatarUrl',
        '  }',
        '}',
      ];
    }
    return [];
  }

  private buildLabelsFields(): string[] {
    if (this.schemaIntrospector.hasField('WorkItemWidgetLabels', 'labels')) {
      return [
        'labels {',
        '  nodes {',
        '    id',
        '    title',
        '    color',
        '    description',
        '  }',
        '}',
      ];
    }
    return [];
  }

  private buildMilestoneFields(): string[] {
    if (this.schemaIntrospector.hasField('WorkItemWidgetMilestone', 'milestone')) {
      return [
        'milestone {',
        '  id',
        '  title',
        '  state',
        '  dueDate',
        '  startDate',
        '  webPath',
        '}',
      ];
    }
    return [];
  }

  private buildDescriptionFields(): string[] {
    const fields = ['description'];

    if (this.schemaIntrospector.hasField('WorkItemWidgetDescription', 'descriptionHtml')) {
      fields.push('descriptionHtml');
    }

    if (this.schemaIntrospector.hasField('WorkItemWidgetDescription', 'edited')) {
      fields.push('edited');
    }

    return fields;
  }

  /**
   * Build a minimal query for basic testing
   */
  public buildMinimalQuery(): TypedDocumentNode<
    { group: { workItems: { nodes: DynamicWorkItem[] } } },
    { groupPath: string; first?: number; after?: string }
  > {
    const query = gql`
      query GetWorkItemsMinimal($groupPath: ID!, $first: Int, $after: String) {
        group(fullPath: $groupPath) {
          workItems(first: $first, after: $after) {
            nodes {
              id
              iid
              title
              state
              workItemType {
                id
                name
              }
              widgets {
                type
              }
            }
          }
        }
      }
    `;

    return query as TypedDocumentNode<
      { group: { workItems: { nodes: DynamicWorkItem[] } } },
      { groupPath: string; first?: number; after?: string }
    >;
  }
}
