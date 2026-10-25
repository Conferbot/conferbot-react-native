/**
 * Placeholder citation markers in AI answers, as embed-server
 * utils/citationMarkers.js stripPlaceholderMarkers.
 *
 * The server strips markers from new answers, but answers saved before that
 * can come back in restored history with an echoed placeholder ("[n]",
 * "[N]", "[1, n]") or a label ("[source]", "[web:2]"). Conservative on
 * purpose: a bracket goes only when every part is a number or one of the
 * placeholder words, and at least one part is not a plain number ("[2]"
 * could be the author's own). "[Klik hier]", a markdown link "[n](url)" and
 * a task-list "- [x]" stay as written.
 */

// Words a model writes in place of (or in front of) a passage number.
const WORDS = [
  'n', 'x', 'k', '#', 'nr', 'no', 'num', 'number',
  'source', 'sources', 'citation', 'citations', 'cite', 'ref', 'refs', 'reference', 'references',
  'passage', 'passages', 'knowledge', 'kb', 'faq', 'context', 'doc', 'docs', 'website', 'web',
  'instruction', 'instructions',
]
  .map((w) => w.replace(/#/, '\\#'))
  .join('|');

// One part of a marker: "2", "n", "source", "source 2", "web:2", "passage n".
const PART = `(?:\\d+|(?:${WORDS})(?:[ \\t]*[:#-]?[ \\t]*(?:\\d+|n))?)`;
// A whole marker, with the one space before it. Not a markdown link ("[n](url)").
const MARKER_SRC = `[ \\t]?\\[[ \\t]*${PART}(?:[ \\t]*[,;][ \\t]*${PART})*[ \\t]*\\](?!\\()`;
const NUMERIC = /^\[\s*\d+(?:\s*[,;]\s*\d+)*\s*\]$/;

// A list checkbox ("- [x] done", "* [X]") is the author's, not a marker.
const isCheckbox = (marker: string, text: string, offset: number): boolean =>
  /^\s*\[\s*x\s*\]$/i.test(marker) && /(^|\n)[ \t]*[-*+][ \t]*$/.test(text.slice(Math.max(0, offset - 40), offset));

/** The text without its placeholder markers; unchanged when it has none. */
export const stripPlaceholderMarkers = (text: string): string => {
  const s = String(text || '');
  let changed = false;
  const out = s.replace(new RegExp(MARKER_SRC, 'gi'), (m: string, offset: number) => {
    if (isCheckbox(m, s, offset) || NUMERIC.test(m.trim())) return m;
    changed = true;
    return '';
  });
  // Tidy what a removed marker leaves: "zit ." and "zit ,".
  return changed ? out.replace(/[ \t]+([.,;:!?])/g, '$1').trim() : s;
};
