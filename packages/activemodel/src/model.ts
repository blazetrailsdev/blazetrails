import { Errors } from "./errors.js";
import { typeRegistry } from "./types/registry.js";
import { Type } from "./types/type.js";
import { ModelName } from "./naming.js";
import { DirtyTracker } from "./dirty.js";
import { CallbackChain, CallbackFn, AroundCallbackFn, CallbackConditions } from "./callbacks.js";
import { serializableHash, SerializeOptions } from "./serialization.js";
import type { Validator, ConditionalOptions } from "./validations/validator.js";
import { shouldValidate } from "./validations/validator.js";
import {
  PresenceValidator,
  AbsenceValidator,
  LengthValidator,
  NumericalityValidator,
  InclusionValidator,
  ExclusionValidator,
  FormatValidator,
  AcceptanceValidator,
  ConfirmationValidator,
  ComparisonValidator,
} from "./validations/validators.js";

interface AttributeDefinition {
  name: string;
  type: Type;
  defaultValue: unknown;
}

interface ValidationEntry {
  attribute: string;
  validator: Validator;
  on?: "create" | "update";
}

interface CustomValidationEntry {
  method: string | ((record: any) => void);
  options: ConditionalOptions;
}

/**
 * Model — the base class that bundles Attributes, Validations, Callbacks,
 * Dirty tracking, Serialization, and Naming.
 *
 * Mirrors: ActiveModel::Model (with all the included modules)
 */
export class Model {
  // -- Class-level registries --
  static _attributeDefinitions: Map<string, AttributeDefinition> = new Map();
  static _validations: ValidationEntry[] = [];
  static _customValidations: CustomValidationEntry[] = [];
  static _callbackChain: CallbackChain = new CallbackChain();
  private static _modelName: ModelName | null = null;

  // -- Attributes (Phase 1000) --

  static attribute(
    name: string,
    typeName: string,
    options?: { default?: unknown }
  ): void {
    const type = typeRegistry.lookup(typeName);
    const defaultValue = options?.default ?? null;
    // Ensure subclass has its own copy
    if (!Object.prototype.hasOwnProperty.call(this, "_attributeDefinitions")) {
      this._attributeDefinitions = new Map(this._attributeDefinitions);
    }
    this._attributeDefinitions.set(name, { name, type, defaultValue });
  }

  static attributeNames(): string[] {
    return Array.from(this._attributeDefinitions.keys());
  }

  /**
   * Create an alias for an existing attribute.
   *
   * Mirrors: ActiveModel::AttributeMethods.alias_attribute
   */
  static aliasAttribute(newName: string, originalName: string): void {
    Object.defineProperty(this.prototype, newName, {
      get(this: Model) {
        return this.readAttribute(originalName);
      },
      set(this: Model, value: unknown) {
        this.writeAttribute(originalName, value);
      },
      configurable: true,
    });
  }

  // -- Normalizations --
  static _normalizations: Map<string, (value: unknown) => unknown> = new Map();

  /**
   * Register a normalization function for one or more attributes.
   * The function is called before validation on every write.
   *
   * Mirrors: ActiveRecord::Base.normalizes (Rails 7.1+)
   *
   * Example:
   *   User.normalizes("email", (v) => typeof v === "string" ? v.trim().toLowerCase() : v);
   */
  static normalizes(
    ...args: [...string[], (value: unknown) => unknown]
  ): void {
    if (!Object.prototype.hasOwnProperty.call(this, "_normalizations")) {
      this._normalizations = new Map(this._normalizations);
    }
    const fn = args[args.length - 1] as (value: unknown) => unknown;
    const attributes = args.slice(0, -1) as string[];
    for (const attr of attributes) {
      this._normalizations.set(attr, fn);
    }
  }

  // -- Validations (Phase 1100) --

