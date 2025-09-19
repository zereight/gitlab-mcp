import { z } from 'zod';
import { PaginationOptionsSchema } from '../shared';
import { flexibleBoolean } from '../utils';

// Read-only wiki operation schemas
export const ListWikiPagesSchema = z
  .object({
    namespacePath: z.string().describe('Namespace path (group or project) to list wiki pages from'),
    with_content: flexibleBoolean.optional().describe('Include content of the wiki pages'),
  })
  .merge(PaginationOptionsSchema);

export const GetWikiPageSchema = z.object({
  namespacePath: z.string().describe('Namespace path (group or project) containing the wiki page'),
  slug: z.string().describe('URL-encoded slug of the wiki page'),
});

// Define wiki response schemas
export const GitLabWikiPageSchema = z.object({
  title: z.string(),
  slug: z.string(),
  format: z.string(),
  content: z.string().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

// Type exports
export type ListWikiPagesOptions = z.infer<typeof ListWikiPagesSchema>;
export type GetWikiPageOptions = z.infer<typeof GetWikiPageSchema>;
export type GitLabWikiPage = z.infer<typeof GitLabWikiPageSchema>;
