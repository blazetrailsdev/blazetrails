import { NestedError as ActiveModelNestedError } from "@blazetrails/activemodel";

interface AssociationLike {
  owner: unknown;
  reflection: { name: string };
  isCollection?(): boolean;
  target?: unknown[];
  options?: Record<string, unknown>;
}

interface InnerErrorLike {
  attribute: string;
  type: string;
  rawType?: string;
  message: string;
  options?: Record<string, unknown>;
  base?: unknown;
}

/**
 * Wraps validation errors from nested associations.
 *
 * Mirrors: ActiveRecord::Associations::NestedError
 */
export class NestedError extends ActiveModelNestedError {
  private readonly association: AssociationLike;

  constructor(association: AssociationLike, innerError: InnerErrorLike) {
    const attribute = NestedError.computeAttribute(association, innerError);
    super(association.owner, innerError, { attribute });
    this.association = association;
  }

  private static computeAttribute(
    association: AssociationLike,
    innerError: InnerErrorLike,
  ): string {
    const name = association.reflection.name;
    return `${name}.${innerError.attribute}`;
  }
}
