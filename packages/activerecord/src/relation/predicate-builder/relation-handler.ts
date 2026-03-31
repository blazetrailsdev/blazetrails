import { Nodes } from "@blazetrails/arel";

/**
 * Handles Relation values in where conditions by converting them to
 * IN subqueries.
 *
 * Mirrors: ActiveRecord::PredicateBuilder::RelationHandler
 *
 * Examples:
 *   where({ author_id: Author.where({ active: true }) })
 *     → author_id IN (SELECT authors.id FROM authors WHERE active = true)
 */
export class RelationHandler {
  call(attribute: Nodes.Attribute, value: any): Nodes.Node {
    let relation = value;

    if (relation._selectColumns.length === 0) {
      const model = relation._modelClass;
      const pk = model?.primaryKey ?? "id";
      if (Array.isArray(pk)) {
        throw new Error(`Cannot map composite primary key ${pk.join(", ")} to ${attribute.name}`);
      }
      relation = relation.select(pk);
    }

    return attribute.in(relation.toArel());
  }
}
