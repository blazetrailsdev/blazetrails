/**
 * AR-only vitest setupFile. Wired into the `activerecord` project in
 * `vitest.config.ts`; the sibling `test-setup.ts` is shared with the
 * non-AR `other` project, so anything that imports the AR test adapter
 * (and thus opens a DB connection at module load) belongs here, not
 * there.
 */

import { beforeEach } from "vitest";
import { resetTestAdapterState } from "./test-adapter.js";

// Wipe shared test-adapter state before every test so a prior test's
// _createdTables/_declaredColumns can't leak into the next test's
// schema setup.
beforeEach(async () => {
  await resetTestAdapterState();
});
