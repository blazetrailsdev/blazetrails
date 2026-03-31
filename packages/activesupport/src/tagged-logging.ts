/**
 * TaggedLogging — wraps a Logger to prepend tags to messages.
 * Mirrors ActiveSupport::TaggedLogging.
 */

import { isBlank } from "./string-utils.js";

export class TagStack {
  private _tags: string[] = [];
  private _tagsString: string | null = null;

  get tags(): string[] {
    return [...this._tags];
  }

  pushTags(tags: (string | string[] | null | undefined)[]): string[] {
    this._tagsString = null;
    const flat = (tags as unknown[])
      .flat(Infinity)
      .filter((t): t is string => typeof t === "string" && !isBlank(t));
    this._tags.push(...flat);
    return flat;
  }

  popTags(count: number = 1): string[] {
    this._tagsString = null;
    return this._tags.splice(-count, count);
  }

  clear(): void {
    this._tagsString = null;
    this._tags.length = 0;
  }

  formatMessage(message: string): string {
    if (this._tags.length === 0) {
      return message;
    } else if (this._tags.length === 1) {
      return `[${this._tags[0]}] ${message}`;
    } else {
      if (this._tagsString === null) {
        this._tagsString = `[${this._tags.join("] [")}] `;
      }
      return `${this._tagsString}${message}`;
    }
  }
}

export namespace Formatter {
  export function call(
    tagStack: TagStack,
    severity: string,
    _timestamp: Date,
    _progname: string | null,
    msg: string,
  ): string {
    return tagStack.formatMessage(msg);
  }

  export function tagged(tagStack: TagStack, tags: string[], fn: () => void): void {
    const pushed = tagStack.pushTags(tags);
    try {
      fn();
    } finally {
      tagStack.popTags(pushed.length);
    }
  }

  export function pushTags(tagStack: TagStack, tags: (string | string[])[]): string[] {
    return tagStack.pushTags(tags);
  }

  export function popTags(tagStack: TagStack, count: number = 1): string[] {
    return tagStack.popTags(count);
  }

  export function clearTags(tagStack: TagStack): void {
    tagStack.clear();
  }

  export function currentTags(tagStack: TagStack): string[] {
    return tagStack.tags;
  }
}

export namespace LocalTagStorage {
  export function create(): { tagStack: TagStack } {
    return { tagStack: new TagStack() };
  }
}

import { Logger, taggedLogging as _taggedLogging } from "./logger.js";
import type { TaggedLogger } from "./logger.js";

export namespace TaggedLogging {
  export function create(logger: Logger): TaggedLogger {
    return _taggedLogging(logger);
  }

  export function logger(output: { write(s: string): void }): TaggedLogger {
    return _taggedLogging(new Logger(output));
  }
}
