/**
 * Callback lifecycle hooks for ActiveRecord persistence operations.
 *
 * In Rails, Callbacks wraps destroy/touch/increment! to fire
 * before/after hooks. Our Base class uses _callbackChain directly;
 * this module exports the callback registration helpers.
 *
 * Mirrors: ActiveRecord::Callbacks
 */

export type CallbackOptions = {
  on?: "create" | "update" | Array<"create" | "update">;
  if?: (record: any) => boolean;
  unless?: (record: any) => boolean;
  prepend?: boolean;
};

/**
 * Register a before_validation callback.
 *
 * Mirrors: ActiveRecord::Callbacks.before_validation
 */
export function beforeValidation(
  modelClass: any,
  fn: (record: any) => void | Promise<void>,
  options?: CallbackOptions,
): void {
  registerCallback(modelClass, "before", "validation", fn, options);
}

/**
 * Register an after_validation callback.
 *
 * Mirrors: ActiveRecord::Callbacks.after_validation
 */
export function afterValidation(
  modelClass: any,
  fn: (record: any) => void | Promise<void>,
  options?: CallbackOptions,
): void {
  registerCallback(modelClass, "after", "validation", fn, options);
}

/**
 * Register a before_save callback.
 *
 * Mirrors: ActiveRecord::Callbacks.before_save
 */
export function beforeSave(
  modelClass: any,
  fn: (record: any) => void | Promise<void> | false,
  options?: CallbackOptions,
): void {
  registerCallback(modelClass, "before", "save", fn, options);
}

/**
 * Register an after_save callback.
 *
 * Mirrors: ActiveRecord::Callbacks.after_save
 */
export function afterSave(
  modelClass: any,
  fn: (record: any) => void | Promise<void>,
  options?: CallbackOptions,
): void {
  registerCallback(modelClass, "after", "save", fn, options);
}

/**
 * Register a before_create callback.
 *
 * Mirrors: ActiveRecord::Callbacks.before_create
 */
export function beforeCreate(
  modelClass: any,
  fn: (record: any) => void | Promise<void> | false,
  options?: CallbackOptions,
): void {
  registerCallback(modelClass, "before", "create", fn, options);
}

/**
 * Register an after_create callback.
 *
 * Mirrors: ActiveRecord::Callbacks.after_create
 */
export function afterCreate(
  modelClass: any,
  fn: (record: any) => void | Promise<void>,
  options?: CallbackOptions,
): void {
  registerCallback(modelClass, "after", "create", fn, options);
}

/**
 * Register a before_update callback.
 *
 * Mirrors: ActiveRecord::Callbacks.before_update
 */
export function beforeUpdate(
  modelClass: any,
  fn: (record: any) => void | Promise<void> | false,
  options?: CallbackOptions,
): void {
  registerCallback(modelClass, "before", "update", fn, options);
}

/**
 * Register an after_update callback.
 *
 * Mirrors: ActiveRecord::Callbacks.after_update
 */
export function afterUpdate(
  modelClass: any,
  fn: (record: any) => void | Promise<void>,
  options?: CallbackOptions,
): void {
  registerCallback(modelClass, "after", "update", fn, options);
}

/**
 * Register a before_destroy callback.
 *
 * Mirrors: ActiveRecord::Callbacks.before_destroy
 */
export function beforeDestroy(
  modelClass: any,
  fn: (record: any) => void | Promise<void> | false,
  options?: CallbackOptions,
): void {
  registerCallback(modelClass, "before", "destroy", fn, options);
}

/**
 * Register an after_destroy callback.
 *
 * Mirrors: ActiveRecord::Callbacks.after_destroy
 */
export function afterDestroy(
  modelClass: any,
  fn: (record: any) => void | Promise<void>,
  options?: CallbackOptions,
): void {
  registerCallback(modelClass, "after", "destroy", fn, options);
}

function registerCallback(
  modelClass: any,
  timing: "before" | "after",
  event: string,
  fn: Function,
  options?: CallbackOptions,
): void {
  if (!modelClass._callbackChain) return;
  modelClass._callbackChain.register(timing, event, fn, {
    if: options?.if,
    unless: options?.unless,
    on: options?.on,
    prepend: options?.prepend,
  });
}
