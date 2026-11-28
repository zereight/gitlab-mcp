import {
  MAX_ATTEMPTS,
  MAX_TOTAL_WAIT_MS,
  retryDelayMs,
  sleepInChunks,
  type BackoffIo,
} from "./rate-limit.js";

export type DeleteScratchIo = BackoffIo;

// GitLab rate-limits bursts with 429; 404 means the resource is already gone.
export async function deleteScratch(
  send: () => Promise<Response>,
  what: string,
  hint: string,
  io: DeleteScratchIo = {}
): Promise<void> {
  const sleep = io.sleep ?? (ms => new Promise<void>(resolve => setTimeout(resolve, ms)));
  const log = io.log ?? (line => process.stderr.write(`${line}\n`));
  const now = io.now ?? Date.now;
  let waited = 0;
  for (let attempt = 0; ; attempt++) {
    const response = await send();
    if (response.ok || response.status === 404) return;
    if (response.status !== 429 || attempt + 1 >= MAX_ATTEMPTS) {
      log(`could not delete ${what} (${response.status}); ${hint}`);
      return;
    }
    const wait = retryDelayMs(response, attempt, now());
    if (waited + wait > MAX_TOTAL_WAIT_MS) {
      log(`could not delete ${what} (429, advertised wait exceeds the 5 minute ceiling); ${hint}`);
      return;
    }
    log(`GitLab returned 429; retrying in ${Math.ceil(wait / 1000)}s`);
    // Sleep out the whole wait in capped chunks; only the DELETE after it counts as an attempt.
    await sleepInChunks(wait, sleep);
    waited += wait;
  }
}