  static validates(
    attribute: string,
    rules: Record<string, unknown>
  ): void {
    if (!Object.prototype.hasOwnProperty.call(this, "_validations")) {
      this._validations = [...this._validations];
    }

    const onContext = rules.on as "create" | "update" | undefined;

    if (rules.presence) {
      const opts = rules.presence === true ? {} : (rules.presence as any);
      this._validations.push({
        attribute,
        validator: new PresenceValidator(opts),
        on: onContext,
      });
    }

    if (rules.absence) {
      const opts = rules.absence === true ? {} : (rules.absence as any);
      this._validations.push({
        attribute,
        validator: new AbsenceValidator(opts),
        on: onContext,
      });
    }

    if (rules.length) {
      this._validations.push({
        attribute,
        validator: new LengthValidator(rules.length as any),
        on: onContext,
      });
    }

    if (rules.numericality) {
      const opts =
        rules.numericality === true ? {} : (rules.numericality as any);
      this._validations.push({
        attribute,
        validator: new NumericalityValidator(opts),
        on: onContext,
      });
    }

    if (rules.inclusion) {
      this._validations.push({
        attribute,
        validator: new InclusionValidator(rules.inclusion as any),
        on: onContext,
      });
    }

    if (rules.exclusion) {
      this._validations.push({
        attribute,
        validator: new ExclusionValidator(rules.exclusion as any),
        on: onContext,
      });
    }

    if (rules.format) {
      this._validations.push({
        attribute,
        validator: new FormatValidator(rules.format as any),
        on: onContext,
      });
    }

    if (rules.acceptance) {
      const opts = rules.acceptance === true ? {} : (rules.acceptance as any);
      this._validations.push({
        attribute,
        validator: new AcceptanceValidator(opts),
        on: onContext,
      });
    }

    if (rules.confirmation) {
      const opts =
        rules.confirmation === true ? {} : (rules.confirmation as any);
      this._validations.push({
        attribute,
        validator: new ConfirmationValidator(opts),
        on: onContext,
      });
    }

    if (rules.comparison) {
      this._validations.push({
        attribute,
        validator: new ComparisonValidator(rules.comparison as any),
        on: onContext,
      });
    }
  }

  static validate(
    methodOrFn: string | ((record: any) => void),
    options: ConditionalOptions = {}
  ): void {
    if (!Object.prototype.hasOwnProperty.call(this, "_customValidations")) {
      this._customValidations = [...this._customValidations];
    }
    this._customValidations.push({ method: methodOrFn, options });
  }

  /**
   * Validates each of the specified attributes with a block.
   *
   * Mirrors: ActiveModel::Validations.validates_each
   */
  static validatesEach(
    attributes: string[],
    fn: (record: any, attribute: string, value: unknown) => void,
    options: ConditionalOptions = {}
  ): void {
    this.validate((record: any) => {
      for (const attr of attributes) {
        const value = record.readAttribute(attr);
        fn(record, attr, value);
      }
    }, options);
  }

  /**
   * Validates using a custom validator class instance.
   * The validator must implement validate(record).
   *
   * Mirrors: ActiveModel::Validations.validates_with
   */
  static validatesWith(
    validatorClass: { new (options?: any): { validate(record: any): void } },
    options: ConditionalOptions & { [key: string]: unknown } = {}
  ): void {
    const { if: ifOpt, unless: unlessOpt, on: onOpt, ...rest } = options;
    const validator = new validatorClass(rest);
    this.validate((record: any) => {
      validator.validate(record);
    }, { if: ifOpt, unless: unlessOpt, on: onOpt });
  }

  // -- Callbacks (Phase 1200) --

  static beforeValidation(fn: CallbackFn, conditions?: CallbackConditions): void {
    this._ensureOwnCallbacks();
    this._callbackChain.register("before", "validation", fn, conditions);
  }

  static afterValidation(fn: CallbackFn, conditions?: CallbackConditions): void {
    this._ensureOwnCallbacks();
    this._callbackChain.register("after", "validation", fn, conditions);
  }

