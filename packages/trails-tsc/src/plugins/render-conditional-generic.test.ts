import { describe, expect, it } from "vitest";
import ts from "typescript";

/**
 * Inline type stub that mirrors the actionview render conditional generic.
 * Self-contained so the test doesn't depend on module resolution.
 */
const TYPE_STUB = `
// --- TemplateRegistry ---
export interface TemplateRegistry {}
export type TemplateLocals<T> = [T] extends [never] ? Record<string, unknown> : T;

// --- RenderOptions conditional generic ---
type RenderSingleOptions<P extends string> = {
  partial: P;
  collection?: undefined;
  as?: string;
  spacerTemplate?: undefined;
} & (P extends keyof TemplateRegistry
  ? {} extends TemplateLocals<TemplateRegistry[P]>
    ? { locals?: TemplateLocals<TemplateRegistry[P]> }
    : { locals: TemplateLocals<TemplateRegistry[P]> }
  : { locals?: Record<string, unknown> });

type RenderCollectionOptions<P extends string> = {
  partial: P;
  collection: readonly unknown[];
  as?: string;
  spacerTemplate?: string;
} & (P extends keyof TemplateRegistry
  ? { locals?: Partial<TemplateLocals<TemplateRegistry[P]>> }
  : { locals?: Record<string, unknown> });

export type RenderOptions<P extends string> = RenderSingleOptions<P> | RenderCollectionOptions<P>;

export declare function render<P extends string>(options: RenderOptions<P>): string;

// --- Registry augmentation ---
declare module "/stub/module" {
  interface TemplateRegistry {
    "users/user": { user: string; role?: string };
    "static/header": { title?: string };
  }
}
`;

function getDiagnostics(source: string): ts.Diagnostic[] {
  const fileName = "/virtual/test.ts";
  const stubPath = "/stub/module.ts";
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.ES2022, true);
  const stubFile = ts.createSourceFile(stubPath, TYPE_STUB, ts.ScriptTarget.ES2022, true);
  const defaultHost = ts.createCompilerHost({});
  const host: ts.CompilerHost = {
    ...defaultHost,
    fileExists: (f) => f === fileName || f === stubPath || defaultHost.fileExists(f),
    readFile: (f) =>
      f === fileName ? source : f === stubPath ? TYPE_STUB : defaultHost.readFile(f),
    getSourceFile: (f, lv, onError) => {
      if (f === fileName) return sourceFile;
      if (f === stubPath) return stubFile;
      return defaultHost.getSourceFile(f, lv, onError);
    },
    resolveModuleNames: (moduleNames) =>
      moduleNames.map((name) =>
        name === "/stub/module"
          ? { resolvedFileName: stubPath, isExternalLibraryImport: false }
          : undefined,
      ),
  };
  const program = ts.createProgram({
    rootNames: [fileName],
    options: {
      noEmit: true,
      types: [],
      skipLibCheck: true,
      strict: true,
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
    },
    host,
  });
  return [
    ...program.getSemanticDiagnostics(sourceFile),
    ...program.getSyntacticDiagnostics(sourceFile),
  ];
}

function diagnosticCodes(source: string): number[] {
  return getDiagnostics(source).map((d) => d.code);
}

function diagnosticMessages(source: string): string[] {
  return getDiagnostics(source).map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n"));
}

describe("render conditional generic — semantic diagnostics", () => {
  it("known partial with required locals omitted produces TS error", () => {
    const codes = diagnosticCodes(`
      import { render } from "/stub/module";
      render({ partial: "users/user" });
    `);
    expect(codes.length).toBeGreaterThan(0);
    expect(codes.some((c) => c === 2345 || c === 2739)).toBe(true);
  });

  it("known partial with wrong locals shape produces TS error", () => {
    const codes = diagnosticCodes(`
      import { render } from "/stub/module";
      render({ partial: "users/user", locals: { wrong: 1 } });
    `);
    expect(codes.length).toBeGreaterThan(0);
  });

  it("known partial with all-optional locals allows omitting locals", () => {
    const diags = getDiagnostics(`
      import { render } from "/stub/module";
      render({ partial: "static/header" });
    `);
    expect(diags).toEqual([]);
  });

  it("known partial with correct locals produces no error", () => {
    const diags = getDiagnostics(`
      import { render } from "/stub/module";
      render({ partial: "users/user", locals: { user: "Alice" } });
    `);
    expect(diags).toEqual([]);
  });

  it("known partial with correct locals + optional field produces no error", () => {
    const diags = getDiagnostics(`
      import { render } from "/stub/module";
      render({ partial: "users/user", locals: { user: "Alice", role: "admin" } });
    `);
    expect(diags).toEqual([]);
  });

  it("dynamic string-typed name falls back permissively (no error)", () => {
    const diags = getDiagnostics(`
      import { render } from "/stub/module";
      const name: string = "x";
      render({ partial: name });
      render({ partial: name, locals: { anything: 42 } });
    `);
    expect(diags).toEqual([]);
  });

  it("known partial missing required 'user' in locals produces TS error", () => {
    const codes = diagnosticCodes(`
      import { render } from "/stub/module";
      render({ partial: "users/user", locals: { role: "admin" } });
    `);
    expect(codes.length).toBeGreaterThan(0);
  });

  it("required-locals error has diagnostic code 2345 or 2739", () => {
    const codes = diagnosticCodes(`
      import { render } from "/stub/module";
      render({ partial: "users/user" });
    `);
    const relevant = codes.filter((c) => c === 2345 || c === 2739);
    expect(relevant.length).toBeGreaterThan(0);
  });

  it("wrong-shape error message references the missing property", () => {
    const messages = diagnosticMessages(`
      import { render } from "/stub/module";
      render({ partial: "users/user", locals: { wrong: 1 } });
    `);
    const joined = messages.join("\n");
    expect(joined.length).toBeGreaterThan(0);
    expect(joined).toMatch(/user|wrong/i);
  });
});
