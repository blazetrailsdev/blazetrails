export interface Event {
  name: string;
  payload: Record<string, unknown>;
  duration: number;
}

const HTTP_STATUS_CODES: Record<number, string> = {
  301: "Moved Permanently",
  302: "Found",
  303: "See Other",
  307: "Temporary Redirect",
  308: "Permanent Redirect",
};

export class LogSubscriber {
  private _logger: { info(msg: string): void } | null;

  constructor(logger?: { info(msg: string): void }) {
    this._logger = logger ?? null;
  }

  redirect(event: Event): void {
    const payload = event.payload as { location?: string; status?: number };
    this._logger?.info(`Redirected to ${payload.location ?? ""}`);
    const status = payload.status ?? 302;
    const statusText = HTTP_STATUS_CODES[status] ?? "";
    this._logger?.info(`Completed ${status} ${statusText} in ${Math.round(event.duration)}ms`);
  }

  get logger(): { info(msg: string): void } | null {
    return this._logger;
  }
}
