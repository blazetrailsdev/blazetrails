export { Node, NodeVisitor } from "./node.js";
export { And } from "./and.js";
export { Or } from "./or.js";
export { Not } from "./not.js";
export { Grouping } from "./grouping.js";
export { SqlLiteral } from "./sql-literal.js";
export { Quoted } from "./quoted.js";
export { Casted } from "./casted.js";
export { Attribute } from "./attribute.js";
export { Distinct } from "./distinct.js";
export { Exists } from "./exists.js";

export {
  Unary,
  Offset,
  Limit,
  Top,
  Lock,
  DistinctOn,
  Bin,
  On,
  Ascending,
  Descending,
} from "./unary.js";

export {
  Binary,
  Assignment,
  As,
  Between,
  Equality,
  NotEqual,
  GreaterThan,
  GreaterThanOrEqual,
  LessThan,
  LessThanOrEqual,
  Matches,
  DoesNotMatch,
  In,
  NotIn,
  Addition,
  Subtraction,
  Multiplication,
  Division,
  NodeOrValue,
} from "./binary.js";

export { JoinSource } from "./join-source.js";
export {
  Join,
  InnerJoin,
  OuterJoin,
  RightOuterJoin,
  FullOuterJoin,
  CrossJoin,
  StringJoin,
} from "./join.js";

export { SelectCore } from "./select-core.js";
export { SelectStatement } from "./select-statement.js";
export { InsertStatement } from "./insert-statement.js";
export { UpdateStatement } from "./update-statement.js";
export { DeleteStatement } from "./delete-statement.js";
export { ValuesList } from "./values-list.js";
export { NamedFunction } from "./named-function.js";

export {
  Window,
  NamedWindow,
  Over,
  Preceding,
  Following,
  CurrentRow,
  Rows,
  Range,
} from "./window.js";

export { Union, UnionAll, Intersect, Except } from "./set-operations.js";
export { With, WithRecursive, TableAlias } from "./with.js";

import { SqlLiteral } from "./sql-literal.js";

/** Convenience: Nodes.sql("raw") */
export function sql(rawSql: string): SqlLiteral {
  return new SqlLiteral(rawSql);
}
