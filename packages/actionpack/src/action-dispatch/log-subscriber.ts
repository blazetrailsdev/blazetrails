import {
  LogSubscriber as BaseLogSubscriber,
  NotificationEvent as Event,
} from "@blazetrails/activesupport";

const REDIRECT_STATUS_TEXT: Record<number, string> = {
  300: "Multiple Choices",
  301: "Moved Permanently",
  302: "Found",
  303: "See Other",
  304: "Not Modified",
  305: "Use Proxy",
  306: "Switch Proxy",
  307: "Temporary Redirect",
  308: "Permanent Redirect",
};

export class LogSubscriber extends BaseLogSubscriber {
  redirect(event: Event): void {
    const payload = event.payload as { location?: string; status?: number };
    this._info(`Redirected to ${payload.location ?? ""}`);

    const status = payload.status ?? 302;
    const statusText = REDIRECT_STATUS_TEXT[status] ?? "";
    this._info(`Completed ${status} ${statusText} in ${Math.round(event.duration)}ms`);
  }
}
