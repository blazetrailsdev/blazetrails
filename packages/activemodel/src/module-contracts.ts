/**
 * Compile-time verification that Model implements the ActiveModel module contracts.
 * If Model loses a method a module requires, these assertions fail the build.
 */

import type { Model } from "./model.js";
import type { Conversion } from "./conversion.js";
import type { AttributeAssignment } from "./attribute-assignment.js";

type AssertModelHas<T> = Model extends T ? true : never;

type _Conversion = AssertModelHas<Pick<Conversion, "toKey" | "toParam" | "toPartialPath">>;
export const assertConversion: _Conversion = true;

type _Assignment = AssertModelHas<Pick<AttributeAssignment, "assignAttributes">>;
export const assertAssignment: _Assignment = true;
