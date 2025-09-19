/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { zodToJsonSchema } from 'zod-to-json-schema';
import { ListWikiPagesSchema, GetWikiPageSchema } from './schema-readonly';
import { CreateWikiPageSchema, UpdateWikiPageSchema, DeleteWikiPageSchema } from './schema';
import { enhancedFetch } from '../../utils/fetch';
import { cleanGidsFromObject } from '../../utils/idConversion';
import { resolveNamespaceForAPI } from '../../utils/namespace';
import { ToolRegistry, EnhancedToolDefinition } from '../../types';

/**
 * Wiki tools registry - unified registry containing all wiki operation tools with their handlers
 */
export const wikiToolRegistry: ToolRegistry = new Map<string, EnhancedToolDefinition>([
  // Read-only tools
  [
    'list_wiki_pages',
    {
      name: 'list_wiki_pages',
      description:
        'BROWSE: Explore all wiki pages in project or group documentation. Use when: Discovering available guides and documentation, Understanding project knowledge base structure, Finding existing pages before creating new ones. Wiki provides collaborative documentation separate from code repository. Returns page titles, slugs, content formats, and creation dates.',
      inputSchema: zodToJsonSchema(ListWikiPagesSchema),
      handler: async (args: unknown): Promise<unknown> => {
        const options = ListWikiPagesSchema.parse(args);
        const { namespacePath } = options;

        // Resolve namespace type and get proper API path
        const { entityType, encodedPath } = await resolveNamespaceForAPI(namespacePath);

        const queryParams = new URLSearchParams();
        Object.entries(options).forEach(([key, value]) => {
          if (value !== undefined && value !== null && key !== 'namespacePath') {
            queryParams.set(key, String(value));
          }
        });

        const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/${entityType}/${encodedPath}/wikis?${queryParams}`;
        const response = await enhancedFetch(apiUrl, {
          headers: {
            Authorization: `Bearer ${process.env.GITLAB_TOKEN}`,
          },
        });

        if (!response.ok) {
          throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
        }

        const wikiPages = await response.json();
        return cleanGidsFromObject(wikiPages);
      },
    },
  ],
  [
    'get_wiki_page',
    {
      name: 'get_wiki_page',
      description:
        'READ: Get complete wiki page content and metadata by slug. Use when: Reading technical documentation and guides, Accessing project knowledge base content, Getting full markdown with formatting. Returns complete page content, metadata, edit history, and author information. Perfect for content analysis and documentation review.',
      inputSchema: zodToJsonSchema(GetWikiPageSchema),
      handler: async (args: unknown): Promise<unknown> => {
        const options = GetWikiPageSchema.parse(args);
        const { namespacePath, slug } = options;

        // Resolve namespace type and get proper API path
        const { entityType, encodedPath } = await resolveNamespaceForAPI(namespacePath);

        const queryParams = new URLSearchParams();
        Object.entries(options).forEach(([key, value]) => {
          if (value !== undefined && value !== null && key !== 'namespacePath' && key !== 'slug') {
            queryParams.set(key, String(value));
          }
        });

        const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/${entityType}/${encodedPath}/wikis/${encodeURIComponent(slug)}?${queryParams}`;
        const response = await enhancedFetch(apiUrl, {
          headers: {
            Authorization: `Bearer ${process.env.GITLAB_TOKEN}`,
          },
        });

        if (!response.ok) {
          throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
        }

        const wikiPage = await response.json();
        return cleanGidsFromObject(wikiPage);
      },
    },
  ],
  // Write tools
  [
    'create_wiki_page',
    {
      name: 'create_wiki_page',
      description:
        'CREATE: Add new documentation page to project or group wiki. Use when: Adding technical documentation, user guides, or FAQs, Creating project knowledge base content, Establishing team documentation standards. Check list_wiki_pages FIRST to avoid duplicate topics. Supports GitLab Flavored Markdown with extensions. Creates version-controlled documentation.',
      inputSchema: zodToJsonSchema(CreateWikiPageSchema),
      handler: async (args: unknown): Promise<unknown> => {
        const options = CreateWikiPageSchema.parse(args);
        const { namespacePath } = options;

        // Resolve namespace type and get proper API path
        const { entityType, encodedPath } = await resolveNamespaceForAPI(namespacePath);

        const body: Record<string, unknown> = {};
        Object.entries(options).forEach(([key, value]) => {
          if (value !== undefined && value !== null && key !== 'namespacePath') {
            body[key] = value;
          }
        });

        const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/${entityType}/${encodedPath}/wikis`;
        const response = await enhancedFetch(apiUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.GITLAB_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
        }

        const wikiPage = await response.json();
        return cleanGidsFromObject(wikiPage);
      },
    },
  ],
  [
    'update_wiki_page',
    {
      name: 'update_wiki_page',
      description:
        'UPDATE: Modify existing wiki page content or properties. Use when: Updating documentation with new information, Fixing errors or improving clarity, Reorganizing content structure. Maintains complete version history with change tracking. Supports collaborative editing with author attribution and diff viewing.',
      inputSchema: zodToJsonSchema(UpdateWikiPageSchema),
      handler: async (args: unknown): Promise<unknown> => {
        const options = UpdateWikiPageSchema.parse(args);
        const { namespacePath, slug } = options;

        // Resolve namespace type and get proper API path
        const { entityType, encodedPath } = await resolveNamespaceForAPI(namespacePath);

        const body: Record<string, unknown> = {};
        Object.entries(options).forEach(([key, value]) => {
          if (value !== undefined && value !== null && key !== 'namespacePath' && key !== 'slug') {
            body[key] = value;
          }
        });

        const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/${entityType}/${encodedPath}/wikis/${encodeURIComponent(slug)}`;
        const response = await enhancedFetch(apiUrl, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${process.env.GITLAB_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
        }

        const wikiPage = await response.json();
        return cleanGidsFromObject(wikiPage);
      },
    },
  ],
  [
    'delete_wiki_page',
    {
      name: 'delete_wiki_page',
      description:
        'DELETE: Permanently remove wiki page from documentation. Use when: Cleaning up outdated or obsolete content, Removing duplicate or incorrect pages, Reorganizing wiki structure. WARNING: Deletes page and ALL version history permanently - cannot be undone. Consider archiving important content first.',
      inputSchema: zodToJsonSchema(DeleteWikiPageSchema),
      handler: async (args: unknown): Promise<unknown> => {
        const options = DeleteWikiPageSchema.parse(args);
        const { namespacePath, slug } = options;

        // Resolve namespace type and get proper API path
        const { entityType, encodedPath } = await resolveNamespaceForAPI(namespacePath);

        const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/${entityType}/${encodedPath}/wikis/${encodeURIComponent(slug)}`;
        const response = await enhancedFetch(apiUrl, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${process.env.GITLAB_TOKEN}`,
          },
        });

        if (!response.ok) {
          throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
        }

        // Wiki deletion may return empty response
        const result = response.status === 204 ? { deleted: true } : await response.json();
        return cleanGidsFromObject(result);
      },
    },
  ],
]);

/**
 * Get read-only tool names from the registry
 */
export function getWikiReadOnlyToolNames(): string[] {
  return ['list_wiki_pages', 'get_wiki_page'];
}

/**
 * Get all tool definitions from the registry (for backward compatibility)
 */
export function getWikiToolDefinitions(): EnhancedToolDefinition[] {
  return Array.from(wikiToolRegistry.values());
}

/**
 * Get filtered tools based on read-only mode
 */
export function getFilteredWikiTools(readOnlyMode: boolean = false): EnhancedToolDefinition[] {
  if (readOnlyMode) {
    const readOnlyNames = getWikiReadOnlyToolNames();
    return Array.from(wikiToolRegistry.values()).filter((tool) =>
      readOnlyNames.includes(tool.name),
    );
  }
  return getWikiToolDefinitions();
}
