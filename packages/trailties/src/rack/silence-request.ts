/**
 * Rails::Rack::SilenceRequest — silences requests to a specific path
 * (e.g. `/up` health checks) so they don't clog the log.
 *
 * Port of `railties/lib/rails/rack/silence_request.rb`.
 */

import type { RackApp, RackEnv, RackResponse } from "@blazetrails/rack";

export interface Silencer {
  silence<T>(level: number | string, fn: () => T): T;
  silenceAsync?<T>(level: number | string, fn: () => Promise<T>): Promise<T>;
}

// Rails' Rack::SilenceRequest calls `Rails.logger.silence { ... }` with no
// argument, which defaults to ActiveSupport::Logger::ERROR (= 3).
const ERROR_LEVEL = 3;

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
        return logger.silenceAsync(ERROR_LEVEL, () => this.app(env));
      }
      return logger.silence(ERROR_LEVEL, () => this.app(env));
    }
    return this.app(env);
  }
}
