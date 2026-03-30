import { InheritableOptions } from "./ordered-options.js";

const VALID_NAME = /^[_A-Za-z]\w*$/;

export class Configuration extends InheritableOptions {
  compileMethods(): void {
    // In TypeScript, Proxy-based access already handles dynamic keys,
    // so this is a no-op (Rails uses this to compile method_missing into real methods).
  }
}

export namespace Configurable {
  export interface ConfigAccessorOptions {
    instanceReader?: boolean;
    instanceWriter?: boolean;
    instanceAccessor?: boolean;
    default?: unknown;
  }

  export function getConfig(target: any): Configuration {
    if (!target._config) {
      const parent = Object.getPrototypeOf(target);
      if (parent && parent._config) {
        target._config = new Configuration(parent._config);
      } else {
        target._config = new Configuration();
      }
    }
    return target._config;
  }

  export function configure(target: any, fn: (config: Configuration) => void): void {
    fn(getConfig(target));
  }

  export function configAccessor(
    klass: any,
    ...namesAndOptions: (string | ConfigAccessorOptions)[]
  ): void {
    const lastArg = namesAndOptions[namesAndOptions.length - 1];
    const hasOptions = typeof lastArg === "object" && lastArg !== null;
    const options: ConfigAccessorOptions = hasOptions
      ? (namesAndOptions.pop() as ConfigAccessorOptions)
      : {};

    const names = namesAndOptions as string[];
    const addInstanceReader =
      options.instanceAccessor !== false && options.instanceReader !== false;
    const addInstanceWriter =
      options.instanceAccessor !== false && options.instanceWriter !== false;

    for (const name of names) {
      if (!VALID_NAME.test(name)) {
        throw new Error("invalid config attribute name");
      }

      Object.defineProperty(klass, name, {
        get() {
          return Configurable.getConfig(this).get(name);
        },
        set(value: unknown) {
          Configurable.getConfig(this).set(name, value);
        },
        configurable: true,
        enumerable: false,
      });

      if (klass.prototype) {
        if (addInstanceReader) {
          Object.defineProperty(klass.prototype, name, {
            get() {
              return Configurable.getConfig(this.constructor).get(name);
            },
            set: addInstanceWriter
              ? function (this: any, value: unknown) {
                  if (!this._instanceConfig) {
                    this._instanceConfig = new Configuration(
                      Configurable.getConfig(this.constructor),
                    );
                  }
                  this._instanceConfig.set(name, value);
                }
              : undefined,
            configurable: true,
            enumerable: false,
          });
        }
      }

      if (options.default !== undefined) {
        klass[name] = options.default;
      }
    }
  }

  export function getInstanceConfig(instance: any): Configuration {
    if (!instance._instanceConfig) {
      instance._instanceConfig = new Configuration(getConfig(instance.constructor));
    }
    return instance._instanceConfig;
  }
}
