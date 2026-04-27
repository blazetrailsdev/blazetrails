/**
 * Merges two Relations together, combining their conditions,
 * joins, and other clauses.
 *
 * Mirrors: ActiveRecord::Relation::Merger
 */
export class Merger {
  readonly relation: any;
  readonly values: Record<string, unknown>;
  readonly other: any;

  constructor(relation: any, other: any) {
    this.relation = relation;
    this.other = other;
    this.values = typeof other.values === "function" ? other.values() : {};
  }

  merge(): any {
    const rel = this.relation._clone();
    this.mergeWhereClause(rel);
    this.mergeSelectValues(rel);
    this.mergeMultiValues(rel);
    this.mergeSingleValues(rel);
    this.mergeClauses(rel);
    this.mergePreloads(rel);
    this.mergeJoins(rel);
    this.mergeOuterJoins(rel);
    if (this.other._isNone) rel._isNone = true;
    return rel;
  }

  private mergeWhereClause(rel: any): void {
    if (!this.other._whereClause.isEmpty()) {
      rel._whereClause = rel._whereClause.merge(this.other._whereClause);
    }
  }

  private mergeSelectValues(rel: any): void {
    if (this.other._selectColumns && this.other._selectColumns.length > 0) {
      rel._selectColumns = [...this.other._selectColumns];
    }
  }

  private mergePreloads(rel: any): void {
    if (this.other._preloadValues && this.other._preloadValues.length > 0) {
      rel._preloadValues = [...(rel._preloadValues ?? []), ...this.other._preloadValues];
    }
    if (this.other._includesValues && this.other._includesValues.length > 0) {
      rel._includesValues = [...(rel._includesValues ?? []), ...this.other._includesValues];
    }
  }

  private mergeJoins(rel: any): void {
    if (this.other._joinClauses && this.other._joinClauses.length > 0) {
      rel._joinClauses.push(...this.other._joinClauses);
    }
    if (this.other._rawJoins && this.other._rawJoins.length > 0) {
      rel._rawJoins.push(...this.other._rawJoins);
    }
  }

  private mergeOuterJoins(rel: any): void {
    if (this.other._leftOuterJoins && this.other._leftOuterJoins.length > 0) {
      rel._leftOuterJoins = [...(rel._leftOuterJoins ?? []), ...this.other._leftOuterJoins];
    }
  }

  private mergeMultiValues(rel: any): void {
    if (this.other._orderClauses && this.other._orderClauses.length > 0) {
      rel._orderClauses = [...this.other._orderClauses];
    }
    if (this.other._groupColumns && this.other._groupColumns.length > 0) {
      rel._groupColumns.push(...this.other._groupColumns);
    }
    if (this.other._annotations && this.other._annotations.length > 0) {
      rel._annotations.push(...this.other._annotations);
    }
    if (this.other._referencesValues) {
      for (const ref of this.other._referencesValues) {
        if (!rel._referencesValues.includes(ref)) rel._referencesValues.push(ref);
      }
    }
  }

  private mergeSingleValues(rel: any): void {
    if (this.other._limitValue !== null && this.other._limitValue !== undefined) {
      rel._limitValue = this.other._limitValue;
    }
    if (this.other._offsetValue !== null && this.other._offsetValue !== undefined) {
      rel._offsetValue = this.other._offsetValue;
    }
    if (this.other._isDistinct) rel._isDistinct = true;
    if (this.other._lockValue) rel._lockValue = this.other._lockValue;
    if (this.other._isReadonly) rel._isReadonly = true;
    if (this.other._isStrictLoading) rel._isStrictLoading = true;
  }

  private mergeClauses(rel: any): void {
    if (!this.other._havingClause.isEmpty()) {
      rel._havingClause = rel._havingClause.merge(this.other._havingClause);
    }
    if (this.isReplaceFromClause() && this.other._fromClause) {
      rel._fromClause = this.other._fromClause;
    }
  }

  private isReplaceFromClause(): boolean {
    return (
      (!this.relation._fromClause || this.relation._fromClause === "") &&
      this.other._fromClause &&
      this.other._fromClause !== ""
    );
  }
}

/**
 * Merges a hash of conditions into a Relation by converting
 * the hash into where/having/etc. clauses first.
 *
 * Mirrors: ActiveRecord::Relation::HashMerger
 */
export class HashMerger {
  readonly relation: any;
  readonly hash: Record<string, unknown>;

  constructor(relation: any, hash: Record<string, unknown>) {
    this.relation = relation;
    this.hash = hash;
  }

  merge(): any {
    return this.relation.where(this.hash);
  }
}
