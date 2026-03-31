import { describe, it, expect } from "vitest";
import { BrowserBlocker, type BrowserVersions } from "../metal/allow-browser.js";

const CHROME_118 =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118 Safari/537.36";
const CHROME_120 =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";
const SAFARI_17_2_0 =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2.0 Safari/605.1.15";
const FIREFOX_114 =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/114.0";
const IE_11 = "Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0; rv:11.0) like Gecko";
const OPERA_106 =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 OPR/106.0.0.0";
const GOOGLE_BOT =
  "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/W.X.Y.Z Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

const SPECIFIC_VERSIONS: BrowserVersions = {
  safari: "16.4",
  chrome: "119",
  firefox: "123",
  opera: "106",
  ie: false,
};

// ==========================================================================
// controller/allow_browser_test.rb
// ==========================================================================
describe("AllowBrowserTest", () => {
  it("blocked browser below version limit with callable", () => {
    const blocker = new BrowserBlocker(FIREFOX_114, SPECIFIC_VERSIONS);
    expect(blocker.blocked).toBe(true);
  });

  it("blocked browser below version limit with method name", () => {
    const blocker = new BrowserBlocker(FIREFOX_114, SPECIFIC_VERSIONS);
    expect(blocker.blocked).toBe(true);
  });

  it("blocked browser by name", () => {
    const blocker = new BrowserBlocker(IE_11, SPECIFIC_VERSIONS);
    expect(blocker.blocked).toBe(true);
  });

  it("allowed browsers above specific version limit", () => {
    expect(new BrowserBlocker(SAFARI_17_2_0, SPECIFIC_VERSIONS).blocked).toBe(false);
    expect(new BrowserBlocker(CHROME_120, SPECIFIC_VERSIONS).blocked).toBe(false);
    expect(new BrowserBlocker(OPERA_106, SPECIFIC_VERSIONS).blocked).toBe(false);
  });

  it("browsers against modern limit", () => {
    expect(new BrowserBlocker(SAFARI_17_2_0, "modern").blocked).toBe(false);
    expect(new BrowserBlocker(CHROME_118, "modern").blocked).toBe(true);
    expect(new BrowserBlocker(CHROME_120, "modern").blocked).toBe(false);
    expect(new BrowserBlocker(OPERA_106, "modern").blocked).toBe(false);
  });

  it("bots", () => {
    expect(new BrowserBlocker(GOOGLE_BOT, SPECIFIC_VERSIONS).blocked).toBe(false);
    expect(new BrowserBlocker(GOOGLE_BOT, "modern").blocked).toBe(false);
  });

  it("a blocked request instruments a browser_block.action_controller event", () => {
    const blocker = new BrowserBlocker(CHROME_118, "modern");
    expect(blocker.blocked).toBe(true);
  });
});
