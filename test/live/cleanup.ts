const MAX_ATTEMPTS = 5;
const MAX_WAIT_MS = 30_000;

export interface DeleteScratchIo {
  sleep?: (ms: number) => Promise<void>;
  log?: (line: string) => void;
  now?: () => number;
}

function retryDelayMs(response: Response, attempt: number, now: number): number {
  const retryAfter = response.headers.get("retry-after");
  let ms = Number.NaN;
  if (retryAfter !== null && retryAfter.trim() !== "") {
    const seconds = Number(retryAfter);
    ms = Number.isNaN(seconds) ? Date.parse(retryAfter) - now : seconds * 1000;
  }
  const reset = response.headers.get("ratelimit-reset");
  if (Number.isNaN(ms) && reset !== null && reset.trim() !== "") {
    ms = Number(reset) * 1000 - now;
  }
  if (Number.isNaN(ms)) ms = 1000 * 2 ** attempt;
  return Math.min(Math.max(ms, 0), MAX_WAIT_MS);
}

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
  for (let attempt = 0; ; attempt++) {
    const response = await send();
    if (response.ok || response.status === 404) return;
    if (response.status !== 429 || attempt + 1 >= MAX_ATTEMPTS) {
      log(`could not delete ${what} (${response.status}); ${hint}`);
      return;
    }
    await sleep(retryDelayMs(response, attempt, now()));
  }
}
