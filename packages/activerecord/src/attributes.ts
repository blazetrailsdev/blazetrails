/**
 * The Attributes module — the `attribute` class method API for defining
 * typed attributes on models.
 *
 * Mirrors: ActiveRecord::Attributes
 */

/**
 * The Attributes module interface.
 *
 * Mirrors: ActiveRecord::Attributes
 */
export interface Attributes {
  attribute(name: string, type: string, options?: { default?: unknown }): void;
}
