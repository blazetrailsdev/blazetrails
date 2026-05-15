export class Railtie {
  static railtieName = "action_dispatch";

  private _initializers: Array<{ name: string; fn: () => void }> = [];

  initializer(name: string, fn: () => void): void {
    this._initializers.push({ name, fn });
  }

  runInitializers(): void {
    for (const init of this._initializers) {
      init.fn();
    }
  }

  get initializers(): ReadonlyArray<{ name: string; fn: () => void }> {
    return [...this._initializers];
  }
}
