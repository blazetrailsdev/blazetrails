/**
 * ActionController::AllowBrowser
 *
 * Minimum browser version enforcement.
 * @see https://api.rubyonrails.org/classes/ActionController/AllowBrowser.html
 */

export type BrowserVersions = "modern" | Record<string, string>;

export interface AllowBrowser {
  allowBrowser(options: { versions: BrowserVersions }): void;
}

export class BrowserBlocker {
  private _versions: BrowserVersions;
  private _request: unknown;

  constructor(request: unknown, versions: BrowserVersions) {
    this._request = request;
    this._versions = versions;
  }

  get blocked(): boolean {
    return false;
  }
}