  static beforeSave(fn: CallbackFn, conditions?: CallbackConditions): void {
    this._ensureOwnCallbacks();
    this._callbackChain.register("before", "save", fn, conditions);
  }

  static afterSave(fn: CallbackFn, conditions?: CallbackConditions): void {
    this._ensureOwnCallbacks();
    this._callbackChain.register("after", "save", fn, conditions);
  }

  static beforeCreate(fn: CallbackFn, conditions?: CallbackConditions): void {
    this._ensureOwnCallbacks();
    this._callbackChain.register("before", "create", fn, conditions);
  }

  static afterCreate(fn: CallbackFn, conditions?: CallbackConditions): void {
    this._ensureOwnCallbacks();
    this._callbackChain.register("after", "create", fn, conditions);
  }

  static beforeUpdate(fn: CallbackFn, conditions?: CallbackConditions): void {
    this._ensureOwnCallbacks();
    this._callbackChain.register("before", "update", fn, conditions);
  }

  static afterUpdate(fn: CallbackFn, conditions?: CallbackConditions): void {
    this._ensureOwnCallbacks();
    this._callbackChain.register("after", "update", fn, conditions);
  }

  static beforeDestroy(fn: CallbackFn, conditions?: CallbackConditions): void {
    this._ensureOwnCallbacks();
    this._callbackChain.register("before", "destroy", fn, conditions);
  }

  static afterDestroy(fn: CallbackFn, conditions?: CallbackConditions): void {
    this._ensureOwnCallbacks();
    this._callbackChain.register("after", "destroy", fn, conditions);
  }

  static aroundSave(fn: AroundCallbackFn, conditions?: CallbackConditions): void {
    this._ensureOwnCallbacks();
    this._callbackChain.register("around", "save", fn, conditions);
  }

  static aroundCreate(fn: AroundCallbackFn, conditions?: CallbackConditions): void {
    this._ensureOwnCallbacks();
    this._callbackChain.register("around", "create", fn, conditions);
  }

  static aroundUpdate(fn: AroundCallbackFn, conditions?: CallbackConditions): void {
    this._ensureOwnCallbacks();
    this._callbackChain.register("around", "update", fn, conditions);
  }

  static aroundDestroy(fn: AroundCallbackFn, conditions?: CallbackConditions): void {
    this._ensureOwnCallbacks();
    this._callbackChain.register("around", "destroy", fn, conditions);
  }

  static afterCommit(fn: CallbackFn, conditions?: CallbackConditions): void {
    this._ensureOwnCallbacks();
    this._callbackChain.register("after", "commit", fn, conditions);
  }

  static afterRollback(fn: CallbackFn, conditions?: CallbackConditions): void {
    this._ensureOwnCallbacks();
    this._callbackChain.register("after", "rollback", fn, conditions);
  }

  static afterInitialize(fn: CallbackFn, conditions?: CallbackConditions): void {
    this._ensureOwnCallbacks();
    this._callbackChain.register("after", "initialize", fn, conditions);
  }

  static afterFind(fn: CallbackFn, conditions?: CallbackConditions): void {
    this._ensureOwnCallbacks();
    this._callbackChain.register("after", "find", fn, conditions);
  }

  static afterTouch(fn: CallbackFn, conditions?: CallbackConditions): void {
    this._ensureOwnCallbacks();
    this._callbackChain.register("after", "touch", fn, conditions);
  }

  private static _ensureOwnCallbacks(): void {
    if (!Object.prototype.hasOwnProperty.call(this, "_callbackChain")) {
      // Clone parent's chain so subclass inherits existing callbacks
      this._callbackChain = this._callbackChain.clone();
    }
  }

