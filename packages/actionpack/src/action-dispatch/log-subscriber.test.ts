import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { LogSubscriber as BaseLogSubscriber, NotificationEvent } from "@blazetrails/activesupport";
import { LogSubscriber } from "./log-subscriber.js";

class CaptureLogger {
  messages: string[] = [];
  info(msg: string): void {
    this.messages.push(msg);
  }
  // BaseLogSubscriber consults logger.info? / debug? to gate emission.
  // Returning true ensures _info() actually writes.
  get "info?"(): boolean {
    return true;
  }
  get "debug?"(): boolean {
    return true;
  }
}

function makeEvent(payload: Record<string, unknown>, duration = 12): NotificationEvent {
  const ev = Object.create(NotificationEvent.prototype) as NotificationEvent;
  Object.assign(ev, {
    name: "redirect.action_dispatch",
    transactionId: "x",
    time: new Date(),
    endTime: new Date(),
    payload,
    children: [],
  });
  Object.defineProperty(ev, "duration", { value: duration, configurable: true });
  return ev;
}

describe("ActionDispatch::LogSubscriber#redirect", () => {
  let subscriber: LogSubscriber;
  let logger: CaptureLogger;
  let savedLogger: unknown;

  beforeEach(() => {
    subscriber = new LogSubscriber();
    logger = new CaptureLogger();
    savedLogger = BaseLogSubscriber.logger;
    BaseLogSubscriber.logger = logger as never;
  });

  afterEach(() => {
    BaseLogSubscriber.logger = savedLogger as never;
  });

  it("emits Redirected-to and Completed-status lines", () => {
    subscriber.redirect(makeEvent({ location: "/posts", status: 302 }, 12));
    expect(logger.messages).toEqual(["Redirected to /posts", "Completed 302 Found in 12ms"]);
  });

  it("defaults status to 302 Found when missing", () => {
    subscriber.redirect(makeEvent({ location: "/x" }, 8));
    expect(logger.messages[1]).toBe("Completed 302 Found in 8ms");
  });

  it("handles permanent redirect (301)", () => {
    subscriber.redirect(makeEvent({ location: "/p", status: 301 }, 5));
    expect(logger.messages[1]).toBe("Completed 301 Moved Permanently in 5ms");
  });

  it("falls back to empty reason phrase for non-3xx status", () => {
    subscriber.redirect(makeEvent({ location: "/x", status: 200 }, 1));
    expect(logger.messages[1]).toBe("Completed 200  in 1ms");
  });

  it("rounds non-integer duration", () => {
    subscriber.redirect(makeEvent({ location: "/r", status: 302 }, 3.7));
    expect(logger.messages[1]).toBe("Completed 302 Found in 4ms");
  });
});
