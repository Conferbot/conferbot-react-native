import React, { useMemo, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { backgroundSvg, type ChatBackground } from '../../core/chatBackground';

// Gradients and patterns draw with react-native-svg when the app has it
// installed (an optional peer); without it the background stays solid.
let SvgXml: React.ComponentType<{ xml: string; width: number; height: number }> | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  SvgXml = require('react-native-svg').SvgXml;
} catch {
  SvgXml = null;
}

export interface ChatBackgroundViewProps {
  background: ChatBackground;
  testID?: string;
}

/**
 * The bot's chat background behind the messages, as the web widget draws it
 * (core/chatBackground): solid, gradient, image with its mask, or a pattern.
 */
export const ChatBackgroundView: React.FC<ChatBackgroundViewProps> = ({ background, testID }) => {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const xml = useMemo(
    () => (size && SvgXml ? backgroundSvg(background, Math.round(size.width), Math.round(size.height)) : null),
    [background, size]
  );
  const base = background.type === 'gradient' ? background.stops[0] : background.color;

  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { backgroundColor: base }]}
      onLayout={(e) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
      testID={testID}
    >
      {background.type === 'image' && (
        <>
          <Image source={{ uri: background.url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          {background.mask && (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: background.mask.color, opacity: background.mask.alpha }]} />
          )}
        </>
      )}
      {xml && size && SvgXml && <SvgXml xml={xml} width={size.width} height={size.height} />}
    </View>
  );
};

export default ChatBackgroundView;
