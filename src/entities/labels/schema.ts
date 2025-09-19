import { z } from "zod";

// WRITE LABEL OPERATION SCHEMAS

// Label operations (write)
export const CreateLabelSchema = z.object({
  namespacePath: z.string().describe("Namespace path (group or project) to create label in"),
  name: z.string().describe("The name of the label"),
  color: z
    .string()
    .describe(
      "The color of the label given in 6-digit hex notation with leading '#' sign (e.g. #FFAABB) or one of the CSS color names"
    ),
  description: z.string().optional().describe("The description of the label"),
  priority: z
    .number()
    .optional()
    .describe(
      "The priority of the label. Must be greater or equal than zero or null to remove the priority"
    ),
});

export const UpdateLabelSchema = z.object({
  namespacePath: z.string().describe("Namespace path (group or project) containing the label"),
  label_id: z.union([z.coerce.string(), z.string()]).describe("The ID or title of the label"),
  new_name: z.string().optional().describe("The new name of the label"),
  color: z
    .string()
    .optional()
    .describe(
      "The color of the label given in 6-digit hex notation with leading '#' sign (e.g. #FFAABB) or one of the CSS color names"
    ),
  description: z.string().optional().describe("The description of the label"),
  priority: z
    .number()
    .optional()
    .describe(
      "The priority of the label. Must be greater or equal than zero or null to remove the priority"
    ),
});

export const DeleteLabelSchema = z.object({
  namespacePath: z.string().describe("Namespace path (group or project) containing the label"),
  label_id: z.union([z.coerce.string(), z.string()]).describe("The ID or title of the label"),
});

// Export type definitions
export type CreateLabelOptions = z.infer<typeof CreateLabelSchema>;
export type UpdateLabelOptions = z.infer<typeof UpdateLabelSchema>;
export type DeleteLabelOptions = z.infer<typeof DeleteLabelSchema>;
