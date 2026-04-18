import { AssociationScope, type ValueTransformation } from "./association-scope.js";

/**
 * Builds scopes for associations that disable joins, querying each
 * database separately and stitching results in memory. Real
 * implementation comes in a later PR — for now we inherit
 * `AssociationScope.scope` so a disable-joins `hasOne`/`hasMany` at
 * least builds a valid single-table relation.
 *
 * Mirrors: ActiveRecord::Associations::DisableJoinsAssociationScope
 */
export class DisableJoinsAssociationScope extends AssociationScope {
  constructor(valueTransformation: ValueTransformation = (v) => v) {
    super(valueTransformation);
  }
}
