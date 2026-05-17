/**
 * ActionDispatch::AssertionResponse
 *
 * Abstracts an asserted response. Accepts an explicit status code
 * (Integer or numeric String) or a symbol pseudo-code (`:success`,
 * `:missing`, `:redirect`, `:error`) for the canonical status ranges,
 * plus any of Rack's symbolic status names (e.g. `:not_found` → 404).
 */

import { HTTP_STATUS_CODES, statusCode as rackStatusCode } from "@blazetrails/rack";

const GENERIC_RESPONSE_CODES: Record<string, string> = {
  success: "2XX",
  missing: "404",
  redirect: "3XX",
  error: "5XX",
};

const GENERIC_INVERT: Record<string, string> = {};
for (const [name, code] of Object.entries(GENERIC_RESPONSE_CODES)) {
  GENERIC_INVERT[code] = name;
}

export class AssertionResponse {
  readonly code: string;
  readonly name: string;

  constructor(codeOrName: number | string) {
    const isNumeric = typeof codeOrName === "number" || /^\d+$/.test(codeOrName);
    if (isNumeric) {
      const code = typeof codeOrName === "number" ? codeOrName : parseInt(codeOrName, 10);
      const n = nameFromCode(code);
      if (n === undefined) {
        throw new Error(`Invalid response code: ${codeOrName}`);
      }
      this.name = n;
      this.code = String(codeOrName);
    } else {
      this.name = codeOrName as string;
      const c = codeFromName(codeOrName as string);
      if (c === undefined) {
        throw new Error(`Invalid response name: ${codeOrName}`);
      }
      this.code = c;
    }
  }

  codeAndName(): string {
    return `${this.code}: ${this.name}`;
  }
}

function codeFromName(name: string): string | undefined {
  if (GENERIC_RESPONSE_CODES[name]) return GENERIC_RESPONSE_CODES[name];
  try {
    return String(rackStatusCode(name));
  } catch {
    return undefined;
  }
}

function nameFromCode(code: number): string | undefined {
  const codeStr = String(code);
  if (GENERIC_INVERT[codeStr]) return GENERIC_INVERT[codeStr];
  return HTTP_STATUS_CODES[code];
}
