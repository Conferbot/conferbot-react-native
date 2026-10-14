/**
 * Agent message text for a native bubble. AI replies arrive as markdown
 * wrapped in <p> (embed-server aiAgentHandlerService), a person's as the
 * inbox editor's HTML. Both become one small markdown subset - paragraphs,
 * "- " / "1." lists, **bold**, _italic_, `code`, [links](https://...) and
 * bare links - parsed into blocks of inline runs the bubble draws with
 * nested <Text>. Never HTML on screen, never a script: only http(s),
 * mailto and tel links survive. Pure.
 */

export type Inline =
  | { kind: 'text'; text: string }
  | { kind: 'bold'; text: string }
  | { kind: 'italic'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'link'; text: string; url: string };

export type Block =
  | { kind: 'paragraph'; inlines: Inline[] }
  | { kind: 'bullet'; inlines: Inline[] }
  | { kind: 'number'; n: number; inlines: Inline[] };

const ENTITIES: Record<string, string> = { '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&#x27;': "'" };
const decode = (s: string) => s.replace(/&(nbsp|amp|lt|gt|quot|#39|#x27);/g, (m) => ENTITIES[m] || m);

export const safeLinkUrl = (url: string): string => {
  const u = String(url || '').trim();
  return /^(https?:\/\/|mailto:|tel:)/i.test(u) ? u : '';
};

/** The message as markdown: the inbox's HTML tags turned into their markdown. */
export const htmlToMarkdown = (html: string): string => {
  if (!html) return '';
  return decode(
    String(html)
      .replace(/\r\n?/g, '\n')
      .replace(/<a\s[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_m, url, text) => {
        const label = text.replace(/<[^>]+>/g, '').trim();
        return safeLinkUrl(url) ? `[${label || url}](${url})` : label;
      })
      .replace(/<(strong|b)>([\s\S]*?)<\/\1>/gi, '**$2**')
      .replace(/<(em|i)>([\s\S]*?)<\/\1>/gi, '_$2_')
      .replace(/<code>([\s\S]*?)<\/code>/gi, '`$1`')
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
const INLINE = /\*\*([^*]+)\*\*|__([^_]+)__|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)|(^|[^\w*])[*_]([^*_\n]+)[*_](?![\w*])|(https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"])/g;

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
  }
  push(line.slice(last));
  return out;
};

/** The text as blocks: list items, and paragraphs (a single newline is a line break). */
export const parseChatMarkdown = (markdown: string): Block[] => {
  const blocks: Block[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ kind: 'paragraph', inlines: parseInline(para.join('\n')) });
    para = [];
  };
  for (const raw of String(markdown || '').split('\n')) {
    const line = raw.trim();
    const bullet = /^[-*•]\s+(.*)$/.exec(line);
    const numbered = /^(\d{1,3})[.)]\s+(.*)$/.exec(line);
    if (bullet) {
      flush();
      blocks.push({ kind: 'bullet', inlines: parseInline(bullet[1]) });
    } else if (numbered) {
      flush();
      blocks.push({ kind: 'number', n: Number(numbered[1]), inlines: parseInline(numbered[2]) });
    } else if (!line) {
      flush();
    } else {
      para.push(line.replace(/^#{1,6}\s+/, ''));
    }
  }
  flush();
  return blocks;
};

/** Plain text of the blocks (accessibility label, transcript). */
export const blocksToPlainText = (blocks: Block[]): string =>
  blocks
    .map((b) => {
      const text = b.inlines.map((i) => i.text).join('');
      return b.kind === 'bullet' ? `• ${text}` : b.kind === 'number' ? `${b.n}. ${text}` : text;
    })
    .join('\n');