  /**
   * Define custom model callbacks.
   * Creates beforeX(), afterX(), and aroundX() class methods for each event name.
   *
   * Mirrors: ActiveModel::Callbacks.define_model_callbacks
   */
  static defineModelCallbacks(...eventNames: string[]): void {
    for (const event of eventNames) {
      const capitalizedEvent = event.charAt(0).toUpperCase() + event.slice(1);

      // before<Event>
      Object.defineProperty(this, `before${capitalizedEvent}`, {
        value: function (fn: CallbackFn, conditions?: CallbackConditions) {
          this._ensureOwnCallbacks();
          this._callbackChain.register("before", event, fn, conditions);
        },
        writable: true,
        configurable: true,
      });

      // after<Event>
      Object.defineProperty(this, `after${capitalizedEvent}`, {
        value: function (fn: CallbackFn, conditions?: CallbackConditions) {
          this._ensureOwnCallbacks();
          this._callbackChain.register("after", event, fn, conditions);
        },
        writable: true,
        configurable: true,
      });

      // around<Event>
      Object.defineProperty(this, `around${capitalizedEvent}`, {
        value: function (fn: AroundCallbackFn, conditions?: CallbackConditions) {
          this._ensureOwnCallbacks();
          this._callbackChain.register("around", event, fn, conditions);
        },
        writable: true,
        configurable: true,
      });
    }
  }

  /**
   * Convert an attribute name to a human-readable form.
   *
   * Mirrors: ActiveModel::Translation.human_attribute_name
   */
  static humanAttributeName(attr: string): string {
    return attr
      .replace(/_/g, " ")
      .replace(/^\w/, (c) => c.toUpperCase());
  }

  // -- Naming (Phase 1300) --

  static get modelName(): ModelName {
    if (!this._modelName || this._modelName.name !== this.name) {
      this._modelName = new ModelName(this.name);
    }
    return this._modelName;
  }

  // -- Instance --

  _attributes: Map<string, unknown> = new Map();
  _attributesBeforeTypeCast: Map<string, unknown> = new Map();
  errors: Errors = new Errors();
  private _dirty: DirtyTracker = new DirtyTracker();

  constructor(attrs: Record<string, unknown> = {}) {
    const ctor = this.constructor as typeof Model;
    const defs = ctor._attributeDefinitions;

    for (const [name, def] of defs) {
      if (name in attrs) {
        this._attributesBeforeTypeCast.set(name, attrs[name]);
        let castValue = def.type.cast(attrs[name]);
        // Apply normalization if defined
        const normalizer = ctor._normalizations.get(name);
        if (normalizer) {
          castValue = normalizer(castValue);
        }
        this._attributes.set(name, castValue);
      } else {
        const defVal =
          typeof def.defaultValue === "function"
            ? def.defaultValue()
            : def.defaultValue;
        this._attributes.set(name, defVal);
      }
    }

    // Also set any extra keys passed in (for confirmation fields, etc.)
    for (const key of Object.keys(attrs)) {
      if (!this._attributes.has(key)) {
        this._attributes.set(key, attrs[key]);
      }
    }

    this._dirty.snapshot(this._attributes);

    // Fire after_initialize callbacks
    const ctor2 = this.constructor as typeof Model;
    ctor2._callbackChain.runAfter("initialize", this);
  }

  // -- Attribute access --

  readAttribute(name: string): unknown {
    return this._attributes.get(name) ?? null;
  }

  writeAttribute(name: string, value: unknown): void {
    const ctor = this.constructor as typeof Model;
    const def = ctor._attributeDefinitions.get(name);
    const oldValue = this._attributes.get(name);
    this._attributesBeforeTypeCast.set(name, value);
    let newValue = def ? def.type.cast(value) : value;
    // Apply normalization if defined
    const normalizer = ctor._normalizations.get(name);
    if (normalizer) {
      newValue = normalizer(newValue);
    }
    this._attributes.set(name, newValue);
    this._dirty.attributeWillChange(name, oldValue, newValue);
  }

