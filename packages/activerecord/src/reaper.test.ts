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

describe("ReaperTest", () => {
  afterEach(() => {
    // Clean up any registered timers by accessing private static state
    // This prevents timer leaks across tests
    (Reaper as any)._timers.forEach((timer: any) => clearInterval(timer));
    (Reaper as any)._timers.clear();
    (Reaper as any)._pools.clear();
  });

  it("nil time", () => {
    const pool = makePool();
    const reaper = new Reaper(pool, 0);
    reaper.run();
    expect(reaper.frequency).toBe(0);
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

  it("connection pool starts reaper", () => {
    const pool = makePool();
    const reaper = new Reaper(pool, 0.001);
    reaper.run();
    // Reaper should have registered the pool
    expect((Reaper as any)._pools.size).toBe(1);
  });

  it.skip("reaper works after pool discard", () => {});

  it("reap flush on discarded pool", async () => {
    const pool = makePool();
    pool._discarded = true;
    const reaper = new Reaper(pool, 0.001);
    reaper.run();
    // Wait for one tick
    await new Promise((r) => setTimeout(r, 10));
    expect(pool.reaped).toBe(0);
    expect(pool.flushed).toBe(0);
  });

  it.skip("connection pool starts reaper in fork", () => {});

  it("reaper does not reap discarded connection pools", async () => {
    const pool = makePool();
    const reaper = new Reaper(pool, 0.001);
    reaper.run();
    pool._discarded = true;
    // Wait for reaper cycle
    await new Promise((r) => setTimeout(r, 10));
    // After being marked discarded, the pool should not be reaped
    expect(pool.reaped).toBe(0);
  });
});
