import { z } from "zod";
import { flexibleBoolean } from "../utils";

// READ-ONLY LABEL OPERATION SCHEMAS

// Labels (read-only)
export const ListLabelsSchema = z.object({
  namespacePath: z.string().describe("Namespace path (group or project) to list labels from"),
  with_counts: flexibleBoolean
    .optional()
    .describe("Whether or not to include issue and merge request counts"),
  include_ancestor_groups: flexibleBoolean.optional().describe("Include ancestor groups"),
  search: z.string().optional().describe("Keyword to filter labels by"),
});

export const GetLabelSchema = z.object({
  namespacePath: z.string().describe("Namespace path (group or project) containing the label"),
  label_id: z.union([z.coerce.string(), z.string()]).describe("The ID or title of the label"),
  include_ancestor_groups: flexibleBoolean.optional().describe("Include ancestor groups"),
});

// Export type definitions
export type ListLabelsOptions = z.infer<typeof ListLabelsSchema>;
export type GetLabelOptions = z.infer<typeof GetLabelSchema>;
