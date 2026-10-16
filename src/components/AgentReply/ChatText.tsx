// @ts-nocheck
/**
 * An agent message's text: the markdown of utils/chatMarkdown.ts (the web's
 * utils/agentHtml.ts set) drawn with nested <Text> - lists, headings,
 * tables (scrolled sideways on a phone, as the web), quotes, preformatted
 * code, bold, italic, strikethrough, code and tappable links. `muted`: a
 * server fallback reply, the same bubble italic at 85% (web
 * _markAgentFallbackBubble).
 */
import React, { useMemo } from 'react';
import { Linking, ScrollView, Text, View, StyleSheet } from 'react-native';
import { parseChatMarkdown, blocksToPlainText, type Inline } from '../../utils/chatMarkdown';

export interface ChatTextProps {
  text: string;
  color: string;
  fontSize: number;
  lineHeight: number;
  linkColor?: string;
  onLinkPress?: (url: string) => void;
  /** A fallback reply: italic, slightly faded. */
  muted?: boolean;
}

// The text colour at `a` (web: color-mix(currentColor 18%, transparent)); as it is when not #rgb / #rrggbb.
const fade = (color: string, a: number): string => {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(color || '').trim());
  if (!m) return color;
  const h = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

// Heading sizes against the body text (web kb-prose: h3 17px, h4-h6 15.5px on 14.5px).
const HEADING_SCALE = { 3: 1.17, 4: 1.07, 5: 1.07, 6: 1.07 } as const;

export const ChatText: React.FC<ChatTextProps> = ({ text, color, fontSize, lineHeight, linkColor, onLinkPress, muted }) => {
  const blocks = useMemo(() => parseChatMarkdown(text), [text]);
  const open = (url: string) => (onLinkPress ? onLinkPress(url) : Linking.openURL(url).catch(() => {}));
  const base = { color, fontSize, lineHeight, ...(muted ? { fontStyle: 'italic' as const } : null) };
  const rule = { borderColor: fade(color, 0.18) };
  const bar = { borderColor: fade(color, 0.4) };

  const runs = (inlines: Inline[]) =>
    inlines.map((i, k) => {
      if (i.kind === 'bold') return <Text key={k} style={styles.bold}>{i.text}</Text>;
      if (i.kind === 'italic') return <Text key={k} style={styles.italic}>{i.text}</Text>;
      if (i.kind === 'code') return <Text key={k} style={styles.code}>{i.text}</Text>;
      if (i.kind === 'strike') return <Text key={k} style={styles.strike}>{i.text}</Text>;
      if (i.kind === 'link')
        return (
          <Text key={k} style={[styles.link, linkColor ? { color: linkColor } : null]} onPress={() => open(i.url)} accessibilityRole="link">
            {i.text}
          </Text>
        );
      return i.text;
    });

  return (
    <View accessible accessibilityLabel={blocksToPlainText(blocks)} style={muted ? styles.muted : null}>
      {blocks.map((b, k) => {
        const gap = k > 0 ? { marginTop: b.kind === 'bullet' || b.kind === 'number' ? 2 : lineHeight * 0.4 } : null;
        if (b.kind === 'paragraph') return <Text key={k} style={[base, gap]}>{runs(b.inlines)}</Text>;
        if (b.kind === 'heading') {
          const size = Math.round(fontSize * HEADING_SCALE[b.level]);
          return (
            <Text key={k} style={[base, gap, styles.bold, { fontSize: size, lineHeight: Math.round(size * 1.3) }]} accessibilityRole="header">
              {runs(b.inlines)}
            </Text>
          );
        }
        if (b.kind === 'quote') {
          return (
            <View key={k} style={[styles.quote, bar, gap]}>
              <Text style={[base, styles.quoteText]}>{runs(b.inlines)}</Text>
            </View>
          );
        }
        if (b.kind === 'pre') {
          return (
            <ScrollView key={k} horizontal style={[styles.pre, gap]} showsHorizontalScrollIndicator={false}>
              <Text style={[base, styles.preText]}>{b.text}</Text>
            </ScrollView>
          );
        }
        if (b.kind === 'table') {
          const cell = { color, fontSize: Math.round(fontSize * 0.92), lineHeight: Math.round(fontSize * 0.92 * 1.35) };
          return (
            <ScrollView key={k} horizontal style={gap} showsHorizontalScrollIndicator={false} testID="cb-md-table">
              <View>
                <View style={[styles.tr, styles.th, rule]}>
                  {b.head.map((c, j) => (
                    <Text key={j} style={[cell, styles.cell, styles.bold]}>{runs(c)}</Text>
                  ))}
                </View>
                {b.rows.map((r, ri) => (
                  <View key={ri} style={[styles.tr, rule, ri === b.rows.length - 1 && styles.lastRow]}>
                    {r.map((c, j) => (
                      <Text key={j} style={[cell, styles.cell]}>{runs(c)}</Text>
                    ))}
                  </View>
                ))}
              </View>
            </ScrollView>
          );
        }
        return (
          <View key={k} style={[styles.item, gap]}>
            <Text style={[base, styles.marker]}>{b.kind === 'bullet' ? '•' : `${b.n}.`}</Text>
            <Text style={[base, styles.itemText]}>{runs(b.inlines)}</Text>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  bold: { fontWeight: '700' },
  italic: { fontStyle: 'italic' },
  code: { fontFamily: 'Courier', opacity: 0.9 },
  link: { textDecorationLine: 'underline' },
  strike: { textDecorationLine: 'line-through' },
  muted: { opacity: 0.85 },
  quote: { borderLeftWidth: 3, paddingLeft: 8, opacity: 0.9 },
  quoteText: { opacity: 0.95 },
  pre: { borderRadius: 6, backgroundColor: 'rgba(127,127,127,0.12)', paddingHorizontal: 8, paddingVertical: 6 },
  preText: { fontFamily: 'Courier' },
  tr: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  th: { borderBottomWidth: 2 },
  lastRow: { borderBottomWidth: 0 },
  cell: { paddingVertical: 5, paddingHorizontal: 9, minWidth: 64 },
  item: { flexDirection: 'row' },
  marker: { minWidth: 16, marginRight: 4 },
  itemText: { flex: 1 },
});
