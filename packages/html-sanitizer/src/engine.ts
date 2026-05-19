// Internal seam over sanitize-html. The rest of the package never imports
// sanitize-html directly; swapping the engine is a one-file change.

import sanitizeHtml from "sanitize-html";

/**
 * @internal
 * Strip every tag, leaving text content only. Mirrors Loofah's
 * TextOnlyScrubber used by Rails' FullSanitizer.
 */
export function stripAllTags(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [],
    allowedAttributes: {},
  });
}

/**
 * @internal
 * "Unwrap" the listed tags: drop the open/close markers but keep the
 * inner text, and strip the listed attributes from any element that
 * survives. Mirrors Loofah's TargetScrubber used by Rails' LinkSanitizer
 * (tags: ['a'], attributes: ['href']).
 *
 * Implementation note: sanitize-html has no native blocklist mode. We
 * compose the allowedTags from its built-in default set minus the tags
 * we want to unwrap. This means tags outside sanitize-html's default
 * set (e.g. <form>, <iframe>) are also stripped — a divergence from
 * Loofah's permissive TargetScrubber, but a safer default for a web
 * framework anyway. Document in user-facing copy.
 */
export function unwrapTagsAndStripAttributes(
  html: string,
  tagsToUnwrap: readonly string[],
  attributesToStrip: readonly string[],
): string {
  const unwrap = new Set(tagsToUnwrap.map((t) => t.toLowerCase()));
  const stripAttrs = new Set(attributesToStrip.map((a) => a.toLowerCase()));

  const allowedTags = sanitizeHtml.defaults.allowedTags.filter((t) => !unwrap.has(t.toLowerCase()));

  return sanitizeHtml(html, {
    allowedTags,
    // Allow every attribute on every surviving tag, then strip the
    // targeted ones via transformTags.
    allowedAttributes: false,
    transformTags:
      stripAttrs.size === 0
        ? undefined
        : {
            "*": (tagName, attribs) => {
              const filtered: Record<string, string> = {};
              for (const [k, v] of Object.entries(attribs)) {
                if (!stripAttrs.has(k.toLowerCase())) filtered[k] = v;
              }
              return { tagName, attribs: filtered };
            },
          },
  });
}
