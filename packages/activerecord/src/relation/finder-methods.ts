/**
 * Finder methods: find, findBy, first, last, take, sole, and ordinal accessors.
 *
 * These are the real implementations behind Relation's finder methods.
 * Each function uses this-typing and is mixed into Relation via interface
 * merge + prototype assignment.
 *
 * Mirrors: ActiveRecord::FinderMethods
 */

import { RecordNotFound, RecordInvalid, SoleRecordExceeded } from "../errors.js";

interface FinderRelation {
  _modelClass: {
    name: string;
    primaryKey: string | string[];
    compositePrimaryKey: boolean;
    createBang(attrs: any): Promise<any>;
  };
  _isNone: boolean;
  _limitValue: number | null;
  _offsetValue: number | null;
  _orderClauses: any[];
  _rawOrderClauses: string[];
  _createWithAttrs: Record<string, unknown>;
  _scopeAttributes(): Record<string, unknown>;
  _clone(): any;
  where(conditions: Record<string, unknown>): any;
  limit(n: number): any;
  order(...args: any[]): any;
  reverseOrder(): any;
  toArray(): Promise<any[]>;
}

function buildPkWhere(rel: FinderRelation, id: unknown): Record<string, unknown> {
  const pk = rel._modelClass.primaryKey;
  if (Array.isArray(pk)) {
    const tuple = id as unknown[];
    const conditions: Record<string, unknown> = {};
    pk.forEach((col, i) => {
      conditions[col] = tuple[i];
    });
    return conditions;
  }
  return { [pk]: id };
}

export async function performFind(this: FinderRelation, ...ids: unknown[]): Promise<any> {
  const pk = this._modelClass.primaryKey;
  const isCpk = this._modelClass.compositePrimaryKey;

  if (ids.length === 1 && !Array.isArray(ids[0])) {
    if (isCpk) {
      throw new RecordNotFound(
        `Couldn't find ${this._modelClass.name} with a scalar id (composite PK requires an array)`,
        this._modelClass.name,
        String(pk),
        ids[0],
      );
    }
    const records = await this.where({ [pk as string]: ids[0] })
      .limit(1)
      .toArray();
    if (records.length === 0) {
      throw new RecordNotFound(
        `Couldn't find ${this._modelClass.name} with '${pk}'=${ids[0]}`,
        this._modelClass.name,
        pk as string,
        ids[0],
      );
    }
    return records[0];
  }

  const input = ids.length === 1 && Array.isArray(ids[0]) ? ids[0] : ids;

  if (isCpk) {
    // CPK: each id is a tuple like [shop_id, id]
    const tuples = input as unknown[][];
    if (tuples.length === 0) {
      throw new RecordNotFound(
        `Couldn't find ${this._modelClass.name} with an empty list of ids`,
        this._modelClass.name,
        String(pk),
        [],
      );
    }
    const results: any[] = [];
    for (const tuple of tuples) {
      const conditions = buildPkWhere(this, tuple);
      const records = await this.where(conditions).limit(1).toArray();
      if (records.length === 0) {
        throw new RecordNotFound(
          `Couldn't find ${this._modelClass.name} with '${pk}'=${JSON.stringify(tuple)}`,
          this._modelClass.name,
          String(pk),
          tuple,
        );
      }
      results.push(records[0]);
    }
    return results.length === 1 ? results[0] : results;
  }

  const flatIds = input.flat();
  if (flatIds.length === 0) {
    throw new RecordNotFound(
      `Couldn't find ${this._modelClass.name} with an empty list of ids`,
      this._modelClass.name,
      pk as string,
      [],
    );
  }
  const records = await this.where({ [pk as string]: flatIds }).toArray();
  if (records.length !== flatIds.length) {
    throw new RecordNotFound(
      `Couldn't find all ${this._modelClass.name} with '${pk}': (${flatIds.join(", ")})`,
      this._modelClass.name,
      pk as string,
      flatIds,
    );
  }
  return records;
}

export async function performFindBy(
  this: FinderRelation,
  conditions: Record<string, unknown>,
): Promise<any | null> {
  const records = await this.where(conditions).limit(1).toArray();
  return records[0] ?? null;
}

