export interface ValidationsCallbacks {
  _brand?: "Validations::Callbacks";
}

export interface CallbacksClassMethods {
  beforeValidation(callback: unknown, options?: Record<string, unknown>): void;
  afterValidation(callback: unknown, options?: Record<string, unknown>): void;
}

import type { Model } from "../model.js";

type _CB =
  typeof Model extends Pick<CallbacksClassMethods, "beforeValidation" | "afterValidation">
    ? true
    : never;
