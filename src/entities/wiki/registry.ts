import * as z from "zod";
import { ListWikiPagesSchema, GetWikiPageSchema } from "./schema-readonly";
import { CreateWikiPageSchema, UpdateWikiPageSchema, DeleteWikiPageSchema } from "./schema";
import { gitlab, toQuery } from "../../utils/gitlab-api";
import { resolveNamespaceForAPI } from "../../utils/namespace";
import { ToolRegistry, EnhancedToolDefinition } from "../../types";

/**
 * Wiki tools registry - unified registry containing all wiki operation tools with their handlers
 */
export const wikiToolRegistry: ToolRegistry = new Map<string, EnhancedToolDefinition>([
  [
    "list_wiki_pages",
    {
      name: "list_wiki_pages",
      description:
        "BROWSE: Explore all wiki pages in project or group documentation. Use when: Discovering available guides and documentation, Understanding project knowledge base structure, Finding existing pages before creating new ones. Wiki provides collaborative documentation separate from code repository. Returns page titles, slugs, content formats, and creation dates.",
      inputSchema: z.toJSONSchema(ListWikiPagesSchema),
      handler: async (args: unknown) => {
        const options = ListWikiPagesSchema.parse(args);
        const { entityType, encodedPath } = await resolveNamespaceForAPI(options.namespace);

        return gitlab.get(`${entityType}/${encodedPath}/wikis`, {
          query: toQuery(options, ["namespace"]),
        });
      },
    },
  ],
  [
    "get_wiki_page",
    {
      name: "get_wiki_page",
      description:
        "READ: Get complete wiki page content and metadata by slug. Use when: Reading technical documentation and guides, Accessing project knowledge base content, Getting full markdown with formatting. Returns complete page content, metadata, edit history, and author information. Perfect for content analysis and documentation review.",
      inputSchema: z.toJSONSchema(GetWikiPageSchema),
      handler: async (args: unknown) => {
        const options = GetWikiPageSchema.parse(args);
        const { entityType, encodedPath } = await resolveNamespaceForAPI(options.namespace);

        return gitlab.get(`${entityType}/${encodedPath}/wikis/${encodeURIComponent(options.slug)}`);
      },
    },
  ],
  [
    "create_wiki_page",
    {
      name: "create_wiki_page",
      description:
        "CREATE: Add new documentation page to project or group wiki. Use when: Adding technical documentation, user guides, or FAQs, Creating project knowledge base content, Establishing team documentation standards. Check list_wiki_pages FIRST to avoid duplicate topics. Supports GitLab Flavored Markdown with extensions. Creates version-controlled documentation.",
      inputSchema: z.toJSONSchema(CreateWikiPageSchema),
      handler: async (args: unknown) => {
        const options = CreateWikiPageSchema.parse(args);
        const { entityType, encodedPath } = await resolveNamespaceForAPI(options.namespace);
        const { namespace: _namespace, ...body } = options;

        return gitlab.post(`${entityType}/${encodedPath}/wikis`, {
          body,
          contentType: "json",
        });
      },
    },
  ],
  [
    "update_wiki_page",
    {
      name: "update_wiki_page",
      description:
        "UPDATE: Modify existing wiki page content or properties. Use when: Updating documentation with new information, Fixing errors or improving clarity, Reorganizing content structure. Maintains complete version history with change tracking. Supports collaborative editing with author attribution and diff viewing.",
      inputSchema: z.toJSONSchema(UpdateWikiPageSchema),
      handler: async (args: unknown) => {
        const options = UpdateWikiPageSchema.parse(args);
        const { entityType, encodedPath } = await resolveNamespaceForAPI(options.namespace);
        const { namespace: _namespace, slug, ...body } = options;

        return gitlab.put(`${entityType}/${encodedPath}/wikis/${encodeURIComponent(slug)}`, {
          body,
          contentType: "json",
        });
      },
    },
  ],
  [
    "delete_wiki_page",
    {
      name: "delete_wiki_page",
      description:
        "DELETE: Permanently remove wiki page from documentation. Use when: Cleaning up outdated or obsolete content, Removing duplicate or incorrect pages, Reorganizing wiki structure. WARNING: Deletes page and ALL version history permanently - cannot be undone. Consider archiving important content first.",
      inputSchema: z.toJSONSchema(DeleteWikiPageSchema),
      handler: async (args: unknown) => {
        const options = DeleteWikiPageSchema.parse(args);
        const { entityType, encodedPath } = await resolveNamespaceForAPI(options.namespace);

        await gitlab.delete(
          `${entityType}/${encodedPath}/wikis/${encodeURIComponent(options.slug)}`
        );
        return { deleted: true };
      },
    },
  ],
]);

export function getWikiReadOnlyToolNames(): string[] {
  return ["list_wiki_pages", "get_wiki_page"];
}

export function getWikiToolDefinitions(): EnhancedToolDefinition[] {
  return Array.from(wikiToolRegistry.values());
}

export function getFilteredWikiTools(readOnlyMode: boolean = false): EnhancedToolDefinition[] {
  if (readOnlyMode) {
    const readOnlyNames = getWikiReadOnlyToolNames();
    return Array.from(wikiToolRegistry.values()).filter(tool => readOnlyNames.includes(tool.name));
  }
  return getWikiToolDefinitions();
}
