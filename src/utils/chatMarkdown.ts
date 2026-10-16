/**
 * Agent message text for a native bubble. AI replies arrive as markdown
 * wrapped in <p> (embed-server aiAgentHandlerService), a person's as the
 * inbox editor's HTML. Both become one markdown subset, parsed into blocks
 * of inline runs the bubble draws with nested <Text>. What the web's
 * renderer (conferbot-widget utils/agentHtml.ts) draws:
 *
 *   blocks   paragraphs, "- " / "1." lists, # headings (levels 3-6; # and
 *            ## are drawn as 4, as the web folds h1/h2 into h4), | tables |
 *            with a |---| rule, and from a person's HTML: <blockquote>
 *            ("> " lines here) and <pre> (``` fences here)
 *   inline   **bold**, _italic_, `code`, ~~strikethrough~~ (<s>, <del>),
 *            [links](https://...) and bare links
 *
 * Never HTML on screen, never a script: only http(s), mailto and tel links
 * survive. Pure.
 */

export type Inline =
  | { kind: 'text'; text: string }
  | { kind: 'bold'; text: string }
  | { kind: 'italic'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'strike'; text: string }
  | { kind: 'link'; text: string; url: string };

export type Block =
  | { kind: 'paragraph'; inlines: Inline[] }
  | { kind: 'bullet'; inlines: Inline[] }
  | { kind: 'number'; n: number; inlines: Inline[] }
  | { kind: 'heading'; level: 3 | 4 | 5 | 6; inlines: Inline[] }
  | { kind: 'quote'; inlines: Inline[] }
  | { kind: 'pre'; text: string }
  | { kind: 'table'; head: Inline[][]; rows: Inline[][][] };

const ENTITIES: Record<string, string> = { '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&#x27;': "'" };
const decode = (s: string) => s.replace(/&(nbsp|amp|lt|gt|quot|#39|#x27);/g, (m) => ENTITIES[m] || m);

export const safeLinkUrl = (url: string): string => {
  const u = String(url || '').trim();
  return /^(https?:\/\/|mailto:|tel:)/i.test(u) ? u : '';
};

// A cell's text: no tags, no line breaks, and its own "|" kept as text.
const cellText = (html: string) =>
  html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\|/g, '\\|');

/** An HTML table as a markdown one: the first row is the head. */
const tableToMarkdown = (inner: string): string => {
  const rows = [...inner.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((m) =>
    [...m[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((c) => cellText(c[1]))
  ).filter((r) => r.length);
  if (!rows.length) return '';
  const line = (cells: string[]) => `| ${cells.join(' | ')} |`;
  return `\n\n${[line(rows[0]), line(rows[0].map(() => '---')), ...rows.slice(1).map(line)].join('\n')}\n\n`;
};

/** The message as markdown: the inbox's HTML tags turned into their markdown. */
export const htmlToMarkdown = (html: string): string => {
  if (!html) return '';
  return decode(
    String(html)
      .replace(/\r\n?/g, '\n')
      // Preformatted text keeps its lines and nothing inside is formatted.
      .replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (_m, body) => {
        const text = body.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/^\n+|\n+$/g, '');
        return `\n\n\`\`\`\n${text}\n\`\`\`\n\n`;
      })
      .replace(/<a\s[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_m, url, text) => {
        const label = text.replace(/<[^>]+>/g, '').trim();
        return safeLinkUrl(url) ? `[${label || url}](${url})` : label;
      })
      .replace(/<(strong|b)>([\s\S]*?)<\/\1>/gi, '**$2**')
      .replace(/<(em|i)>([\s\S]*?)<\/\1>/gi, '_$2_')
      .replace(/<code>([\s\S]*?)<\/code>/gi, '`$1`')
      .replace(/<(s|del|strike)>([\s\S]*?)<\/\1>/gi, '~~$2~~')
      // h1 / h2 are drawn as h4, as the web's sanitizer folds them.
      .replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_m, n, text) => {
        const level = Number(n) <= 2 ? 4 : Number(n);
        return `\n\n${'#'.repeat(level)} ${text.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()}\n\n`;
      })
      .replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (_m, inner) => tableToMarkdown(inner))
      .replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_m, inner) => {
        const text = inner
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<\/p>\s*<p[^>]*>/gi, '\n')
          .replace(/<[^>]+>/g, '')
          .split('\n')
          .map((l: string) => l.trim())
          .filter(Boolean);
        return `\n\n${text.map((l: string) => `> ${l}`).join('\n')}\n\n`;
      })
      .replace(/<li[^>]*>/gi, '\n- ')
      .replace(/<\/(li|ul|ol)>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
      .replace(/<\/?(p|div|ul|ol)[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, '')
  )
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

// No lookbehind: older iOS JavaScriptCore cannot parse it. An italic's
// leading character is captured (group 6) and given back as text.
const INLINE = /\*\*([^*]+)\*\*|__([^_]+)__|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)|(^|[^\w*])[*_]([^*_\n]+)[*_](?![\w*])|(https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"])|~~([^~\n]+)~~/g;

/** One line's inline runs. */
export const parseInline = (line: string): Inline[] => {
  const out: Inline[] = [];
  let last = 0;
  const push = (text: string) => {
    if (!text) return;
    const prev = out[out.length - 1];
    if (prev && prev.kind === 'text') prev.text += text;
    else out.push({ kind: 'text', text });
  };
  const re = new RegExp(INLINE.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    push(line.slice(last, m.index));
    last = m.index + m[0].length;
    if (m[1] || m[2]) out.push({ kind: 'bold', text: m[1] || m[2] });
    else if (m[3]) out.push({ kind: 'code', text: m[3] });
    else if (m[4]) {
      const url = safeLinkUrl(m[5]);
      if (url) out.push({ kind: 'link', text: m[4], url });
      else push(m[4]);
    } else if (m[7]) {
      push(m[6] || '');
      out.push({ kind: 'italic', text: m[7] });
    } else if (m[8]) out.push({ kind: 'link', text: m[8], url: m[8] });
    else if (m[9]) out.push({ kind: 'strike', text: m[9] });
  }
  push(line.slice(last));
  return out;
};

// A markdown table: a header row, a |---| rule, then rows (web agentHtml.ts).
const TABLE_ROW_RE = /^\s*\|.*\|\s*$/;
const TABLE_RULE_RE = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;
const HEADING_RE = /^#{1,6}\s+(.*?)\s*#*\s*$/;

/** A row's cells; a "\|" inside a cell is its own text (no lookbehind: older JavaScriptCore). */
export const tableCells = (line: string): string[] => {
  const cells: string[] = [];
  let cell = '';
  const s = line.trim();
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\' && s[i + 1] === '|') {
      cell += '|';
      i++;
    } else if (s[i] === '|') {
      cells.push(cell);
      cell = '';
    } else cell += s[i];
  }
  cells.push(cell);
  // The outer pipes open and close the row.
  if (s.startsWith('|')) cells.shift();
  if (s.endsWith('|') && !s.endsWith('\\|')) cells.pop();
  return cells.map((c) => c.trim());
};

