import { RuleTester } from "eslint";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import rule, { trailsToRailsRel, collectUseFixturesKeys } from "./expected-fixtures.mjs";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DEPS_PATH = path.join(ROOT, "scripts/test-deps/output/activerecord-test-deps.json");
const EXCLUDE_PATH = path.join(__dirname, "expected-fixtures-exclude.json");

// Set up fixture data on disk before importing the rule; the rule reads
// these paths once and caches. We snapshot whatever's there, install our
// fixtures, then restore at the end.
const snapshots = new Map();
function snapshot(p) {
  snapshots.set(p, fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null);
}
function restore() {
  for (const [p, v] of snapshots) {
    if (v === null) {
      if (fs.existsSync(p)) fs.unlinkSync(p);
    } else {
      fs.writeFileSync(p, v);
    }
  }
}

beforeAll(() => {
  snapshot(DEPS_PATH);
  snapshot(EXCLUDE_PATH);
  fs.mkdirSync(path.dirname(DEPS_PATH), { recursive: true });
  fs.writeFileSync(
    DEPS_PATH,
    JSON.stringify({
      "aggregations_test.rb": {
        requires: ["customer"],
        fixtures: ["customers", "warehouse-things"],
        setFixtureClass: {},
        tests: {},
      },
      "associations/eager_test.rb": {
        requires: [],
        fixtures: ["posts", "authors"],
        setFixtureClass: {},
        tests: {},
      },
      "excluded_test.rb": {
        requires: [],
        fixtures: ["topics"],
        setFixtureClass: {},
        tests: {},
      },
      "no_fixtures_test.rb": {
        requires: [],
        fixtures: [],
        setFixtureClass: {},
        tests: {},
      },
    }),
  );
  fs.writeFileSync(EXCLUDE_PATH, JSON.stringify(["packages/activerecord/src/excluded.test.ts"]));
});
afterAll(restore);
// Belt-and-suspenders: cover Ctrl-C / watch-mode reloads between beforeAll
// and afterAll. One of the snapshotted files (EXCLUDE_PATH) is committed,
// so a leaked test fixture could be staged by mistake.
process.on("exit", restore);

describe("trailsToRailsRel", () => {
  it("maps kebab-case basenames to snake_case rails paths", () => {
    expect(trailsToRailsRel("/x/packages/activerecord/src/aggregations.test.ts")).toBe(
      "aggregations_test.rb",
    );
    expect(
      trailsToRailsRel("/x/packages/activerecord/src/associations/has-many-associations.test.ts"),
    ).toBe("associations/has_many_associations_test.rb");
  });
  it("returns null for non-activerecord paths", () => {
    expect(trailsToRailsRel("/x/packages/arel/src/foo.test.ts")).toBeNull();
    expect(trailsToRailsRel("/x/random/file.ts")).toBeNull();
  });
});

// collectUseFixturesKeys is exercised indirectly by the RuleTester cases
// below (matching/extra/missing/nested/union scenarios all route through it).
void collectUseFixturesKeys;

describe("expected-fixtures rule", () => {
  it("runs RuleTester cases", async () => {
    const tester = new RuleTester({
      languageOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
        parser: (await import("typescript-eslint")).parser,
      },
    });
    try {
      runCases(tester);
    } finally {
      // If tester.run threw mid-test, still restore on the way out.
      restore();
    }
  });
});

function runCases(tester) {
  tester.run("expected-fixtures", rule, {
    valid: [
      {
        name: "matching useFixtures call (string + identifier keys)",
        filename: path.join(ROOT, "packages/activerecord/src/aggregations.test.ts"),
        code: `const fx = useFixtures({ customers: [C, {}], "warehouse-things": [W, {}] });\n`,
      },
      {
        name: "extra keys allowed",
        filename: path.join(ROOT, "packages/activerecord/src/aggregations.test.ts"),
        code: `const fx = useFixtures({ customers: [C, {}], "warehouse-things": [W, {}], extras: [E, {}] });\n`,
      },
      {
        name: "useFixtures inside describe block",
        filename: path.join(ROOT, "packages/activerecord/src/aggregations.test.ts"),
        code: `describe("X", () => { const fx = useFixtures({ customers: [C, {}], "warehouse-things": [W, {}] }); });\n`,
      },
      {
        name: "multiple useFixtures calls union their keys",
        filename: path.join(ROOT, "packages/activerecord/src/aggregations.test.ts"),
        code: `describe("A", () => { useFixtures({ customers: [C, {}] }); });\ndescribe("B", () => { useFixtures({ "warehouse-things": [W, {}] }); });\n`,
      },
      {
        name: "rails file with no fixtures → no-op",
        filename: path.join(ROOT, "packages/activerecord/src/no-fixtures.test.ts"),
        code: `// nothing\n`,
      },
      {
        name: "excluded files are skipped",
        filename: path.join(ROOT, "packages/activerecord/src/excluded.test.ts"),
        code: `// no useFixtures call but excluded\n`,
      },
      {
        name: "non-activerecord paths ignored",
        filename: path.join(ROOT, "packages/arel/src/foo.test.ts"),
        code: `// nothing\n`,
      },
    ],
    invalid: [
      {
        name: "missing useFixtures entirely",
        filename: path.join(ROOT, "packages/activerecord/src/aggregations.test.ts"),
        code: `// no fixtures here\n`,
        errors: [{ messageId: "missing" }],
      },
      {
        name: "useFixtures present but missing a key",
        filename: path.join(ROOT, "packages/activerecord/src/associations/eager.test.ts"),
        code: `const fx = useFixtures({ posts: [P, {}] });\n`,
        errors: [{ messageId: "incomplete" }],
      },
    ],
  });
}