export async function performFindByBang(
  this: FinderRelation,
  conditions: Record<string, unknown>,
): Promise<any> {
  const record = await performFindBy.call(this, conditions);
  if (!record) {
    throw new RecordNotFound(`${this._modelClass.name} not found`, this._modelClass.name);
  }
  return record;
}

export async function performFindSoleBy(
  this: FinderRelation,
  conditions: Record<string, unknown>,
): Promise<any> {
  return performSole.call(this.where(conditions));
}

function hasOrder(rel: FinderRelation): boolean {
  return rel._orderClauses.length > 0 || rel._rawOrderClauses.length > 0;
}

export async function performFirst(this: FinderRelation, n?: number): Promise<any> {
  if (this._isNone) return n !== undefined ? [] : null;
  if (n !== undefined) {
    const rel = this._clone();
    rel._limitValue = n;
    return rel.toArray();
  }
  const rel = this._clone();
  rel._limitValue = 1;
  const records = await rel.toArray();
  return records[0] ?? null;
}

export async function performFirstBang(this: FinderRelation): Promise<any> {
  const record = await performFirst.call(this);
  if (!record) {
    throw new RecordNotFound(`${this._modelClass.name} not found`, this._modelClass.name);
  }
  return record;
}

export async function performLast(this: FinderRelation, n?: number): Promise<any> {
  if (this._isNone) return n !== undefined ? [] : null;
  let rel: any;
  if (!hasOrder(this)) {
    rel = this.order({ [this._modelClass.primaryKey as string]: "desc" as const });
  } else {
    rel = this.reverseOrder();
  }
  if (n !== undefined) {
    rel = rel.limit(n);
    const records = await rel.toArray();
    return records.reverse();
  }
  rel = rel.limit(1);
  const records = await rel.toArray();
  return records[0] ?? null;
}

export async function performLastBang(this: FinderRelation): Promise<any> {
  const record = await performLast.call(this);
  if (!record) {
    throw new RecordNotFound(`${this._modelClass.name} not found`, this._modelClass.name);
  }
  return record;
}

export async function performSole(this: FinderRelation): Promise<any> {
  const rel = this._clone();
  rel._limitValue = 2;
  const records = await rel.toArray();
  if (records.length === 0) {
    throw new RecordNotFound(`${this._modelClass.name} not found`, this._modelClass.name);
  }
  if (records.length > 1) {
    throw new SoleRecordExceeded(this._modelClass.name);
  }
  return records[0];
}

export async function performTake(this: FinderRelation, limit?: number): Promise<any> {
  const rel = this._clone();
  if (limit !== undefined) {
    rel._limitValue = limit;
    return rel.toArray();
  }
  rel._limitValue = 1;
  const records = await rel.toArray();
  return records[0] ?? null;
}

export async function performTakeBang(this: FinderRelation): Promise<any> {
  const record = await performTake.call(this);
  if (!record) {
    throw new RecordNotFound(`${this._modelClass.name} not found`, this._modelClass.name);
  }
  return record;
}

async function findNthWithLimit(this: FinderRelation, index: number): Promise<any | null> {
  const rel = this._clone();
  rel._limitValue = 1;
  rel._offsetValue = (this._offsetValue ?? 0) + index;
  if (!hasOrder(rel)) {
    rel._orderClauses.push(this._modelClass.primaryKey as string);
  }
  const records = await rel.toArray();
  return records[0] ?? null;
}

async function findNthFromLast(this: FinderRelation, index: number): Promise<any | null> {
  let rel: any;
  if (!hasOrder(this)) {
    rel = this.order({ [this._modelClass.primaryKey as string]: "desc" as const });
  } else {
    rel = this.reverseOrder();
  }
  return findNthWithLimit.call(rel, index);
}

export async function performSecond(this: FinderRelation): Promise<any | null> {
  return findNthWithLimit.call(this, 1);
}

export async function performThird(this: FinderRelation): Promise<any | null> {
  return findNthWithLimit.call(this, 2);
}