/** The text as blocks: list items, headings, tables, quotes, code and paragraphs (a single newline is a line break). */
export const parseChatMarkdown = (markdown: string): Block[] => {
  const blocks: Block[] = [];
  let para: string[] = [];
  let quote: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ kind: 'paragraph', inlines: parseInline(para.join('\n')) });
    para = [];
    if (quote.length) blocks.push({ kind: 'quote', inlines: parseInline(quote.join('\n')) });
    quote = [];
  };
  const lines = String(markdown || '').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();
    // ``` fences: the lines as they are, nothing formatted.
    if (/^```/.test(line)) {
      flush();
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i].trim())) body.push(lines[i++]);
      blocks.push({ kind: 'pre', text: body.join('\n') });
      continue;
    }
    // A table: this row, a rule under it, and every row after.
    if (TABLE_ROW_RE.test(raw) && TABLE_RULE_RE.test(lines[i + 1] || '') && (lines[i + 1] || '').includes('-')) {
      flush();
      const head = tableCells(raw);
      i += 2;
      const rows: Inline[][][] = [];
      while (i < lines.length && TABLE_ROW_RE.test(lines[i])) {
        const cells = tableCells(lines[i++]);
        rows.push(head.map((_, k) => parseInline(cells[k] || '')));
      }
      i -= 1;
      blocks.push({ kind: 'table', head: head.map((c) => parseInline(c)), rows });
      continue;
    }
    const quoted = /^>\s?(.*)$/.exec(line);
    if (quoted) {
      if (para.length) {
        blocks.push({ kind: 'paragraph', inlines: parseInline(para.join('\n')) });
        para = [];
      }
      quote.push(quoted[1]);
      continue;
    }
    if (quote.length) flush();
    const bullet = /^[-*+•]\s+(.*)$/.exec(line);
    const numbered = /^(\d{1,3})[.)]\s+(.*)$/.exec(line);
    const heading = HEADING_RE.exec(line);
    if (bullet) {
      flush();
      blocks.push({ kind: 'bullet', inlines: parseInline(bullet[1]) });
    } else if (numbered) {
      flush();
      blocks.push({ kind: 'number', n: Number(numbered[1]), inlines: parseInline(numbered[2]) });
    } else if (heading) {
      flush();
      const hashes = (/^#+/.exec(line) as RegExpExecArray)[0].length;
      const level = (hashes <= 2 ? 4 : hashes) as 3 | 4 | 5 | 6;
      blocks.push({ kind: 'heading', level, inlines: parseInline(heading[1]) });
    } else if (!line) {
      flush();
    } else {
      para.push(line);
    }
  }
  flush();
  return blocks;
};

const inlineText = (inlines: Inline[]) => inlines.map((i) => i.text).join('');

/** Plain text of the blocks (accessibility label, transcript). */
export const blocksToPlainText = (blocks: Block[]): string =>
  blocks
    .map((b) => {
      if (b.kind === 'pre') return b.text;
      if (b.kind === 'table') return [b.head, ...b.rows].map((r) => r.map(inlineText).join(' | ')).join('\n');
      const text = inlineText(b.inlines);
      return b.kind === 'bullet' ? `• ${text}` : b.kind === 'number' ? `${b.n}. ${text}` : text;
    })
    .join('\n');
