import ts from "typescript";

export function parseTs(source: string): { diagnostics: readonly ts.Diagnostic[] } {
  const sf = ts.createSourceFile(
    "__test__.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const diagnostics =
    (sf as unknown as { parseDiagnostics?: ts.Diagnostic[] }).parseDiagnostics ?? [];
  return { diagnostics };
}

const RUBY_RE = /^\s*(class|module|def)\s+\w+($|\s+<)/m;

export function assertNoRubySource(text: string): void {
  const m = text.match(RUBY_RE);
  if (m) {
    throw new Error(`Ruby-like source detected: ${JSON.stringify(m[0])}`);
  }
}
