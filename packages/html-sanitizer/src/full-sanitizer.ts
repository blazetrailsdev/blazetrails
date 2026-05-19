// Rails parallel: lib/rails/html/sanitizer.rb -> class FullSanitizer.
// Removes all tags from HTML, leaving only the text content. Scripts,
// forms, and comments are stripped along with their contents.

import { Sanitizer, shortCircuit } from "./sanitizer.js";
import { stripAllTags } from "./engine.js";

export class FullSanitizer extends Sanitizer {
  sanitize(html: string | null | undefined): string | null | undefined {
    const early = shortCircuit(html);
    if (early !== false) return early;
    return stripAllTags(html as string);
  }
}
