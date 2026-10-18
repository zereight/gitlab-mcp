export const POLL_TIMEOUT_MESSAGE = "Timed out waiting for terminal status";

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

/**
 * Fetch one poll result inside the deadline. When the deadline signal aborts the
 * request, the wait has timed out, so report that instead of the abort. Any other
 * rejection passes through unchanged, even one that lands after the deadline.
 */
export async function fetchStatusBeforeDeadline<T>(
  fetchStatus: (signal: AbortSignal) => Promise<T>,
  deadline: number
): Promise<T> {
  const remaining = deadline - Date.now();
  if (remaining <= 0) {
    throw new Error(POLL_TIMEOUT_MESSAGE);
  }
  const signal = AbortSignal.timeout(remaining);
  try {
    return await fetchStatus(signal);
  } catch (error) {
    // fetch rejects with signal.reason itself when this signal aborts it. A body read
    // that starts after the abort throws a new AbortError instead.
    if (signal.aborted && (error === signal.reason || isAbortError(error))) {
      throw new Error(POLL_TIMEOUT_MESSAGE, { cause: error });
    }
    throw error;
  }
}
