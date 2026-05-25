/**
 * Strict-locals type helper and runtime error.
 * Mirrors Rails `ActionView::Template::StrictLocalsError` (raised when the
 * compiled template receives keys not declared in `<%# locals: (...) %>`).
 */

/**
 * Makes a type exact: excess keys beyond those declared in `T` map to `never`,
 * so TypeScript rejects objects with undeclared keys even when passed as
 * variables (not just inline object literals, where the normal excess-property
 * check fires automatically).
 *
 * @example
 * type Locals = NoExtraKeys<{ count: number }>;
 * const l = { count: 1, extra: 2 };
 * render({ partial: "…", locals: l }); // TS error: extra not in declared locals
 */
export type NoExtraKeys<T> = T & { [K in Exclude<string, keyof T>]?: never };

/**
 * Thrown at runtime by a compiled `.tse` module when `locals` contains keys
 * that were not declared in the `<%# locals: (...) %>` magic comment and
 * `raiseOnStrictLocalsMismatch` is enabled (default: true in development).
 *
 * Rails analogue: `ActionView::Template::StrictLocalsError`.
 */
export class StrictLocalsMismatch extends Error {
  readonly extraKeys: readonly string[];
  readonly allowedKeys: readonly string[];

  constructor(extraKeys: string[], allowedKeys: string[]) {
    const extra = extraKeys.map((k) => JSON.stringify(k)).join(", ");
    const allowed =
      allowedKeys.length === 0 ? "(none)" : allowedKeys.map((k) => JSON.stringify(k)).join(", ");
    super(
      `unknown local${extraKeys.length === 1 ? "" : "s"} ${extra} passed to template; ` +
        `allowed: ${allowed}`,
    );
    this.name = "ActionView::Template::StrictLocalsError";
    this.extraKeys = extraKeys;
    this.allowedKeys = allowedKeys;
  }
}
