/**
 * Preserve nested wiki hierarchy when callers pass a leaf-only title on update.
 */
export function resolveNestedWikiUpdateTitle(
  slug: string,
  providedTitle: string,
  existingTitle: string
): string {
  if (providedTitle.includes("/") || !slug.includes("/")) {
    return providedTitle;
  }

  const titleParentIndex = existingTitle.lastIndexOf("/");
  if (titleParentIndex >= 0) {
    return `${existingTitle.slice(0, titleParentIndex)}/${providedTitle}`;
  }

  const slugParentIndex = slug.lastIndexOf("/");
  if (slugParentIndex >= 0) {
    return `${slug.slice(0, slugParentIndex)}/${providedTitle}`;
  }

  return providedTitle;
}
