import { humanize, underscore, deepDup } from "@blazetrails/activesupport";
import { I18n } from "./i18n.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = any;

// Rails `CALLBACKS_OPTIONS` / `MESSAGE_OPTIONS` — option keys that are
// stripped from the identity of an error for strict-match / hash purposes
// (activemodel/lib/active_model/error.rb:10-11). Both snake and camel
// spellings are accepted since our codebase normalizes to camel while
// Rails-ported code may leak snake-cased keys.
const CALLBACKS_OPTIONS = new Set<string>([
  "if",
  "unless",
  "on",
  "allow_nil",
  "allow_blank",
  "strict",
  "allowNil",
  "allowBlank",
]);
const MESSAGE_OPTIONS = new Set<string>(["message"]);

/**
 * Represents one single error.
 *
 * Mirrors: ActiveModel::Error
 */
export class Error {
  static i18nCustomizeFullMessage: boolean = false;

  readonly base: AnyRecord;
  readonly attribute: string;
  readonly type: string;
  readonly rawType: string;
  readonly options: Record<string, unknown>;

  constructor(
    base: AnyRecord,
    attribute: string,
    type: string = "invalid",
    options: Record<string, unknown> = {},
  ) {
    this.base = base;
    this.attribute = attribute;
    this.rawType = type;
    this.type = type || "invalid";
    this.options = options;
  }

  /**
   * Return a deep-duped copy of this error, optionally rebinding `base` to a
   * new model instance. Mirrors Rails' usage in
   * `ActiveModel::Errors#copy!` where each error is `deep_dup`ed and then
   * its `@base` is reset to the receiver
   * (activemodel/lib/active_model/errors.rb:138-143).
   */
  dupWithBase(newBase: AnyRecord): Error {
    return new Error(newBase, this.attribute, this.rawType, deepDup(this.options));
  }

  get message(): string {
    const msg = this.options.message;
    if (typeof msg === "string") {
      return Error.interpolate(msg, this.options);
    }
    if (typeof msg === "function") {
      const result = (msg as (base: AnyRecord) => unknown)(this.base);
      if (typeof result === "string") return Error.interpolate(result, this.options);
    }
    return Error.generateMessage(this.attribute, this.type, this.base, this.options);
  }

  get details(): Record<string, unknown> {
    const result: Record<string, unknown> = { error: this.rawType };
    for (const [key, value] of Object.entries(this.options)) {
      if (
        key !== "if" &&
        key !== "unless" &&
        key !== "on" &&
        key !== "allow_nil" &&
        key !== "allow_blank" &&
        key !== "allowNil" &&
        key !== "allowBlank" &&
        key !== "strict" &&
        key !== "message"
      ) {
        result[key] = value;
      }
    }
    return result;
  }

  get detail(): Record<string, unknown> {
    return this.details;
  }

  get fullMessage(): string {
    return Error.fullMessage(this.attribute, this.message, this.base);
  }

  /**
   * See if this error matches `attribute`, `type`, and `options`. Mirrors
   * Rails `Error#match?` (activemodel/lib/active_model/error.rb:166-174):
   * subset match — every key in `options` must `===` the corresponding
   * value in `this.options`; extra keys on the error are ignored.
   */
  match(attribute: string, type?: string, options?: Record<string, unknown>): boolean {
    if (this.attribute !== attribute) return false;
    if (type !== undefined && this.type !== type) return false;
    if (options) {
      for (const [key, value] of Object.entries(options)) {
        if (this.options[key] !== value) return false;
      }
    }
    return true;
  }

