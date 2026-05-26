import type { BrowserContext, Page } from "playwright";
import { Driver, type BrowserName, type DriverOptions } from "./system-testing/driver.js";
import { Server, type ServerApp } from "./system-testing/server.js";

export const DEFAULT_HOST = "http://127.0.0.1";

export interface DrivenByOptions {
  using?: BrowserName;
  screenSize?: [number, number];
  options?: Record<string, unknown>;
}

export interface ServedByOptions {
  host: string;
  port: number;
}

export class SystemTestCase {
  static driver: Driver | undefined;
  private static _server: Server | undefined;
  private static _serverHost: string | undefined;
  private static _serverPort: number | undefined;
  private _context: BrowserContext | undefined;
  private _page: Page | undefined;

  constructor() {
    if (!SystemTestCase.driver) SystemTestCase.drivenBy("playwright");
  }

  static drivenBy(driver: string, options: DrivenByOptions = {}): void {
    const driverOptions: DriverOptions = {
      using: options.using ?? "chromium",
      screenSize: options.screenSize ?? [1400, 1400],
      options: options.options,
    };
    this.driver = new Driver(driver, driverOptions);
  }

  static servedBy(options: ServedByOptions): void {
    this._serverHost = options.host;
    this._serverPort = options.port;
  }

  /** @internal */
  static async startApplication(app: ServerApp): Promise<void> {
    const server = new Server();
    await server.run(app);
    this._server = server;
  }

  async setup(): Promise<void> {
    const driver = (this.constructor as typeof SystemTestCase).driver;
    if (!driver) throw new Error("No driver configured. Call drivenBy() first.");
    await driver.use();
    this._context = await driver.newContext();
    this._page = await this._context.newPage();
  }

  async teardown(): Promise<void> {
    await this._context?.close();
    this._context = undefined;
    this._page = undefined;
  }

  get page(): Page {
    if (!this._page) throw new Error("No page available. Call setup() first.");
    return this._page;
  }

  get context(): BrowserContext {
    if (!this._context) throw new Error("No browser context available. Call setup() first.");
    return this._context;
  }

  /** @internal */
  private urlHelpers(): Record<string, (...args: unknown[]) => string> | undefined {
    return undefined;
  }
}
