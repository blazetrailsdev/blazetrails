import type { Browser, BrowserContext, BrowserType, LaunchOptions, Page } from "playwright";

export type BrowserName = "chromium" | "firefox" | "webkit";

export interface DriverOptions {
  using?: BrowserName;
  screenSize?: [number, number];
  options?: LaunchOptions;
}

/** @internal */
let playwrightModule: typeof import("playwright") | undefined;

async function requirePlaywright(): Promise<typeof import("playwright")> {
  if (playwrightModule) return playwrightModule;
  try {
    playwrightModule = await import("playwright");
    return playwrightModule;
  } catch {
    throw new Error(
      "Playwright is required for system tests. Install it with: npm install playwright",
    );
  }
}

export class Driver {
  readonly name: string;
  private _driverType: string;
  private _screenSize: [number, number];
  private _options: LaunchOptions;
  private _using: BrowserName;
  private _browser: Browser | undefined;
  private _browserType: BrowserType | undefined;

  constructor(driverType: string, options: DriverOptions = {}) {
    this._driverType = driverType;
    this._using = options.using ?? "chromium";
    this._screenSize = options.screenSize ?? [1400, 1400];
    this._options = options.options ?? {};
    this.name = ((this._options as Record<string, unknown>).name as string) ?? driverType;
  }

  async use(): Promise<void> {
    if (this.registerable()) await this.register();
    this.setup();
  }

  get browser(): BrowserType | undefined {
    return this._browserType;
  }

  async close(): Promise<void> {
    await this._browser?.close();
    this._browser = undefined;
  }

  /** @internal */
  private registerable(): boolean {
    return this._driverType === "playwright";
  }

  /** @internal */
  private async register(): Promise<void> {
    await this.registerPlaywright();
  }

  /** @internal */
  private browserOptions(): LaunchOptions {
    return { ...this._options };
  }

  /** @internal */
  private async registerPlaywright(): Promise<void> {
    const pw = await requirePlaywright();
    this._browserType = pw[this._using];
    this._browser = await this._browserType.launch(this.browserOptions());
  }

  /** @internal */
  private registerSelenium(): void {
    throw new Error("Selenium is not supported. Use playwright.");
  }
  /** @internal */
  private registerCuprite(): void {
    throw new Error("Cuprite is not supported. Use playwright.");
  }
  /** @internal */
  private registerRackTest(): void {
    throw new Error("RackTest is not supported. Use playwright.");
  }
  /** @internal */
  private setup(): void {}

  /** @internal */
  async newContext(): Promise<BrowserContext> {
    if (!this._browser) throw new Error("Driver not started. Call use() first.");
    return this._browser.newContext({
      viewport: { width: this._screenSize[0], height: this._screenSize[1] },
    });
  }

  /** @internal */
  async newPage(): Promise<Page> {
    const context = await this.newContext();
    return context.newPage();
  }
}
