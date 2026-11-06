/**
 * Admission control for the layout optimiser.
 *
 * The optimiser is CPU-bound (1-8 s per plan). Running many at once on one server instance just makes every user wait
 * for everyone else, so we let a few run and turn the rest away quickly with a clear "busy, try again" instead of
 * letting requests pile up until they time out. Limits are per server instance (per serverless instance when deployed).
 */
export class BusyError extends Error {
  readonly retryAfterSeconds: number;
  constructor(retryAfterSeconds = 5) {
    super('The planner is busy with other requests. Please try again in a few seconds.');
    this.name = 'BusyError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

let inFlight = 0;
const limit = () => Math.max(1, Number(process.env.ARCHADAPT_MAX_CONCURRENT_PLANS) || 6);

export function plannerLoad(): { inFlight: number; limit: number } {
  return { inFlight, limit: limit() };
}

/** Runs `fn` if there is capacity, otherwise throws BusyError without running it. */
export async function admitted<T>(fn: () => Promise<T>): Promise<T> {
  if (inFlight >= limit()) throw new BusyError();
  inFlight += 1;
  try {
    return await fn();
  } finally {
    inFlight -= 1;
  }
}
