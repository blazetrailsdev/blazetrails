/**
 * TS language service plugin — Phase 2c-b (plan §2.4). Registered in
 * a host project's `tsconfig.json` under `compilerOptions.plugins` as
 * `{ "name": "@blazetrails/trails-tsc/lsp" }`. Virtualizes `.tse`
 * sources on the fly so tsserver type-checks them in the IDE without
 * a prebuild. The on-disk mirror is still required at runtime —
 * `trails-tsc-views dev` covers that.
 */

import type ts from "typescript";
import * as fs from "node:fs";
import * as path from "node:path";
import { virtualizeTse } from "./plugins/tse.js";

interface PluginCreateInfo {
  languageService: ts.LanguageService;
  languageServiceHost: ts.LanguageServiceHost;
  project: { getCurrentDirectory(): string };
  config: { viewsDir?: string };
}

export function init(modules: { typescript: typeof ts }): {
  create(info: PluginCreateInfo): ts.LanguageService;
  getExternalFiles(project: { getCurrentDirectory(): string }): string[];
} {
  const tsLib = modules.typescript;

  const virtualize = (content: string): string => {
    try {
      return virtualizeTse(content);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return `const __tseFailure: never = ${JSON.stringify(msg)}; export default __tseFailure;\n`;
    }
  };

  return {
    create(info) {
      const host = info.languageServiceHost;
      const origReadFile = host.readFile?.bind(host);
      const origGetSnapshot = host.getScriptSnapshot.bind(host);
      const origGetScriptKind = host.getScriptKind?.bind(host);

      host.readFile = (p, enc) => {
        const raw = origReadFile?.(p, enc);
        return p.endsWith(".tse") && typeof raw === "string" ? virtualize(raw) : raw;
      };

      host.getScriptSnapshot = (p) => {
        if (!p.endsWith(".tse")) return origGetSnapshot(p);
        let raw: string | undefined = origReadFile?.(p, "utf8");
        if (raw === undefined) {
          try {
            raw = fs.readFileSync(p, "utf8");
          } catch {
            /* file absent */
          }
        }
        return raw === undefined ? undefined : tsLib.ScriptSnapshot.fromString(virtualize(raw));
      };

      host.getScriptKind = (p) =>
        p.endsWith(".tse")
          ? tsLib.ScriptKind.TS
          : (origGetScriptKind?.(p) ?? tsLib.ScriptKind.Unknown);

      return info.languageService;
    },

    getExternalFiles(project) {
      return listTseFiles(path.resolve(project.getCurrentDirectory(), "app/views"));
    },
  };
}

function listTseFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listTseFiles(full));
    else if (entry.isFile() && entry.name.endsWith(".tse")) out.push(full);
  }
  return out;
}

export default init;
