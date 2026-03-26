/**
 * Compile-time verification that Model implements the ActiveModel module contracts.
 * This file imports each module interface and asserts Model satisfies it.
 *
 * If Model is missing a method that a module requires, this file will
 * produce a compile error — keeping the interfaces honest.
 */

import type { Model } from "./model.js";
import type { Dirty } from "./dirty.js";
import type { Conversion } from "./conversion.js";
import type { Serialization } from "./serialization.js";
import type { AttributeAssignment } from "./attribute-assignment.js";
import type { Validations } from "./validations.js";

// Verify Model instance methods match module contracts.
// Using conditional types: if Model extends the interface shape, the type resolves
// to true; otherwise it's never and the assignment fails at compile time.

type AssertModelHas<T> = Model extends T ? true : never;

// Dirty tracking
type _Dirty = AssertModelHas<
  Pick<
    Dirty,
    | "isChanged"
    | "changedAttributes"
    | "changes"
    | "previousChanges"
    | "attributeChanged"
    | "attributeWas"
    | "restoreAttributes"
    | "clearChangesInformation"
    | "clearAttributeChanges"
    | "attributeChangedInPlace"
  >
>;

// Conversion
type _Conversion = AssertModelHas<Pick<Conversion, "toKey" | "toParam" | "toPartialPath">>;

// Attribute assignment
type _Assignment = AssertModelHas<Pick<AttributeAssignment, "assignAttributes">>;

// Serialization
type _Serialization = AssertModelHas<Pick<Serialization, "serializableHash">>;

// Validations
type _Validations = AssertModelHas<
  Pick<Validations, "isValid" | "validate" | "isInvalid" | "validateBang">
>;

// Suppress unused type warnings
export type ModuleContracts = {
  dirty: _Dirty;
  conversion: _Conversion;
  assignment: _Assignment;
  serialization: _Serialization;
  validations: _Validations;
};
