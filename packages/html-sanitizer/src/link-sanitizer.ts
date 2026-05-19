// Rails parallel: lib/rails/html/sanitizer.rb -> class LinkSanitizer.
// Removes <a> tags and href attributes, leaving the link text intact.

import { Sanitizer, shortCircuit } from "./sanitizer.js";
import { unwrapTagsAndStripAttributes } from "./engine.js";

export class LinkSanitizer extends Sanitizer {
  sanitize(html: string | null | undefined): string | null | undefined {
    const early = shortCircuit(html);
    if (early !== false) return early;
    return unwrapTagsAndStripAttributes(html as string, ["a"], ["href"]);
  }
}
