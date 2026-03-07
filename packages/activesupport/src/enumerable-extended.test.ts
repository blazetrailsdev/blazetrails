import { describe, it, expect } from "vitest";
import {
  sum,
  indexBy,
  groupBy,
  minimum,
  maximum,
  compactBlank,
  many,
  tally,
  filterMap,
  excluding,
  including,
  minBy,
  maxBy,
  eachCons,
  eachSlice,
  inOrderOf,
} from "./enumerable-utils.js";

// Helpers mirroring Rails test structs
interface Payment {
  price: number;
}
const pay = (price: number): Payment => ({ price });

describe("EnumerableTests", () => {
  it("minimum", () => {
    const payments = [pay(5), pay(15), pay(10)];
    expect(minimum(payments, (p) => p.price)).toBe(5);
  });

  it("minimum with empty", () => {
    expect(minimum([], (p: Payment) => p.price)).toBeUndefined();
  });

  it("maximum", () => {
    const payments = [pay(5), pay(15), pay(10)];
    expect(maximum(payments, (p) => p.price)).toBe(15);
  });

  it("maximum with empty", () => {
    expect(maximum([], (p: Payment) => p.price)).toBeUndefined();
  });

  it("sums numbers", () => {
    expect(sum([5, 15, 10])).toBe(30);
  });

  it("sums with mapper", () => {
    const payments = [pay(5), pay(15), pay(10)];
    expect(sum(payments, (p) => p.price)).toBe(30);
    expect(sum(payments, (p) => p.price * 2)).toBe(60);
  });

  it("empty sum returns 0", () => {
    expect(sum([])).toBe(0);
  });

  it("index_by", () => {
    const payments = [pay(5), pay(15), pay(10)];
    const indexed = indexBy(payments, (p) => p.price);
    expect(indexed[5]).toEqual(pay(5));
    expect(indexed[15]).toEqual(pay(15));
    expect(indexed[10]).toEqual(pay(10));
  });

  it("many — false when empty", () => {
    expect(many([])).toBe(false);
  });

  it("many — false when one element", () => {
    expect(many([1])).toBe(false);
  });

  it("many — true when two or more elements", () => {
    expect(many([1, 2])).toBe(true);
  });

  it("many with predicate — false when zero match", () => {
    expect(many([1, 2], (x) => x > 99)).toBe(false);
  });

  it("many with predicate — false when one matches", () => {
    expect(many([1, 2], (x) => x > 1)).toBe(false);
  });

  it("many with predicate — true when two or more match", () => {
    expect(many([1, 2, 3], (x) => x > 1)).toBe(true);
  });

  it("exclude — true when element not present", () => {
    expect([1, 2, 3].includes(4)).toBe(false);
  });

  it("excluding — removes specified elements", () => {
    expect(excluding([1, 2, 3, 4, 5], 3, 5)).toEqual([1, 2, 4]);
  });

  it("excluding — removes array of elements", () => {
    expect(excluding([1, 2, 3, 4, 5], ...[1, 2])).toEqual([3, 4, 5]);
  });

  it("including — appends elements", () => {
    expect(including([1, 2, 3], 4, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it("tally — counts occurrences", () => {
    expect(tally(["a", "b", "a", "c", "b", "a"])).toEqual({ a: 3, b: 2, c: 1 });
  });

  it("tally — empty array", () => {
    expect(tally([])).toEqual({});
  });

  it("filterMap — maps and removes nullish results", () => {
    const result = filterMap([1, 2, 3, 4], (x) => (x % 2 === 0 ? x * 10 : null));
    expect(result).toEqual([20, 40]);
  });

  it("filterMap — empty array", () => {
    expect(filterMap([], (x: number) => x)).toEqual([]);
  });

  it("minBy — finds element with minimum mapped value", () => {
    const payments = [pay(5), pay(15), pay(10)];
    expect(minBy(payments, (p) => p.price)).toEqual(pay(5));
  });

  it("minBy — undefined for empty", () => {
    expect(minBy([], (p: Payment) => p.price)).toBeUndefined();
  });

  it("maxBy — finds element with maximum mapped value", () => {
    const payments = [pay(5), pay(15), pay(10)];
    expect(maxBy(payments, (p) => p.price)).toEqual(pay(15));
  });

  it("maxBy — undefined for empty", () => {
    expect(maxBy([], (p: Payment) => p.price)).toBeUndefined();
  });

  it("groupBy — groups by key function", () => {
    const items = [
      { type: "a", v: 1 },
      { type: "b", v: 2 },
      { type: "a", v: 3 },
    ];
    const grouped = groupBy(items, (x) => x.type);
    expect(grouped["a"]).toHaveLength(2);
    expect(grouped["b"]).toHaveLength(1);
  });

  it("compact_blank — removes blank values", () => {
    const values = [1, "", null, 2, " ", [], false, true] as unknown[];
    const result = compactBlank(values as string[]);
    expect(result).toContain(1);
    expect(result).toContain(2);
    expect(result).toContain(true);
    expect(result).not.toContain("");
    expect(result).not.toContain(null);
  });

  it("eachCons — sliding window", () => {
    expect(eachCons([1, 2, 3, 4], 2)).toEqual([[1, 2], [2, 3], [3, 4]]);
    expect(eachCons([1, 2, 3], 3)).toEqual([[1, 2, 3]]);
  });

  it("eachCons — window larger than array returns empty", () => {
    expect(eachCons([1, 2], 3)).toEqual([]);
  });

  it("eachSlice — chunks array", () => {
    expect(eachSlice([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(eachSlice([1, 2, 3], 3)).toEqual([[1, 2, 3]]);
  });

  it("eachSlice — empty array", () => {
    expect(eachSlice([], 2)).toEqual([]);
  });

  it("in_order_of — reorders by series", () => {
    const values = [pay(5), pay(1), pay(3)];
    const result = inOrderOf(values, (p) => p.price, [1, 5, 3]);
    expect(result.map((p) => p.price)).toEqual([1, 5, 3]);
  });

  it("in_order_of — ignores missing series values", () => {
    const values = [pay(5), pay(1), pay(3)];
    const result = inOrderOf(values, (p) => p.price, [1, 2, 4, 5, 3]);
    expect(result.map((p) => p.price)).toEqual([1, 5, 3]);
  });

  it("in_order_of — drops elements not in series by default", () => {
    const values = [pay(5), pay(1), pay(3)];
    const result = inOrderOf(values, (p) => p.price, [1, 5]);
    expect(result.map((p) => p.price)).toEqual([1, 5]);
  });

  it("in_order_of — with filter false keeps unmatched elements", () => {
    const values = [pay(5), pay(3), pay(1)];
    const result = inOrderOf(values, (p) => p.price, [1, 5], { filter: false });
    expect(result.map((p) => p.price)).toEqual([1, 5, 3]);
  });
});
