/** Optional GitLab 19.2+ body fields for draft_notes/bulk_publish. */
export type BulkPublishDraftNotesBody = {
  reviewer_state?: "requested_changes" | "reviewed";
  note?: string;
  internal?: boolean;
};

/**
 * Build the POST body. Omit no-op defaults (`internal: false`, empty `note`)
 * so older GitLab instances are not sent unknown fields.
 */
export function buildBulkPublishDraftNotesBody(
  options: BulkPublishDraftNotesBody
): BulkPublishDraftNotesBody {
  const body: BulkPublishDraftNotesBody = {};
  if (options.reviewer_state !== undefined) {
    body.reviewer_state = options.reviewer_state;
  }
  if (options.note) {
    body.note = options.note;
  }
  if (options.internal === true) {
    body.internal = true;
  }
  return body;
}

/** True when the body needs GitLab 19.2+ bulk_publish fields. */
export function needsGitLab19_2BulkPublish(body: BulkPublishDraftNotesBody): boolean {
  return Object.keys(body).length > 0;
}
