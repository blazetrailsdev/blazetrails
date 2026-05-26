import { takeFailedScreenshot, type ScreenshotHelperHost } from "./screenshot-helper.js";

export interface SetupAndTeardownHost extends ScreenshotHelperHost {
  _context?: { close(): Promise<void> };
}

/** @internal */
export async function beforeTeardown(this: SetupAndTeardownHost): Promise<void> {
  await takeFailedScreenshot.call(this);
}

/** @internal */
export async function afterTeardown(this: SetupAndTeardownHost): Promise<void> {
  await this._context?.close();
  this._context = undefined;
  this._page = undefined;
}
