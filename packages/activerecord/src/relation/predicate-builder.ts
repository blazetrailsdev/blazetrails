import { Table, Nodes } from "@blazetrails/arel";
import { Range } from "../connection-adapters/postgresql/oid/range.js";
import { ArrayHandler } from "./predicate-builder/array-handler.js";
import { RangeHandler } from "./predicate-builder/range-handler.js";
import { BasicObjectHandler } from "./predicate-builder/basic-object-handler.js";
import { RelationHandler } from "./predicate-builder/relation-handler.js";
import { AssociationQueryValue } from "./predicate-builder/association-query-value.js";
import { PolymorphicArrayValue } from "./predicate-builder/polymorphic-array-value.js";

/**
 * Converts hash conditions ({ name: "dean", age: 30 }) into
 * Arel predicate nodes. Used by Relation to build WHERE clauses.
 *
 * Mirrors: ActiveRecord::PredicateBuilder
 */
export interface AssociationMapping {
  foreignKey: string;
  foreignType?: string;
}

export class PredicateBuilder {
  readonly table: Table;
  private arrayHandler: ArrayHandler;
  private rangeHandler: RangeHandler;
  private basicObjectHandler: BasicObjectHandler;
  private relationHandler: RelationHandler;
  private associationMap: Map<string, AssociationMapping>;

  constructor(table: Table, associationMap?: Map<string, AssociationMapping>) {
    this.table = table;
    this.arrayHandler = new ArrayHandler(this);
    this.rangeHandler = new RangeHandler();
    this.basicObjectHandler = new BasicObjectHandler();
    this.relationHandler = new RelationHandler();
    this.associationMap = associationMap ?? new Map();
  }

  buildFromHash(conditions: Record<string, unknown>): Nodes.Node[] {
    const nodes: Nodes.Node[] = [];
    for (const [key, value] of Object.entries(conditions)) {
      const assoc = this.associationMap.get(key);
      if (assoc && this.isAssociationValue(value)) {
        const expandedConditions = this.expandAssociationCondition(assoc, value);
        for (const cond of expandedConditions) {
          nodes.push(...this.buildFromHash(cond));
        }
      } else {
        const attr = this.resolveColumn(key);
        nodes.push(this.build(attr, value));
      }
    }
    return nodes;
  }

  private isAssociationValue(value: unknown): boolean {
    if (value === null) return true;
    if (Array.isArray(value)) {
      return value.length === 0 || value.some((v) => this.isModelInstance(v));
    }
    return this.isModelInstance(value);
  }

  private isModelInstance(value: unknown): boolean {
    return typeof value === "object" && value !== null && "id" in value && "constructor" in value;
  }

  private expandAssociationCondition(
    assoc: AssociationMapping,
    value: unknown,
  ): Record<string, unknown>[] {
    if (assoc.foreignType && Array.isArray(value)) {
      return new PolymorphicArrayValue(assoc.foreignKey, assoc.foreignType, value).queries();
    }
    return new AssociationQueryValue(assoc.foreignKey, value).queries();
  }

  buildNegatedFromHash(conditions: Record<string, unknown>): Nodes.Node[] {
    const nodes: Nodes.Node[] = [];
    for (const [key, value] of Object.entries(conditions)) {
      const attr = this.resolveColumn(key);
      nodes.push(this.buildNegated(attr, value));
    }
    return nodes;
  }

  buildNegated(attribute: Nodes.Attribute, value: unknown): Nodes.Node {
    if (value === null || value === undefined) {
      return attribute.isNotNull();
    }
    if (value instanceof Range) {
      const beginVal = value.begin;
      const endVal = value.end;
      if (beginVal === null || beginVal === undefined) {
        if (endVal === null || endVal === undefined) return attribute.isNull();
        return value.excludeEnd ? attribute.gteq(endVal) : attribute.gt(endVal);
      }
      if (endVal === null || endVal === undefined) {
        return attribute.lt(beginVal);
      }
      return attribute.notBetween(beginVal, endVal);
    }
    if (Array.isArray(value)) {
      return this.buildNegatedArray(attribute, value);
    }
    if (this.isRelation(value)) {
      return attribute.notIn((value as any).toArel());
    }
    return attribute.notEq(value);
  }

  private buildNegatedArray(attribute: Nodes.Attribute, value: unknown[]): Nodes.Node {
    if (value.length === 0) return attribute.isNotNull().or(attribute.isNull());

    const values: unknown[] = [];
    let hasNull = false;

    for (const item of value) {
      if (item === null || item === undefined) {
        hasNull = true;
      } else if (typeof item === "object" && item !== null && "id" in item) {
        values.push((item as any).id);
      } else {
        values.push(item);
      }
    }

    let predicate: Nodes.Node =
      values.length > 0 ? attribute.notIn(values) : attribute.isNotNull().or(attribute.isNull());

    if (hasNull) {
      predicate = new Nodes.And([predicate, attribute.isNotNull()]);
    }

    return predicate;
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
