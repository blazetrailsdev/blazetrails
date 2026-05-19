// Rails parallel: lib/rails/html/sanitizer.rb -> class Sanitizer.
// Abstract base for FullSanitizer / LinkSanitizer / SafeListSanitizer.

export abstract class Sanitizer {
  abstract sanitize(
    html: string | null | undefined,
    options?: SanitizeOptions,
  ): string | null | undefined;
}

export interface SanitizeOptions {
  tags?: Iterable<string>;
  attributes?: Iterable<string>;
  // scrubber? — added in PR 3
}

/**
 * @internal
 * Shared early-exit for sanitize() implementations. Matches Rails'
 * ComposedSanitize: nil → nil, "" → "".
 */
export function shortCircuit(html: string | null | undefined): string | null | undefined | false {
  if (html == null) return html;
  if (html.length === 0) return html;
  return false;
}
