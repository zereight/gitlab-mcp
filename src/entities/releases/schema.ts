import { z } from "zod";
import { requiredId } from "../utils";

// ============================================================================
// manage_release - CQRS Command Tool (discriminated union schema)
// Actions: create, update, delete, create_link, delete_link
// Uses z.discriminatedUnion() for type-safe action handling.
// Schema pipeline flattens to flat JSON Schema for AI clients that don't support oneOf.
// ============================================================================

// --- Shared fields ---
const projectIdField = requiredId.describe(
  "Project ID or URL-encoded path (e.g., 'my-group/my-project')"
);
const tagNameField = z
  .string()
  .describe("The Git tag associated with the release (e.g., 'v1.0.0')");
const nameField = z.string().optional().describe("The release title/name");
const descriptionField = z.string().optional().describe("Release description (supports Markdown)");
const milestonesField = z
  .array(z.string())
  .optional()
  .describe("Array of milestone titles to associate with the release");
const releasedAtField = z
  .string()
  .optional()
  .describe("Release date/time in ISO 8601 format (e.g., '2024-01-15T12:00:00Z')");

// Link type enum matching GitLab API
const linkTypeEnum = z
  .enum(["other", "runbook", "image", "package"])
  .optional()
  .describe("Type of asset link (default: other)");

// --- Action: create ---
const CreateReleaseSchema = z.object({
  action: z.literal("create").describe("Create a new release for an existing or new tag"),
  project_id: projectIdField,
  tag_name: tagNameField,
  name: nameField,
  description: descriptionField,
  ref: z
    .string()
    .optional()
    .describe("Branch/commit SHA to create tag from (if tag does not exist)"),
  tag_message: z
    .string()
    .optional()
    .describe("Annotation message for the tag (creates annotated tag)"),
  milestones: milestonesField,
  released_at: releasedAtField,
  assets: z
    .object({
      links: z
        .array(
          z.object({
            name: z.string().describe("Display name for the asset link"),
            url: z.string().url().describe("URL of the asset"),
            direct_asset_path: z
              .string()
              .optional()
              .describe("Path for direct asset download (creates permanent URL)"),
            link_type: linkTypeEnum,
          })
        )
        .optional()
        .describe("Asset links to create with the release"),
    })
    .optional()
    .describe("Release assets configuration"),
});

// --- Action: update ---
const UpdateReleaseSchema = z.object({
  action: z.literal("update").describe("Update an existing release"),
  project_id: projectIdField,
  tag_name: tagNameField,
  name: nameField,
  description: descriptionField,
  milestones: milestonesField,
  released_at: releasedAtField,
});

// --- Action: delete ---
const DeleteReleaseSchema = z.object({
  action: z.literal("delete").describe("Delete a release (preserves the Git tag)"),
  project_id: projectIdField,
  tag_name: tagNameField,
});

// --- Action: create_link ---
const CreateReleaseLinkSchema = z.object({
  action: z.literal("create_link").describe("Add an asset link to an existing release"),
  project_id: projectIdField,
  tag_name: tagNameField,
  name: z.string().describe("Display name for the asset link (must be unique per release)"),
  url: z.string().url().describe("URL of the asset (must be unique per release)"),
  direct_asset_path: z
    .string()
    .optional()
    .describe("Path for direct asset download (e.g., '/binaries/linux-amd64')"),
  link_type: linkTypeEnum,
});

// --- Action: delete_link ---
const DeleteReleaseLinkSchema = z.object({
  action: z.literal("delete_link").describe("Remove an asset link from a release"),
  project_id: projectIdField,
  tag_name: tagNameField,
  link_id: requiredId.describe("The ID of the asset link to delete"),
});

// --- Discriminated union combining all actions ---
export const ManageReleaseSchema = z.discriminatedUnion("action", [
  CreateReleaseSchema,
  UpdateReleaseSchema,
  DeleteReleaseSchema,
  CreateReleaseLinkSchema,
  DeleteReleaseLinkSchema,
]);

// ============================================================================
// Type exports
// ============================================================================

export type ManageReleaseInput = z.infer<typeof ManageReleaseSchema>;