  /**
   * Read the raw (uncast) value of an attribute.
   *
   * Mirrors: ActiveModel::Dirty#attribute_before_type_cast
   */
  readAttributeBeforeTypeCast(name: string): unknown {
    return this._attributesBeforeTypeCast.get(name) ?? null;
  }

  /**
   * Get all attributes before type cast as a plain object.
   *
   * Mirrors: ActiveModel::Attributes#attributes_before_type_cast
   */
  get attributesBeforeTypeCast(): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [k, v] of this._attributesBeforeTypeCast) {
      result[k] = v;
    }
    return result;
  }

  /**
   * Get the type/metadata for an attribute.
   *
   * Mirrors: ActiveRecord::Base.column_for_attribute
   */
  columnForAttribute(name: string): { name: string; type: Type } | null {
    const def = (this.constructor as typeof Model)._attributeDefinitions.get(name);
    if (!def) return null;
    return { name: def.name, type: def.type };
  }

  /**
   * Check if this model has the given attribute defined.
   *
   * Mirrors: ActiveModel::AttributeMethods#has_attribute?
   */
  hasAttribute(name: string): boolean {
    return (this.constructor as typeof Model)._attributeDefinitions.has(name);
  }

  get attributes(): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [k, v] of this._attributes) {
      result[k] = v;
    }
    return result;
  }

  attributePresent(name: string): boolean {
    const value = this._attributes.get(name);
    if (value === null || value === undefined) return false;
    if (typeof value === "string" && value.trim() === "") return false;
    return true;
  }

  // -- Validations --

  _validationContext: "create" | "update" | null = null;

  isValid(context?: "create" | "update"): boolean {
    this.errors.clear();
    const ctor = this.constructor as typeof Model;
    const effectiveContext = context ?? this._validationContext;

    // Run before_validation callbacks
    if (!ctor._callbackChain.runBefore("validation", this)) return false;

    // Run attribute validations
    for (const entry of ctor._validations) {
      // If validation has an `on` context, only run when context matches
      if (entry.on && entry.on !== effectiveContext) continue;
      const value = this._attributes.get(entry.attribute);
      entry.validator.validate(this, entry.attribute, value, this.errors);
    }

    // Run custom validations
    for (const entry of ctor._customValidations) {
      if (!shouldValidate(this, entry.options)) continue;
      if (typeof entry.method === "function") {
        entry.method(this);
      } else if (typeof (this as any)[entry.method] === "function") {
        (this as any)[entry.method]();
      }
    }

    // Run after_validation callbacks
    ctor._callbackChain.runAfter("validation", this);

    return this.errors.empty;
  }

  isInvalid(): boolean {
    return !this.isValid();
  }

  // -- Dirty tracking --

  get changed(): boolean {
    return this._dirty.changed;
  }

  get changedAttributes(): string[] {
    return this._dirty.changedAttributes;
  }

  get changes(): Record<string, [unknown, unknown]> {
    return this._dirty.changes;
  }

  attributeChanged(name: string, options?: { from?: unknown; to?: unknown }): boolean {
    if (!this._dirty.attributeChanged(name)) return false;
    if (!options) return true;
    const change = this._dirty.attributeChange(name);
    if (!change) return false;
    if ("from" in options && change[0] !== options.from) return false;
    if ("to" in options && change[1] !== options.to) return false;
    return true;
  }

  /**
   * Check if a specific attribute will be saved on the next save.
   * Supports from: and to: options like Rails.
   *
   * Mirrors: ActiveModel::Dirty#will_save_change_to_attribute?
   */
  willSaveChangeToAttribute(name: string, options?: { from?: unknown; to?: unknown }): boolean {
    return this.attributeChanged(name, options);
  }

  attributeWas(name: string): unknown {
    return this._dirty.attributeWas(name);
  }

  attributeChange(name: string): [unknown, unknown] | undefined {
    return this._dirty.attributeChange(name);
  }

  /**
   * Get the before/after values of a change that will be saved.
   *
   * Mirrors: ActiveModel::Dirty#will_save_change_to_attribute
   */
  willSaveChangeToAttributeValues(name: string): [unknown, unknown] | undefined {
    return this._dirty.attributeChange(name);
  }

  get previousChanges(): Record<string, [unknown, unknown]> {
    return this._dirty.previousChanges;
  }

  /**
   * Alias for previousChanges — the changes that were persisted in the last save.
   *
   * Mirrors: ActiveModel::Dirty#saved_changes
   */
  get savedChanges(): Record<string, [unknown, unknown]> {
    return this._dirty.previousChanges;
  }

  /**
   * Check if a specific attribute was saved in the last save.
   *
   * Mirrors: ActiveModel::Dirty#saved_change_to_attribute?
   */
  savedChangeToAttribute(name: string, options?: { from?: unknown; to?: unknown }): boolean {
    const changes = this._dirty.previousChanges;
    if (!(name in changes)) return false;
    if (!options) return true;
    const change = changes[name];
    if ("from" in options && change[0] !== options.from) return false;
    if ("to" in options && change[1] !== options.to) return false;
    return true;
  }

  /**
   * Get the before/after values of a specific attribute from the last save.
   *
   * Mirrors: ActiveModel::Dirty#saved_change_to_attribute
   */
  /**
   * Get the attribute value before the last save.
   *
   * Mirrors: ActiveModel::Dirty#attribute_before_last_save
   */
  attributeBeforeLastSave(name: string): unknown {
    const change = this._dirty.previousChanges[name];
    return change ? change[0] : this.readAttribute(name);
  }

  /**
   * Get the attribute value as it currently exists in the database
   * (i.e. the value from before any unsaved changes).
   *
   * Mirrors: ActiveModel::Dirty#attribute_in_database
   */
  attributeInDatabase(name: string): unknown {
    return this._dirty.attributeWas(name) ?? this.readAttribute(name);
  }

  /**
   * Return the list of attribute names that have unsaved changes.
   *
   * Mirrors: ActiveModel::Dirty#changed_attribute_names_to_save
   */
  get changedAttributeNamesToSave(): string[] {
    return this.changedAttributes;
  }

  savedChangeToAttributeValues(name: string): [unknown, unknown] | undefined {
    const changes = this._dirty.previousChanges;
    return changes[name];
  }

  restoreAttributes(): void {
    this._dirty.restore(this._attributes);
  }

  changesApplied(): void {
    this._dirty.changesApplied(this._attributes);
  }

  /**
   * Clear all dirty tracking information (changes + previous changes).
   *
   * Mirrors: ActiveModel::Dirty#clear_changes_information
   */
  clearChangesInformation(): void {
    this._dirty.clearChangesInformation();
  }

  /**
   * Clear dirty tracking for specific attributes only.
   *
   * Mirrors: ActiveModel::Dirty#clear_attribute_changes
   */
  clearAttributeChanges(attributes: string[]): void {
    this._dirty.clearAttributeChanges(attributes);
  }

  // -- Serialization --

  serializableHash(options?: SerializeOptions): Record<string, unknown> {
    return serializableHash(this, options);
  }

  asJson(options?: SerializeOptions): Record<string, unknown> {
    return this.serializableHash(options);
  }

  toJson(options?: SerializeOptions): string {
    return JSON.stringify(this.asJson(options));
  }

  // -- Naming / Conversion --

  get modelName(): ModelName {
    return (this.constructor as typeof Model).modelName;
  }

  toParam(): string | null {
    return null;
  }

  toPartialPath(): string {
    const mn = this.modelName;
    return `${mn.collection}/_${mn.element}`;
  }

  // -- Callbacks helper for subclasses --

  runCallbacks(event: string, block: () => void): boolean {
    return (this.constructor as typeof Model)._callbackChain.run(
      event,
      this,
      block
    );
  }
}
