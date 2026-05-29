import { afterEach } from "vitest";
import { restoreEstablishedVisitor } from "./arel-visitor-sync.js";

// After each test, restore the global Arel visitor to the established
// connection's dialect — or the default `Visitors.ToSql` when nothing is
// established. AR handler-suite tests keep their dialect visitor across tests
// without a per-file `beforeEach` re-sync; non-AR tests (which never establish
// a connection) still reset to a clean default, so a dialect can't leak
// between unrelated arel-package tests. Tests that set a dialect visitor for
// their own duration still manage it themselves (see node.test.ts's
// try/finally pattern).
afterEach(() => {
  restoreEstablishedVisitor();
});
