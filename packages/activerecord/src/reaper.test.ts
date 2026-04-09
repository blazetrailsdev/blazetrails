import { describe, it, expect, afterEach } from "vitest";
import { Reaper } from "./connection-adapters/abstract/connection-pool/reaper.js";
import type { ReapablePool } from "./connection-adapters/abstract/connection-pool/reaper.js";

function makePool(): ReapablePool & {
  reaped: number;
  flushed: number;
  _discarded: boolean;
} {
  return {
    reaped: 0,
    flushed: 0,
    _discarded: false,
    reap() {
      this.reaped++;
    },
    flush() {
      this.flushed++;
    },
    isDiscarded() {
      return this._discarded;
    },
  };
}

function clearReaperState() {
  (Reaper as any)._timers.forEach((timer: any) => clearInterval(timer));
  (Reaper as any)._timers.clear();
  (Reaper as any)._pools.clear();
}

describe("ReaperTest", () => {
  afterEach(clearReaperState);

  it("nil time", () => {
    const pool = makePool();
    const reaper = new Reaper(pool, 0);
    reaper.run();
    // With frequency 0, run() should be a no-op — no timers registered
    expect((Reaper as any)._pools.size).toBe(0);
    expect((Reaper as any)._timers.size).toBe(0);
  });

  it("some time", () => {
    const pool = makePool();
    const reaper = new Reaper(pool, 60);
    expect(reaper.frequency).toBe(60);
    expect(reaper.pool).toBe(pool);
  });

  it("pool has reaper", () => {
    const pool = makePool();
    const reaper = new Reaper(pool, 60);
    expect(reaper.pool).toBe(pool);
  });

  it("reaping frequency configuration", () => {
    const pool = makePool();
    const reaper = new Reaper(pool, 100);
    expect(reaper.frequency).toBe(100);
  });

  it("connection pool starts reaper", async () => {
    const pool = makePool();
    const reaper = new Reaper(pool, 0.001);
    reaper.run();
    expect((Reaper as any)._pools.size).toBe(1);
    // Wait for the timer to fire at least once
    await new Promise((r) => setTimeout(r, 15));
    expect(pool.reaped).toBeGreaterThanOrEqual(1);
    expect(pool.flushed).toBeGreaterThanOrEqual(1);
  });

  it("reaper works after pool discard", async () => {
    const pool1 = makePool();
    const pool2 = makePool();
    const freq = 0.001;

    // Register two pools at the same frequency
    new Reaper(pool1, freq).run();
    new Reaper(pool2, freq).run();

    await new Promise((r) => setTimeout(r, 15));
    expect(pool1.reaped).toBeGreaterThanOrEqual(1);
    expect(pool2.reaped).toBeGreaterThanOrEqual(1);

    // Discard pool1 — pool2 should keep getting reaped
    const pool1Reaped = pool1.reaped;
    pool1._discarded = true;

    await new Promise((r) => setTimeout(r, 15));
    // pool1 should not have been reaped again
    expect(pool1.reaped).toBe(pool1Reaped);
    // pool2 should still be reaped
    expect(pool2.reaped).toBeGreaterThan(1);
  });

  it("reap flush on discarded pool", async () => {
    const pool = makePool();
    pool._discarded = true;
    const reaper = new Reaper(pool, 0.001);
    reaper.run();
    await new Promise((r) => setTimeout(r, 15));
    // Discarded pools are filtered out before reap/flush
    expect(pool.reaped).toBe(0);
    expect(pool.flushed).toBe(0);
  });

  it.skip("connection pool starts reaper in fork", () => {
    // N/A: Node.js does not fork processes the way Ruby does
  });

  it("reaper does not reap discarded connection pools", async () => {
    const pool = makePool();
    const reaper = new Reaper(pool, 0.001);
    reaper.run();

    // Immediately mark as discarded before first tick
    pool._discarded = true;
    await new Promise((r) => setTimeout(r, 15));

    expect(pool.reaped).toBe(0);
    expect(pool.flushed).toBe(0);
  });
});
