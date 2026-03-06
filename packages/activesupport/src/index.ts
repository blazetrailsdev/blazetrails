export {
  pluralize,
  singularize,
  camelize,
  underscore,
  titleize,
  tableize,
  classify,
  dasherize,
  demodulize,
  deconstantize,
  foreignKey,
  humanize,
  parameterize,
  ordinal,
  ordinalize,
} from "./inflector.js";

export { Inflections, loadDefaults } from "./inflections.js";

export {
  isBlank,
  isPresent,
  presence,
  squish,
  truncate,
  truncateWords,
} from "./string-utils.js";

export {
  deepMerge,
  deepDup,
  slice,
  except,
  deepTransformKeys,
  deepCamelizeKeys,
  deepUnderscoreKeys,
  extractOptions,
} from "./hash-utils.js";

export {
  wrap,
  inGroupsOf,
  toSentence,
  including,
  excluding,
} from "./array-utils.js";

export {
  sum,
  indexBy,
  groupBy,
  pluck,
  maximum,
  minimum,
  inBatchesOf,
  compactBlank,
} from "./enumerable-utils.js";

export { HashWithIndifferentAccess } from "./hash-with-indifferent-access.js";

export {
  defineCallbacks,
  setCallback,
  skipCallback,
  resetCallbacks,
  runCallbacks,
} from "./callbacks.js";
export type {
  CallbackKind,
  CallbackCondition,
  CallbackOptions,
  DefineCallbacksOptions,
  BeforeCallback,
  AfterCallback,
  AroundCallback,
} from "./callbacks.js";

export { concern, includeConcern, hasConcern } from "./concern.js";
export type { ConcernDefinition, ConcernMixin } from "./concern.js";

export { classAttribute } from "./class-attribute.js";
export type { ClassAttributeOptions } from "./class-attribute.js";
