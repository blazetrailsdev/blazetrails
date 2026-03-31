import { Table, Nodes } from "@blazetrails/arel";
import { Range } from "../connection-adapters/postgresql/oid/range.js";
import { ArrayHandler } from "./predicate-builder/array-handler.js";
import { RangeHandler } from "./predicate-builder/range-handler.js";
import { BasicObjectHandler } from "./predicate-builder/basic-object-handler.js";
import { RelationHandler } from "./predicate-builder/relation-handler.js";

/**
 * Converts hash conditions ({ name: "dean", age: 30 }) into
 * Arel predicate nodes. Used by Relation to build WHERE clauses.
 *
 * Mirrors: ActiveRecord::PredicateBuilder
 */
export class PredicateBuilder {
  readonly table: Table;
  private arrayHandler: ArrayHandler;
  private rangeHandler: RangeHandler;
  private basicObjectHandler: BasicObjectHandler;
  private relationHandler: RelationHandler;

  constructor(table: Table) {
    this.table = table;
    this.arrayHandler = new ArrayHandler(this);
    this.rangeHandler = new RangeHandler();
    this.basicObjectHandler = new BasicObjectHandler();
    this.relationHandler = new RelationHandler();
  }

  buildFromHash(conditions: Record<string, unknown>): Nodes.Node[] {
    const nodes: Nodes.Node[] = [];
    for (const [key, value] of Object.entries(conditions)) {
      const attr = this.resolveColumn(key);
      nodes.push(this.build(attr, value));
    }
    return nodes;
  }

  buildNegatedFromHash(conditions: Record<string, unknown>): Nodes.Node[] {
    const nodes: Nodes.Node[] = [];
    for (const [key, value] of Object.entries(conditions)) {
      const attr = this.resolveColumn(key);
      if (value === null) {
        nodes.push(attr.isNotNull());
      } else if (value instanceof Range) {
        nodes.push(attr.notBetween(value.begin, value.end));
      } else if (Array.isArray(value)) {
        nodes.push(attr.notIn(value));
      } else {
        nodes.push(attr.notEq(value));
      }
    }
    return nodes;
  }

  build(attribute: Nodes.Attribute, value: unknown): Nodes.Node {
    if (value === null || value === undefined) {
      return attribute.isNull();
    }
    if (value instanceof Range) {
      return this.rangeHandler.call(attribute, value);
    }
    if (Array.isArray(value)) {
      return this.arrayHandler.call(attribute, value);
    }
    if (this.isRelation(value)) {
      return this.relationHandler.call(attribute, value);
    }
    return this.basicObjectHandler.call(attribute, value);
  }

  buildRangePredicate(attribute: Nodes.Attribute, range: Range): Nodes.Node {
    return this.rangeHandler.call(attribute, range);
  }

  resolveColumn(key: string): Nodes.Attribute {
    return PredicateBuilder.resolveColumn(this.table, key);
  }

  static resolveColumn(table: Table, key: string): Nodes.Attribute {
    if (key.includes('"')) return table.get(key);
    const firstDot = key.indexOf(".");
    if (firstDot === -1) return table.get(key);
    const secondDot = key.indexOf(".", firstDot + 1);
    if (secondDot !== -1) return table.get(key);
    return new Table(key.slice(0, firstDot)).get(key.slice(firstDot + 1));
  }

  private isRelation(value: unknown): boolean {
    return (
      typeof value === "object" && value !== null && "_modelClass" in value && "toArel" in value
    );
  }
}
