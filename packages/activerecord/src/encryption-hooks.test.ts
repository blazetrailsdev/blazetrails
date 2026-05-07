import { describe, it, expect } from "vitest";
// Intentionally does NOT import encryption.js — tests the unregistered state.
import { encryptionHooks, registerEncryptionHooks } from "./encryption-hooks.js";
import { Base } from "./base.js";

describe("encryptionHooks — unregistered default behavior", () => {
  it("encrypts() throws with an actionable message when the encryption namespace is not loaded", () => {
    expect(() => encryptionHooks.encrypts(Base, "ssn")).toThrowError(
      /encryption is not loaded.*Base\.encrypts\(\)/,
    );
  });

  it("error message includes the actual class name", () => {
    class MyModel extends Base {}
    expect(() => encryptionHooks.encrypts(MyModel, "ssn")).toThrowError(/MyModel\.encrypts\(\)/);
  });

  it("applyPendingEncryptions is a no-op (not a throw) — called on every attribute() definition", () => {
    expect(() => encryptionHooks.applyPendingEncryptions(Base)).not.toThrow();
  });

  it("registerEncryptionHooks replaces the throwing stub", () => {
    const recorded: string[] = [];
    registerEncryptionHooks({
      ...encryptionHooks,
      encrypts: (_klass: any, name: string) => recorded.push(name),
    });
    expect(() => encryptionHooks.encrypts(Base, "ssn")).not.toThrow();
    expect(recorded).toContain("ssn");
    // Restore original throw so other tests in this suite aren't affected.
    registerEncryptionHooks({
      ...encryptionHooks,
      encrypts: (klass: any) => {
        throw new Error(`${klass?.name ?? "Model"}.encrypts() — not loaded`);
      },
    });
  });
});
