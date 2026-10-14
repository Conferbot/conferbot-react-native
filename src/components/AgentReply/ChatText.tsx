// @ts-nocheck
/**
 * An agent message's text: the small markdown subset of
 * utils/chatMarkdown.ts drawn with nested <Text> - lists, bold, italic,
 * code and tappable links.
 */
import React, { useMemo } from 'react';
import { Linking, Text, View, StyleSheet } from 'react-native';
import { parseChatMarkdown, blocksToPlainText, type Inline } from '../../utils/chatMarkdown';

export interface ChatTextProps {
  text: string;
  color: string;
  fontSize: number;
  lineHeight: number;
  linkColor?: string;
  onLinkPress?: (url: string) => void;
}

export const ChatText: React.FC<ChatTextProps> = ({ text, color, fontSize, lineHeight, linkColor, onLinkPress }) => {
  const blocks = useMemo(() => parseChatMarkdown(text), [text]);
  const open = (url: string) => (onLinkPress ? onLinkPress(url) : Linking.openURL(url).catch(() => {}));
  const base = { color, fontSize, lineHeight };

  const runs = (inlines: Inline[]) =>
    inlines.map((i, k) => {
      if (i.kind === 'bold') return <Text key={k} style={styles.bold}>{i.text}</Text>;
      if (i.kind === 'italic') return <Text key={k} style={styles.italic}>{i.text}</Text>;
      if (i.kind === 'code') return <Text key={k} style={styles.code}>{i.text}</Text>;
      if (i.kind === 'link')
        return (
          <Text key={k} style={[styles.link, linkColor ? { color: linkColor } : null]} onPress={() => open(i.url)} accessibilityRole="link">
            {i.text}
          </Text>
        );
      return i.text;
    });

  return (
    <View accessible accessibilityLabel={blocksToPlainText(blocks)}>
      {blocks.map((b, k) => {
        const gap = k > 0 ? { marginTop: b.kind === 'paragraph' ? lineHeight * 0.4 : 2 } : null;
        if (b.kind === 'paragraph') return <Text key={k} style={[base, gap]}>{runs(b.inlines)}</Text>;
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
  item: { flexDirection: 'row' },
  marker: { minWidth: 16, marginRight: 4 },
  itemText: { flex: 1 },
});
