/**
 * Open interface — augment via `declare module "@blazetrails/actionview"`
 * to register partial-name → locals-type mappings. `trails-tsc-views build`
 * writes the augmentation automatically.
 *
 * Each key is a partial name (e.g. `"users/user.html"`); each value is the
 * compiled template function type
 * `(context: TseRenderContext, locals: L) => OutputBuffer`.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface TemplateRegistry {}

/**
 * Extracts the locals type for a known partial from its registry entry.
 * The registry stores template function types; this unwraps the second
 * parameter (locals) so callers get typed locals without spelling out the
 * full function signature.
 *
 * Falls back to `Record<string, unknown>` when `T` is not a two-argument
 * function (e.g. when the registry entry is unknown or missing).
 */
export type TemplateLocals<T> = T extends (_ctx: unknown, locals: infer L) => unknown
  ? L
  : Record<string, unknown>;
