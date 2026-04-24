import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface BubbleIconProps {
  size?: number;
  color?: string;
}

/**
 * Default chat bubble icon built with Views (no external dependencies).
 * Renders a speech bubble shape using nested Views.
 */
const BubbleIconDefault: React.FC<BubbleIconProps> = ({ size = 24, color = '#ffffff' }) => {
  const bubbleSize = size * 0.65;
  const tailSize = size * 0.15;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* Main bubble */}
      <View
        style={{
          width: bubbleSize,
          height: bubbleSize * 0.75,
          borderRadius: bubbleSize * 0.2,
          backgroundColor: color,
        }}
      />
      {/* Tail */}
      <View
        style={{
          position: 'absolute',
          bottom: size * 0.12,
          left: size * 0.18,
          width: 0,
          height: 0,
          borderTopWidth: tailSize,
          borderRightWidth: tailSize,
          borderTopColor: color,
          borderRightColor: 'transparent',
        }}
      />
      {/* Three dots */}
      <View
        style={{
          position: 'absolute',
          flexDirection: 'row',
          gap: size * 0.05,
          alignItems: 'center',
        }}
      >
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            style={{
              width: size * 0.08,
              height: size * 0.08,
              borderRadius: size * 0.04,
              backgroundColor: 'rgba(0,0,0,0.3)',
            }}
          />
        ))}
      </View>
    </View>
  );
};

/**
 * Close X icon for when widget is open
 */
export const CloseIcon: React.FC<BubbleIconProps> = ({ size = 24, color = '#ffffff' }) => {
  const lineLength = size * 0.4;
  const lineWidth = size * 0.08;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* First line of X (top-left to bottom-right) */}
      <View
        style={{
          position: 'absolute',
          width: lineLength,
          height: lineWidth,
          backgroundColor: color,
          borderRadius: lineWidth / 2,
          transform: [{ rotate: '45deg' }],
        }}
      />
      {/* Second line of X (top-right to bottom-left) */}
      <View
        style={{
          position: 'absolute',
          width: lineLength,
          height: lineWidth,
          backgroundColor: color,
          borderRadius: lineWidth / 2,
          transform: [{ rotate: '-45deg' }],
        }}
      />
    </View>
  );
};

/**
 * Emoji-based bubble icons matching web widget names.
 * These use Text rendering which works without any extra dependencies.
 */
const EmojiIcon: React.FC<BubbleIconProps & { emoji: string }> = ({ size = 24, emoji }) => (
  <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
    <Text style={{ fontSize: size * 0.6, lineHeight: size * 0.75 }}>{emoji}</Text>
  </View>
);

// Chat bubble emoji variants
const BubbleIcon1: React.FC<BubbleIconProps> = (props) => <EmojiIcon {...props} emoji="💬" />;
const BubbleIcon2: React.FC<BubbleIconProps> = (props) => <EmojiIcon {...props} emoji="🤖" />;
const BubbleIcon3: React.FC<BubbleIconProps> = (props) => <EmojiIcon {...props} emoji="🗨️" />;
const BubbleIcon4: React.FC<BubbleIconProps> = (props) => <EmojiIcon {...props} emoji="💭" />;

// Map of icon name -> component (matching web widget's WidgetBubbleIcon names)
const BUBBLE_ICONS: Record<string, React.FC<BubbleIconProps>> = {
  WidgetBubbleIcon1: BubbleIcon1,
  WidgetBubbleIcon2: BubbleIcon2,
  WidgetBubbleIcon3: BubbleIcon3,
  WidgetBubbleIcon4: BubbleIcon4,
  WidgetBubbleIcon5: BubbleIcon1,
  WidgetBubbleIcon6: BubbleIcon2,
  WidgetBubbleIcon7: BubbleIconDefault,
  WidgetBubbleIcon8: BubbleIconDefault,
  WidgetBubbleIcon9: BubbleIconDefault,
  WidgetBubbleIcon10: BubbleIconDefault,
  WidgetBubbleIcon11: BubbleIconDefault,
  WidgetBubbleIcon12: BubbleIconDefault,
  WidgetBubbleIcon13: BubbleIconDefault,
  WidgetBubbleIcon14: BubbleIconDefault,
  WidgetBubbleIcon15: BubbleIconDefault,
};

export const getBubbleIcon = (iconName?: string): React.FC<BubbleIconProps> => {
  if (!iconName) return BubbleIconDefault;
  return BUBBLE_ICONS[iconName] || BubbleIconDefault;
};

export { BubbleIconDefault };
