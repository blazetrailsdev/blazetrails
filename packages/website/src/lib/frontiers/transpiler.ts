/**
 * TypeScript transpiler using Monaco's built-in TypeScript service.
 * Falls back to regex-based stripping if Monaco isn't loaded yet.
 */

let tsWorkerGetter: (() => Promise<any>) | null = null;

/**
 * Initialize the transpiler with Monaco's TypeScript worker.
 * Call this after Monaco is loaded.
 */
export async function initTranspiler(monaco: typeof import("monaco-editor")) {
  try {
    const getWorker = await monaco.languages.typescript.getTypeScriptWorker();
    tsWorkerGetter = async () => {
      // Get the worker proxy — we need a model URI, use a dummy
      const uri = monaco.Uri.parse("file:///transpile-temp.ts");
      let model = monaco.editor.getModel(uri);
      if (!model) {
        model = monaco.editor.createModel("", "typescript", uri);
      }
      return getWorker(uri);
    };
  } catch {
    // Monaco TS worker not available, fall back to regex
  }
}

/**
 * Transpile TypeScript to JavaScript.
 * Uses Monaco's TS worker if available, otherwise falls back to regex stripping.
 */
export async function transpile(code: string, filename = "file.ts"): Promise<string> {
  if (tsWorkerGetter) {
    try {
      return await transpileViaMonaco(code, filename);
    } catch {
      // Fall through to regex
    }
  }
  return stripTypes(code);
}

async function transpileViaMonaco(code: string, filename: string): Promise<string> {
  const monaco = await import("monaco-editor");
  const uri = monaco.Uri.parse(`file:///${filename}`);

  let model = monaco.editor.getModel(uri);
  const existed = !!model;
  if (!model) {
    model = monaco.editor.createModel(code, "typescript", uri);
  } else {
    model.setValue(code);
  }

  try {
    const getWorker = await monaco.languages.typescript.getTypeScriptWorker();
    const worker = await getWorker(uri);
    const output = await worker.getEmitOutput(uri.toString());

    if (output.outputFiles.length > 0) {
      return output.outputFiles[0].text;
    }
    return stripTypes(code);
  } finally {
    if (!existed) model.dispose();
  }
}

/**
 * Regex-based fallback for environments without Monaco (service worker, tests).
 */
export function stripTypes(code: string): string {
  // Remove import/export type statements
  code = code.replace(/^\s*(import|export)\s+type\s+[^;]*;?\s*$/gm, "");
  // Remove type keyword from mixed imports
  code = code.replace(/,?\s*type\s+\w+/g, (match, offset, str) => {
    // Only inside import { } blocks
    const before = str.lastIndexOf("{", offset);
    const after = str.indexOf("}", offset);
    if (before !== -1 && after !== -1 && before < offset && after > offset) return "";
    return match;
  });
  // Remove type annotations
  code = code.replace(
    /:\s*(?:string|number|boolean|any|void|unknown|never|null|undefined|Record<[^>]*>|Array<[^>]*>|Promise<[^>]*>|Map<[^>]*>|Set<[^>]*>|[A-Z]\w*(?:<[^>]*>)?(?:\[\])?(?:\s*\|\s*(?:string|number|boolean|null|undefined|[A-Z]\w*(?:<[^>]*>)?))*)\s*(?=[,)=;\n{])/g,
    " ",
  );
  // Remove `as X` casts
  code = code.replace(
    /\s+as\s+(?:const|string|number|boolean|any|unknown|[A-Z]\w*(?:<[^>]*>)?)/g,
    "",
  );
  // Remove interface/type declarations
  code = code.replace(/^\s*(?:export\s+)?(?:interface|type)\s+\w+[^{]*\{[^}]*\}\s*;?\s*$/gm, "");
  // Remove generic type params
  code = code.replace(/<\w+(?:\s*,\s*\w+)*(?:\s+extends\s+[^>]+)?>\s*\(/g, "(");
  // Remove non-null assertions
  code = code.replace(/(\w)!/g, "$1");
  return code;
}
