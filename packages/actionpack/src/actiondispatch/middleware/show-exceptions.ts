/**
 * ActionDispatch::ShowExceptions
 *
 * Middleware that catches exceptions and renders error pages.
 * Checks the `action_dispatch.show_exceptions` env variable to decide
 * whether to show an error page (:all), only for rescuable exceptions
 * (:rescuable), or re-raise (:none).
 */

import type { RackApp, RackEnv, RackResponse } from "@blazetrails/rack";
import { ExceptionWrapper } from "../exception-wrapper.js";

export type ShowExceptionsMode = "all" | "rescuable" | "none";

export class ShowExceptions {
  private app: RackApp;
  private exceptionsApp: RackApp;

  constructor(app: RackApp, exceptionsApp: RackApp) {
    this.app = app;
    this.exceptionsApp = exceptionsApp;
  }

  async call(env: RackEnv): Promise<RackResponse> {
    const mode = (env["action_dispatch.show_exceptions"] as ShowExceptionsMode) ?? "none";

    try {
      return await this.app(env);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      if (mode === "none") {
        throw err;
      }

      const wrapper = new ExceptionWrapper(err);

      if (mode === "rescuable" && !wrapper.show("rescuable")) {
        throw err;
      }

      env["action_dispatch.exception"] = err;
      env["action_dispatch.original_path"] = env["PATH_INFO"];
      env["PATH_INFO"] = `/${wrapper.statusCode}`;

      try {
        const response = await this.exceptionsApp(env);
        const cascade = response[1]["x-cascade"] ?? response[1]["X-Cascade"];
        if (cascade === "pass") {
          return [wrapper.statusCode, { "content-type": "text/plain" }, []];
        }
        return response;
      } catch {
        return this.failsafeResponse(wrapper);
      }
    }
  }

  private failsafeResponse(wrapper: ExceptionWrapper): RackResponse {
    const body = `${wrapper.statusCode} ${wrapper.statusText}\n`;
    return [500, { "content-type": "text/plain; charset=utf-8" }, [body]];
  }
}
