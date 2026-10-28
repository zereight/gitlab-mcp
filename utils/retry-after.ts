/** Read GitLab's Retry-After delay in whole seconds without converting the header value. */
export function readRetryAfterSeconds(headers: {
  get(name: string): string | null;
}): string | undefined {
  const value = headers.get("retry-after");
  return value !== null && /^[0-9]+$/.test(value) ? value : undefined;
}
