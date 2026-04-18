import type { AssociationReflection } from "../reflection.js";
import type { Association } from "./association.js";
import { AssociationScope } from "./association-scope.js";

/**
 * Builds scopes for associations that disable joins, querying each
 * database separately and stitching results in memory.
 *
 * Mirrors: ActiveRecord::Associations::DisableJoinsAssociationScope
 */
export class DisableJoinsAssociationScope extends AssociationScope {
  constructor(reflection: AssociationReflection) {
    super(reflection);
  }

  /**
   * Build the base relation for a disable-joins association. Through
   * loading already runs as separate queries in this codebase, so the
   * disable-joins variant delegates to the standard scope. Kept for
   * API parity with ActiveRecord::Associations::DisableJoinsAssociationScope#scope.
   */
  scope(association: Association): unknown {
    return AssociationScope.scope(association);
  }
}
