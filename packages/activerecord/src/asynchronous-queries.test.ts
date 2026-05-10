import { describe, it } from "vitest";

// The entire Rails test file (asynchronous_queries_test.rb) is permanently
// excluded — see scripts/api-compare/excluded-files.ts, entry for
// "asynchronous_queries_tracker.rb". Per-thread async session barriers
// (Concurrent::AtomicBoolean, ReadWriteLock) have no JS equivalent.
// These stubs exist only so test:compare doesn't flag the TS file as empty.

describe("AsynchronousQueriesTest", () => {
  it.skip("async select all", () => {
    // PERMANENT: ruby-only — see scripts/api-compare/excluded-files.ts for asynchronous_queries_tracker.rb
  });
});

describe("AsynchronousExecutorTypeTest", () => {
  it.skip("null configuration uses a single null executor by default", () => {
    // PERMANENT: ruby-only — see scripts/api-compare/excluded-files.ts for asynchronous_queries_tracker.rb
  });
  it.skip("one global thread pool is used when set with default concurrency", () => {
    // PERMANENT: ruby-only — see scripts/api-compare/excluded-files.ts for asynchronous_queries_tracker.rb
  });
  it.skip("concurrency can be set on global thread pool", () => {
    // PERMANENT: ruby-only — see scripts/api-compare/excluded-files.ts for asynchronous_queries_tracker.rb
  });
  it.skip("concurrency cannot be set with null executor or multi thread pool", () => {
    // PERMANENT: ruby-only — see scripts/api-compare/excluded-files.ts for asynchronous_queries_tracker.rb
  });
  it.skip("multi thread pool executor configuration", () => {
    // PERMANENT: ruby-only — see scripts/api-compare/excluded-files.ts for asynchronous_queries_tracker.rb
  });
  it.skip("multi thread pool is used only by configurations that enable it", () => {
    // PERMANENT: ruby-only — see scripts/api-compare/excluded-files.ts for asynchronous_queries_tracker.rb
  });
});

it.skip("async select failure", () => {
  // PERMANENT: ruby-only — see scripts/api-compare/excluded-files.ts for asynchronous_queries_tracker.rb
});
it.skip("async query from transaction", () => {
  // PERMANENT: ruby-only — see scripts/api-compare/excluded-files.ts for asynchronous_queries_tracker.rb
});
it.skip("async query cache", () => {
  // PERMANENT: ruby-only — see scripts/api-compare/excluded-files.ts for asynchronous_queries_tracker.rb
});
it.skip("async query foreground fallback", () => {
  // PERMANENT: ruby-only — see scripts/api-compare/excluded-files.ts for asynchronous_queries_tracker.rb
});
