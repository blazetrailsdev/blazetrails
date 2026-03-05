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

  private static _ensureOwnCallbacks(): void {
    if (!Object.prototype.hasOwnProperty.call(this, "_callbackChain")) {
      // Clone parent's chain so subclass inherits existing callbacks
      this._callbackChain = this._callbackChain.clone();
    }
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
        this._attributes.set(name, def.type.cast(attrs[name]));
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
    const newValue = def ? def.type.cast(value) : value;
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

  attributeChanged(name: string): boolean {
    return this._dirty.attributeChanged(name);
  }

  /**
   * Check if a specific attribute will be saved on the next save.
   * Alias for attributeChanged — mirrors Rails naming.
   *
   * Mirrors: ActiveModel::Dirty#will_save_change_to_attribute?
   */
  willSaveChangeToAttribute(name: string): boolean {
    return this._dirty.attributeChanged(name);
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
  savedChangeToAttribute(name: string): boolean {
    return name in this._dirty.previousChanges;
  }

  /**
   * Get the before/after values of a specific attribute from the last save.
   *
   * Mirrors: ActiveModel::Dirty#saved_change_to_attribute
   */
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
