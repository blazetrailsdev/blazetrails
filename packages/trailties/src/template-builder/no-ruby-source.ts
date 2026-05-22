// Runtime-safe Ruby-source guard. Kept in its own module (no `typescript`
// import) so generator actions can pull it in without forcing the
// `typescript` peer into the runtime dependency graph. `testing.ts`
// re-exports this symbol for test-side callers.

const RUBY_RE = /^\s*(class|module|def)\s+\w+($|\s+<)/m;

export function assertNoRubySource(text: string): void {
  const m = text.match(RUBY_RE);
  if (m) {
    throw new Error(`Ruby-like source detected: ${JSON.stringify(m[0])}`);
  }
}
