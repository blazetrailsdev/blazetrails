/**
 * Callback types.
 */
export type CallbackFn = (record: any) => void | boolean | Promise<void | boolean>;
export type AroundCallbackFn = (record: any, proceed: () => void) => void;

export type CallbackTiming = "before" | "after" | "around";
export type CallbackEvent = string;

interface CallbackEntry {
  timing: CallbackTiming;
  event: CallbackEvent;
  fn: CallbackFn | AroundCallbackFn;
}

/**
 * Callbacks mixin — lifecycle hooks on models.
 *
 * Mirrors: ActiveModel::Callbacks
 */
export class CallbackChain {
  private callbacks: CallbackEntry[] = [];

  register(
    timing: CallbackTiming,
    event: CallbackEvent,
    fn: CallbackFn | AroundCallbackFn
  ): void {
    this.callbacks.push({ timing, event, fn });
  }

  /**
   * Run callbacks for a given event around a block.
   * Returns false if a before callback returns false (halting the chain).
   */
  run(event: CallbackEvent, record: any, block: () => void): boolean {
    // Before callbacks
    const befores = this.callbacks.filter(
      (c) => c.timing === "before" && c.event === event
    );
    for (const cb of befores) {
      const result = (cb.fn as CallbackFn)(record);
      if (result === false) return false;
    }

    // Around callbacks wrap the block
    const arounds = this.callbacks.filter(
      (c) => c.timing === "around" && c.event === event
    );

    let chain = block;
    for (const cb of [...arounds].reverse()) {
      const prev = chain;
      chain = () => (cb.fn as AroundCallbackFn)(record, prev);
    }
    chain();

    // After callbacks
    const afters = this.callbacks.filter(
      (c) => c.timing === "after" && c.event === event
    );
    for (const cb of afters) {
      (cb.fn as CallbackFn)(record);
    }

    return true;
  }
}
