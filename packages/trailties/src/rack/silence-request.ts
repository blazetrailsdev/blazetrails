/**
 * Rails::Rack::SilenceRequest — silences requests to a specific path
 * (e.g. `/up` health checks) so they don't clog the log.
 *
 * Port of `railties/lib/rails/rack/silence_request.rb`.
 */

import type { RackApp, RackEnv, RackResponse } from "@blazetrails/rack";

export interface Silencer {
  silence(level: number | string, fn: () => void): void;
  silenceAsync?(level: number | string, fn: () => Promise<unknown>): Promise<unknown>;
}

export interface SilenceRequestOptions {
  path: string;
  logger?: Silencer;
}

export class SilenceRequest {
  private app: RackApp;
  private path: string;
  private logger?: Silencer;

  constructor(app: RackApp, options: SilenceRequestOptions) {
    this.app = app;
    this.path = options.path;
    this.logger = options.logger;
  }

  async call(env: RackEnv): Promise<RackResponse> {
    if (env["PATH_INFO"] === this.path && this.logger) {
      const logger = this.logger;
      if (logger.silenceAsync) {
        return (await logger.silenceAsync(2, () => this.app(env))) as RackResponse;
      }
      let pending: Promise<RackResponse> | undefined;
      logger.silence(2, () => {
        pending = this.app(env);
      });
      return pending!;
    }
    return this.app(env);
  }
}
