import { describe, it, expect, beforeEach } from "vitest";
import { mkdtemp, readFile, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { scanModels, buildManifest, generateManifest } from "./generate-manifest.js";

async function writeModel(dir: string, file: string, body: string): Promise<void> {
  await writeFile(join(dir, file), body, "utf8");
}

// A small set of fake model files exercising the scan rules: a direct
// subclass, an indirect one (via an abstract base), a non-model class, and
// noise files (a test, the manifest itself) that must be ignored.
async function seedModels(dir: string): Promise<void> {
  const imp = `import { Base } from "@blazetrails/activerecord";\n`;
  await writeModel(dir, "user.ts", `${imp}export class User extends Base {}\n`);
  await writeModel(dir, "tweet.ts", `${imp}export class Tweet extends Base {}\n`);
  // follow.ts: an indirect subclass through an abstract intermediate.
  await writeModel(
    dir,
    "follow.ts",
    `${imp}export abstract class ApplicationRecord extends Base {}\nexport class Follow extends ApplicationRecord {}\n`,
  );
  await writeModel(dir, "helper.ts", `export class Helper {}\n`);
  await writeModel(dir, "user.test.ts", `export class Nope extends Base {}\n`);
  await writeModel(dir, "index.ts", `// stale manifest\n`);
}

describe("ArGenerateManifestTest", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "ar-manifest-"));
  });

  it("scans only exported classes that transitively extend Base", async () => {
    await seedModels(dir);
    const entries = await scanModels(dir);
    const names = entries.map((e) => e.className);
    // Follow (via abstract ApplicationRecord) counts; the abstract base
    // itself, Helper, the .test.ts class, and index.ts do not.
    expect(names).toEqual(["Follow", "Tweet", "User"]);
    expect(entries.find((e) => e.className === "Follow")?.importPath).toBe("./follow.js");
  });

  it("excludes abstract bases (TS `abstract` and `static abstractClass = true`)", async () => {
    await writeModel(
      dir,
      "records.ts",
      `import { Base } from "x";\n` +
        `export class AppRecord extends Base {\n  static abstractClass = true;\n}\n` +
        `export class Widget extends AppRecord {}\n`,
    );
    const names = (await scanModels(dir)).map((e) => e.className);
    expect(names).toEqual(["Widget"]); // AppRecord bridges the chain but isn't registered
  });

  it("handles an empty models dir without dangling re-exports", async () => {
    const manifest = await buildManifest(dir);
    expect(manifest).toContain(`export const models = [] as const;`);
    expect(manifest).not.toContain("export {");
  });

  it("emits import + register + re-export lines in alphabetical order", async () => {
    await seedModels(dir);
    const manifest = await buildManifest(dir);
    expect(manifest).toContain(`import { registerModel } from "@blazetrails/activerecord";`);
    expect(manifest).toContain(`import { User } from "./user.js";`);
    expect(manifest).toContain(`export const models = [Follow, Tweet, User] as const;`);
    expect(manifest).toContain(`for (const m of models) registerModel(m);`);
    expect(manifest).toContain(`export { Follow, Tweet, User };`);
  });

  it("imports a default-exported model by its default binding, not a named one", async () => {
    await writeModel(
      dir,
      "account.ts",
      `import { Base } from "x";\nexport default class Account extends Base {}\n`,
    );
    const manifest = await buildManifest(dir);
    expect(manifest).toContain(`import Account from "./account.js";`);
    expect(manifest).not.toContain(`import { Account }`);
    expect(manifest).toContain(`export { Account };`);
  });

  it("rejects two model classes that share a name (would not compile)", async () => {
    await writeModel(dir, "a.ts", `import { Base } from "x";\nexport class Dup extends Base {}\n`);
    await writeModel(dir, "b.ts", `import { Base } from "x";\nexport class Dup extends Base {}\n`);
    await expect(scanModels(dir)).rejects.toThrow(/duplicate model class "Dup" in a\.ts and b\.ts/);
  });

  it("reports a friendly error when the models dir is missing", async () => {
    await expect(scanModels(join(dir, "nope"))).rejects.toThrow(/models directory not found/);
  });

  it("writes the manifest, then is a byte-identical no-op on rerun", async () => {
    await seedModels(dir); // index.ts starts as a stale "// stale manifest"
    const first = await generateManifest(dir);
    expect(first.changed).toBe(true);
    expect(first.path).toBe(join(dir, "index.ts"));
    const onDisk = await readFile(first.path, "utf8");
    expect(onDisk).toBe(first.content);

    const second = await generateManifest(dir);
    expect(second.changed).toBe(false);
    expect(await readFile(second.path, "utf8")).toBe(onDisk);
  });

  it("--check reports drift without writing, and passes once current", async () => {
    await seedModels(dir);
    const stale = await readFile(join(dir, "index.ts"), "utf8");
    const drift = await generateManifest(dir, { check: true });
    expect(drift.changed).toBe(true);
    expect(await readFile(join(dir, "index.ts"), "utf8")).toBe(stale); // untouched

    await generateManifest(dir);
    expect((await generateManifest(dir, { check: true })).changed).toBe(false);
  });
});
