import {
  deepMerge as deepMergeImpl,
  deepMergeInPlace as deepMergeInPlaceImpl,
} from "./hash-utils.js";

type AnyObject = Record<string, unknown>;

export class DeepMergeable {
  static deepMerge<T extends AnyObject>(target: T, source: AnyObject): T {
    return deepMergeImpl(target, source);
  }

  static deepMergeInPlace<T extends AnyObject>(target: T, source: AnyObject): T {
    return deepMergeInPlaceImpl(target, source);
  }
}