  /**
   * Strict match — Rails `Error#strict_match?`
   * (activemodel/lib/active_model/error.rb:184-188): attribute/type must
   * match and `options` must equal the error's `@options` with
   * `CALLBACKS_OPTIONS` and `MESSAGE_OPTIONS` stripped.
   */
  strictMatch(attribute: string, type: string, options?: Record<string, unknown>): boolean {
    if (!this.match(attribute, type)) return false;
    const expected = options ?? {};
    const own: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(this.options)) {
      if (!CALLBACKS_OPTIONS.has(k) && !MESSAGE_OPTIONS.has(k)) own[k] = v;
    }
    const expectedKeys = Object.keys(expected);
    const ownKeys = Object.keys(own);
    if (expectedKeys.length !== ownKeys.length) return false;
    for (const k of expectedKeys) {
      if (!(k in own) || own[k] !== expected[k]) return false;
    }
    return true;
  }

  equals(other: Error): boolean {
    return (
      other instanceof Error &&
      this.base === other.base &&
      this.attribute === other.attribute &&
      this.rawType === other.rawType
    );
  }

  inspect(): string {
    let optionsStr: string;
    try {
      optionsStr = JSON.stringify(this.options);
    } catch {
      optionsStr = "{...}";
    }
    return `#<ActiveModel::Error attribute=${this.attribute}, type=${this.type}, options=${optionsStr}>`;
  }

  static interpolate(msg: string, options: Record<string, unknown>): string {
    return msg.replace(/%\{(\w+)\}/g, (_, key) => {
      return options[key] !== undefined ? String(options[key]) : `%{${key}}`;
    });
  }

  static fullMessage(attribute: string, message: string, base: AnyRecord): string {
    if (attribute === "base") return message;
    const modelClass = base?.constructor;
    const humanAttr = modelClass?.humanAttributeName
      ? modelClass.humanAttributeName(attribute)
      : humanize(attribute);

    const rawScope = modelClass?.i18nScope;
    const i18nScope = typeof rawScope === "string" ? rawScope : "activemodel";
    let format: string;
    if (Error.i18nCustomizeFullMessage) {
      const modelKey =
        (modelClass as AnyRecord)?.modelName?.i18nKey ??
        (modelClass?.name ? underscore(modelClass.name) : undefined);
      const defaults: string[] = [];
      if (modelKey) {
        defaults.push(`${i18nScope}.errors.models.${modelKey}.attributes.${attribute}.format`);
        defaults.push(`${i18nScope}.errors.models.${modelKey}.format`);
      }
      defaults.push(`${i18nScope}.errors.format`);
      if (i18nScope !== "activemodel") defaults.push("activemodel.errors.format");
      defaults.push("errors.format");
      const primaryKey = defaults[0];
      const fallbackDefaults = defaults.slice(1).map((key) => ({ key }));
      format = I18n.t(primaryKey, {
        defaults: fallbackDefaults,
        defaultValue: "%{attribute} %{message}",
      });
    } else {
      format = I18n.t(`${i18nScope}.errors.format`, {
        defaults: [
          ...(i18nScope !== "activemodel" ? [{ key: "activemodel.errors.format" }] : []),
          { key: "errors.format" },
        ],
        defaultValue: "%{attribute} %{message}",
      });
    }

    return format.replace("%{attribute}", humanAttr).replace("%{message}", message);
  }

  static generateMessage(
    attribute: string,
    type: string,
    base: AnyRecord,
    options: Record<string, unknown> = {},
  ): string {
    if (typeof options.message === "string") {
      return Error.interpolate(options.message, options);
    }

    const modelClass = base?.constructor;
    const modelKey =
      (modelClass as AnyRecord)?.modelName?.i18nKey ??
      (modelClass?.name ? underscore(modelClass.name) : undefined);
    const humanAttr = modelClass?.humanAttributeName
      ? modelClass.humanAttributeName(attribute)
      : humanize(attribute);

    const i18nOptions: Record<string, unknown> = {
      model: modelKey,
      attribute: humanAttr,
      value: base && attribute !== "base" ? base[attribute] : undefined,
      ...options,
    };

    const rawScope2 = modelClass?.i18nScope;
    const i18nScope = typeof rawScope2 === "string" ? rawScope2 : "activemodel";
    const ancestors: string[] = [];
    if (typeof modelClass?.lookupAncestors === "function") {
      for (const klass of modelClass.lookupAncestors()) {
        const key = klass.modelName?.i18nKey ?? (klass.name ? underscore(klass.name) : undefined);
        if (key) ancestors.push(key);
      }
    } else if (modelKey) {
      ancestors.push(modelKey);
    }

    const defaults: Array<{ key: string } | { message: string }> = [];
    for (const ancestorKey of ancestors) {
      defaults.push({
        key: `${i18nScope}.errors.models.${ancestorKey}.attributes.${attribute}.${type}`,
      });
      defaults.push({ key: `${i18nScope}.errors.models.${ancestorKey}.${type}` });
    }
    defaults.push({ key: `${i18nScope}.errors.messages.${type}` });
    if (i18nScope !== "activemodel") {
      defaults.push({ key: `activemodel.errors.messages.${type}` });
    }
    defaults.push({ key: `errors.attributes.${attribute}.${type}` });
    defaults.push({ key: `errors.messages.${type}` });

    const first = defaults[0];
    const primaryKey = first && "key" in first ? first.key : `${i18nScope}.errors.messages.${type}`;

    return I18n.t(primaryKey, {
      ...i18nOptions,
      defaults: defaults.slice(1),
      defaultValue: type,
    });
  }
}
