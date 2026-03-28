export class NonActionable extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NonActionable";
  }
}

export class ActionableError {
  static _actions: Record<string, () => void> = {};

  static actions(error: any): Record<string, () => void> {
    if (!error || typeof error !== "object") {
      return {};
    }

    // Check the constructor (class-level actions, matching Rails' class_attribute behavior)
    const ctor = error.constructor as { _actions?: Record<string, () => void> } | undefined;
    if (ctor && typeof ctor._actions === "object") {
      return ctor._actions;
    }

    // Also accept a class directly (not an instance)
    if (typeof error === "function" && typeof error._actions === "object") {
      return error._actions;
    }

    return {};
  }

  static dispatch(error: any, name: string): void {
    const actions = this.actions(error);
    const action = actions[name];
    if (!action) {
      throw new NonActionable(`Cannot find action "${name}"`);
    }
    action();
  }

  static action(name: string, block: () => void): void {
    this._actions[name] = block;
  }
}