export async function performFourth(this: FinderRelation): Promise<any | null> {
  return findNthWithLimit.call(this, 3);
}

export async function performFifth(this: FinderRelation): Promise<any | null> {
  return findNthWithLimit.call(this, 4);
}

export async function performFortyTwo(this: FinderRelation): Promise<any | null> {
  return findNthWithLimit.call(this, 41);
}

export async function performSecondToLast(this: FinderRelation): Promise<any | null> {
  return findNthFromLast.call(this, 1);
}

export async function performThirdToLast(this: FinderRelation): Promise<any | null> {
  return findNthFromLast.call(this, 2);
}

function bangFinder(finder: (this: FinderRelation) => Promise<any | null>) {
  return async function (this: FinderRelation): Promise<any> {
    const record = await finder.call(this);
    if (!record) {
      throw new RecordNotFound(`${this._modelClass.name} not found`, this._modelClass.name);
    }
    return record;
  };
}

export const performSecondBang = bangFinder(performSecond);
export const performThirdBang = bangFinder(performThird);
export const performFourthBang = bangFinder(performFourth);
export const performFifthBang = bangFinder(performFifth);
export const performFortyTwoBang = bangFinder(performFortyTwo);
export const performSecondToLastBang = bangFinder(performSecondToLast);
export const performThirdToLastBang = bangFinder(performThirdToLast);

export async function performFindOrCreateByBang(
  this: FinderRelation,
  conditions: Record<string, unknown>,
  extra?: Record<string, unknown>,
): Promise<any> {
  const records = await this.where(conditions).limit(1).toArray();
  if (records.length > 0) return records[0];
  return this._modelClass.createBang({
    ...this._createWithAttrs,
    ...this._scopeAttributes(),
    ...conditions,
    ...extra,
  });
}

export async function performCreateOrFindByBang(
  this: FinderRelation,
  conditions: Record<string, unknown>,
  extra?: Record<string, unknown>,
): Promise<any> {
  try {
    return await this._modelClass.createBang({
      ...this._createWithAttrs,
      ...this._scopeAttributes(),
      ...conditions,
      ...extra,
    });
  } catch (error) {
    if (error instanceof RecordInvalid) throw error;
    const records = await this.where(conditions).limit(1).toArray();
    if (records.length > 0) return records[0];
    throw new RecordNotFound(`${this._modelClass.name} not found`, this._modelClass.name);
  }
}

/**
 * Interface for the finder methods mixed into Relation.
 * Uses `any` for return types because the generic T from Relation<T>
 * can't flow through the interface merge without making the mixin
 * itself generic, which creates circular complexity. The Relation class
 * provides the generic typing at the call site.
 */
export interface FinderMethodsMixin {
  find(...ids: unknown[]): Promise<any>;
  findBy(conditions: Record<string, unknown>): Promise<any | null>;
  findByBang(conditions: Record<string, unknown>): Promise<any>;
  findSoleBy(conditions: Record<string, unknown>): Promise<any>;
  first(n?: number): Promise<any>;
  firstBang(): Promise<any>;
  last(n?: number): Promise<any>;
  lastBang(): Promise<any>;
  sole(): Promise<any>;
  take(limit?: number): Promise<any>;
  takeBang(): Promise<any>;
  second(): Promise<any | null>;
  third(): Promise<any | null>;
  fourth(): Promise<any | null>;
  fifth(): Promise<any | null>;
  fortyTwo(): Promise<any | null>;
  secondToLast(): Promise<any | null>;
  thirdToLast(): Promise<any | null>;
  secondBang(): Promise<any>;
  thirdBang(): Promise<any>;
  fourthBang(): Promise<any>;
  fifthBang(): Promise<any>;
  fortyTwoBang(): Promise<any>;
  secondToLastBang(): Promise<any>;
  thirdToLastBang(): Promise<any>;
  findOrCreateByBang(
    conditions: Record<string, unknown>,
    extra?: Record<string, unknown>,
  ): Promise<any>;
  createOrFindByBang(
    conditions: Record<string, unknown>,
    extra?: Record<string, unknown>,
  ): Promise<any>;
}
