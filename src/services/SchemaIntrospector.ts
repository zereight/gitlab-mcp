import { GraphQLClient } from '../graphql/client';
import { gql } from 'graphql-tag';
import { logger } from '../logger';

export interface FieldInfo {
  name: string;
  type: {
    name: string | null;
    kind: string;
    ofType?: {
      name: string | null;
      kind: string;
    } | null;
  };
}

export interface TypeInfo {
  name: string;
  fields: FieldInfo[] | null;
  enumValues?: Array<{ name: string; description?: string }> | null;
}

export interface SchemaInfo {
  workItemWidgetTypes: string[];
  typeDefinitions: Map<string, TypeInfo>;
  availableFeatures: Set<string>;
}

interface IntrospectionType {
  name: string;
  kind: string;
  fields?: FieldInfo[] | null;
  enumValues?: Array<{ name: string; description?: string }> | null;
}

interface IntrospectionResult {
  __schema: {
    types: IntrospectionType[];
  };
}

const INTROSPECTION_QUERY = gql`
  query IntrospectSchema {
    __schema {
      types {
        name
        kind
        fields {
          name
          type {
            name
            kind
            ofType {
              name
              kind
            }
          }
        }
        enumValues {
          name
          description
        }
      }
    }
  }
`;

export class SchemaIntrospector {
  private client: GraphQLClient;
  private cachedSchema: SchemaInfo | null = null;

  constructor(client: GraphQLClient) {
    this.client = client;
  }

  public async introspectSchema(): Promise<SchemaInfo> {
    if (this.cachedSchema) {
      return this.cachedSchema;
    }

    try {
      logger.debug('Introspecting GitLab GraphQL schema...');

      const result = await this.client.request<IntrospectionResult>(INTROSPECTION_QUERY);
      const types = result.__schema.types;

      // Extract WorkItem widget types
      const workItemWidgetType = types.find((type) => type.name === 'WorkItemWidgetType');
      const workItemWidgetTypes = workItemWidgetType?.enumValues?.map((value) => value.name) ?? [];

      // Build type definitions map
      const typeDefinitions = new Map<string, TypeInfo>();

      // Focus on WorkItem-related types
      const relevantTypes = types.filter(
        (type) =>
          type.name &&
          (type.name.startsWith('WorkItem') ||
            type.name.includes('Widget') ||
            type.name === 'AwardEmoji' ||
            type.name === 'Milestone' ||
            type.name === 'User' ||
            type.name === 'Label'),
      );

      for (const type of relevantTypes) {
        typeDefinitions.set(type.name, {
          name: type.name,
          fields: type.fields ?? null,
          enumValues: type.enumValues ?? null,
        });
      }

      // Determine available features based on widget types
      const availableFeatures = new Set<string>();
      for (const widgetType of workItemWidgetTypes) {
        availableFeatures.add(widgetType);
      }

      this.cachedSchema = {
        workItemWidgetTypes,
        typeDefinitions,
        availableFeatures,
      };

      logger.info(
        {
          widgetTypes: workItemWidgetTypes.length,
          typeDefinitions: typeDefinitions.size,
          features: availableFeatures.size,
        },
        'GraphQL schema introspection completed',
      );

      return this.cachedSchema;
    } catch (error) {
      logger.warn(
        { err: error as Error },
        'Schema introspection failed, using fallback schema info',
      );

      // Provide fallback schema info when introspection fails
      this.cachedSchema = {
        workItemWidgetTypes: [
          'ASSIGNEES',
          'LABELS',
          'MILESTONE',
          'DESCRIPTION',
          'START_AND_DUE_DATE',
          'WEIGHT',
          'TIME_TRACKING',
          'HEALTH_STATUS',
          'COLOR',
          'NOTIFICATIONS',
          'NOTES',
        ],
        typeDefinitions: new Map(),
        availableFeatures: new Set(['workItems', 'epics', 'issues']),
      };

      return this.cachedSchema;
    }
  }

  public isWidgetTypeAvailable(widgetType: string): boolean {
    if (!this.cachedSchema) {
      throw new Error('Schema not introspected yet. Call introspectSchema() first.');
    }
    return this.cachedSchema.availableFeatures.has(widgetType);
  }

  public getFieldsForType(typeName: string): FieldInfo[] {
    if (!this.cachedSchema) {
      throw new Error('Schema not introspected yet. Call introspectSchema() first.');
    }

    const typeInfo = this.cachedSchema.typeDefinitions.get(typeName);
    if (typeInfo?.fields) {
      return typeInfo.fields;
    }

    // Fallback field information for common widget types when full schema unavailable
    if (typeName === 'WorkItemWidgetAssignees') {
      return [{ name: 'assignees', type: { name: 'UserConnection', kind: 'OBJECT' } }];
    }
    if (typeName === 'WorkItemWidgetLabels') {
      return [{ name: 'labels', type: { name: 'LabelConnection', kind: 'OBJECT' } }];
    }
    if (typeName === 'WorkItemWidgetMilestone') {
      return [{ name: 'milestone', type: { name: 'Milestone', kind: 'OBJECT' } }];
    }

    return [];
  }

  public hasField(typeName: string, fieldName: string): boolean {
    const fields = this.getFieldsForType(typeName);
    return fields.some((field) => field.name === fieldName);
  }

  public getAvailableWidgetTypes(): string[] {
    if (!this.cachedSchema) {
      throw new Error('Schema not introspected yet. Call introspectSchema() first.');
    }
    return this.cachedSchema.workItemWidgetTypes;
  }

  public generateSafeWidgetQuery(requestedWidgets: string[]): string {
    if (!this.cachedSchema) {
      throw new Error('Schema not introspected yet. Call introspectSchema() first.');
    }

    const safeWidgets: string[] = [];

    for (const widget of requestedWidgets) {
      if (this.isWidgetTypeAvailable(widget)) {
        const widgetTypeName = `WorkItemWidget${
          widget.charAt(0) +
          widget
            .slice(1)
            .toLowerCase()
            .replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase())
        }`;

        // Generate safe field selections for this widget
        const fields = this.getFieldsForType(widgetTypeName);
        const safeFields = this.generateSafeFieldSelections(fields);

        if (safeFields.length > 0) {
          safeWidgets.push(`
            ... on ${widgetTypeName} {
              ${safeFields.join('\n              ')}
            }
          `);
        }
      }
    }

    return safeWidgets.join('\n');
  }

  private generateSafeFieldSelections(fields: FieldInfo[]): string[] {
    const safeFields: string[] = [];

    for (const field of fields) {
      // Skip complex fields that require sub-selections for now
      if (field.type.kind === 'SCALAR' || field.type.kind === 'ENUM') {
        safeFields.push(field.name);
      } else if (field.type.kind === 'OBJECT' && field.name !== 'type') {
        // Add basic object fields with simple sub-selections
        if (field.name === 'milestone') {
          safeFields.push(`${field.name} { id title state }`);
        } else if (field.name === 'assignees' || field.name === 'participants') {
          safeFields.push(`${field.name} { nodes { id username } }`);
        } else if (field.name === 'labels') {
          safeFields.push(`${field.name} { nodes { id title color } }`);
        }
      }
    }

    return safeFields;
  }

  public getCachedSchema(): SchemaInfo | null {
    return this.cachedSchema;
  }

  public clearCache(): void {
    this.cachedSchema = null;
  }
}
