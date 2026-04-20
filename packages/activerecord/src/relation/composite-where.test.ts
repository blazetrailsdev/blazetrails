/**
 * Composite-key WHERE: `Relation#where(cols, tuples)` and the
 * underlying `PredicateBuilder.buildComposite(cols, tuples)`.
 *
 * Rails uses `where({[col1, col2] => [[v1, v2], ...]})` for
 * composite-key matching, routing through PredicateBuilder. JS object
 * keys can't be arrays, so we expose the same shape as a positional
 * overload — `where(['c1', 'c2'], [[v1a, v1b], ...])` — and a
 * matching `PredicateBuilder.buildComposite` method.
 *
 * Mirrors: ActiveRecord predicate-builder composite-key handling.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { Base, registerModel } from "../index.js";
import { createTestAdapter } from "../test-adapter.js";
import type { DatabaseAdapter } from "../adapter.js";

describe("Relation#where — composite-key form", () => {
  let adapter: DatabaseAdapter;

  class CompOrder extends Base {
    static {
      this._tableName = "comp_orders";
      this.primaryKey = ["shop_id", "order_number"];
      this.attribute("shop_id", "integer");
      this.attribute("order_number", "integer");
      this.attribute("name", "string");
    }
  }

  beforeEach(() => {
    adapter = createTestAdapter();
    CompOrder.adapter = adapter;
    registerModel("CompOrder", CompOrder);
  });

  it("compiles `where(['c1','c2'], [[v1a,v1b], [v2a,v2b]])` to OR-of-AND of column equalities", async () => {
    await CompOrder.create({ shop_id: 1, order_number: 100, name: "match-1" });
    await CompOrder.create({ shop_id: 2, order_number: 200, name: "match-2" });
    await CompOrder.create({ shop_id: 1, order_number: 999, name: "no-match" });

    const matched = await (CompOrder as any)
      .where(
        ["shop_id", "order_number"],
        [
          [1, 100],
          [2, 200],
        ],
      )
      .toArray();
    expect(matched.map((r: any) => r.name).sort()).toEqual(["match-1", "match-2"]);
  });

  it("returns no rows when all tuples are filtered (empty after null-strip → none())", async () => {
    await CompOrder.create({ shop_id: 1, order_number: 100, name: "exists" });
    const matched = await (CompOrder as any)
      .where(
        ["shop_id", "order_number"],
        [
          [1, null],
          [null, 200],
        ],
      )
      .toArray();
    expect(matched).toEqual([]);
  });

  it("filters null/undefined-bearing tuples instead of emitting IS NULL (SQL tuple-equality semantics)", async () => {
    await CompOrder.create({ shop_id: 1, order_number: 100, name: "valid" });
    await CompOrder.create({ shop_id: 2, order_number: 200, name: "also-valid" });
    // [1, null] is filtered out; [2, 200] remains.
    const matched = await (CompOrder as any)
      .where(
        ["shop_id", "order_number"],
        [
          [1, null],
          [2, 200],
        ],
      )
      .toArray();
    expect(matched.map((r: any) => r.name)).toEqual(["also-valid"]);
  });

  it("single-column case (cols.length === 1) still works (degenerate composite)", async () => {
    await CompOrder.create({ shop_id: 1, order_number: 100, name: "a" });
    await CompOrder.create({ shop_id: 1, order_number: 200, name: "b" });
    const matched = await (CompOrder as any).where(["shop_id"], [[1]]).toArray();
    expect(matched.map((r: any) => r.name).sort()).toEqual(["a", "b"]);
  });

  it("PredicateBuilder.buildComposite returns null on empty input (caller short-circuits with none())", async () => {
    const rel = (CompOrder as any).all();
    const node = rel.predicateBuilder.buildComposite(["shop_id", "order_number"], []);
    expect(node).toBeNull();
  });

  it("PredicateBuilder.buildComposite throws on empty column list", () => {
    const rel = (CompOrder as any).all();
    expect(() => rel.predicateBuilder.buildComposite([], [[1, 2]])).toThrow(/empty column list/);
  });
});
