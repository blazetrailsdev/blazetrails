import { describe, expect, it } from "vitest";
import { buildGemfileContent } from "./build-gemfile.js";

describe("scripts/parity/schema/ruby/build-gemfile.ts", () => {
  it("derives activerecord version from vendor/sources.ts rails ref", () => {
    const content = buildGemfileContent();
    // Rails ref is "v8.0.2" in sources.ts → "8.0.2" gem version (v stripped).
    expect(content).toContain('gem "activerecord", "8.0.2"');
  });

  it("includes the GENERATED banner so contributors know not to hand-edit", () => {
    expect(buildGemfileContent()).toMatch(/GENERATED from vendor\/sources\.ts/);
  });

  it("preserves sqlite3 and minitest dependencies", () => {
    const content = buildGemfileContent();
    expect(content).toContain("sqlite3");
    expect(content).toContain("minitest");
  });
});
