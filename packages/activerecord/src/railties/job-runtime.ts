/**
 * JobRuntime — instruments ActiveJob with ActiveRecord SQL runtime tracking.
 *
 * Mirrors: ActiveRecord::Railties::JobRuntime (railties/job_runtime.rb)
 *
 * Mix this into an ActiveJob class to track DB time used per job and expose
 * it in the job's instrumentation payload as `dbRuntime`.
 */
import * as RuntimeRegistry from "../runtime-registry.js";

/**
 * @internal
 */
export function instrument(
  this: { instrument: typeof instrument },
  operation: string,
  payload: Record<string, unknown> = {},
  block?: () => unknown,
): unknown {
  if (operation === "perform" && block) {
    return this.instrument(operation, payload, () => {
      const runtimeBefore = RuntimeRegistry.stats().sqlRuntime;
      const result = block();
      payload["dbRuntime"] = RuntimeRegistry.stats().sqlRuntime - runtimeBefore;
      return result;
    });
  }
  return block ? block() : undefined;
}

/**
 * Mirrors: ActiveRecord::Railties::JobRuntime
 */
export const JobRuntime = { instrument };
