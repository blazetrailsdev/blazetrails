/**
 * Wraps sql-wasm.js so it can be loaded via importScripts() in a service worker.
 * The original file uses `module.exports` which doesn't exist in SW scope.
 * This wrapper provides a shim so `initSqlJs` lands on `self`.
 */
import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = resolve(__dirname, "../node_modules/sql.js/dist/sql-wasm.js");
const dest = resolve(__dirname, "../static/sql-wasm-sw.js");

const original = readFileSync(src, "utf-8");

const wrapped = `// sql.js wrapped for service worker importScripts()
var module = { exports: {} };
var exports = module.exports;
${original}
self.initSqlJs = module.exports.default || module.exports;
`;

writeFileSync(dest, wrapped);
console.log("Built static/sql-wasm-sw.js");
