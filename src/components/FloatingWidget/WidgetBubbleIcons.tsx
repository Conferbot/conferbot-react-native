import React from 'react';
import { View, Text } from 'react-native';

interface BubbleIconProps {
  size?: number;
  color?: string;
}

/**
 * Clean chat bubble icon built with nested Views.
 * Speech bubble with a tail — minimal and professional.
 */
const BubbleIconDefault: React.FC<BubbleIconProps> = ({ size = 24, color = '#ffffff' }) => {
  const s = size;
  const bubbleW = s * 0.58;
  const bubbleH = s * 0.42;
  const radius = s * 0.1;
  const dotSize = s * 0.065;
  const dotGap = s * 0.065;
  const tailSize = s * 0.12;

  return (
    <View style={{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }}>
      {/* Bubble body */}
      <View style={{
        width: bubbleW,
        height: bubbleH,
        borderRadius: radius,
        backgroundColor: color,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: dotGap,
      }}>
        {/* Three dots */}
        <View style={{ width: dotSize, height: dotSize, borderRadius: dotSize / 2, backgroundColor: 'rgba(0,0,0,0.25)' }} />
        <View style={{ width: dotSize, height: dotSize, borderRadius: dotSize / 2, backgroundColor: 'rgba(0,0,0,0.25)' }} />
        <View style={{ width: dotSize, height: dotSize, borderRadius: dotSize / 2, backgroundColor: 'rgba(0,0,0,0.25)' }} />
      </View>
      {/* Tail triangle */}
      <View style={{
        position: 'absolute',
        bottom: s * 0.2,
        left: s * 0.17,
        width: 0,
        height: 0,
        borderTopWidth: tailSize,
        borderRightWidth: tailSize * 0.8,
        borderTopColor: color,
        borderRightColor: 'transparent',
      }} />
    </View>
  );
};

/**
 * Close X icon for when widget is open.
 * Two crossed lines forming an X.
 */
export const CloseIcon: React.FC<BubbleIconProps> = ({ size = 24, color = '#ffffff' }) => {
  const lineLen = size * 0.38;
  const lineW = size * 0.065;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{
        position: 'absolute',
        width: lineLen,
        height: lineW,
        backgroundColor: color,
        borderRadius: lineW,
        transform: [{ rotate: '45deg' }],
      }} />
      <View style={{
        position: 'absolute',
        width: lineLen,
        height: lineW,
        backgroundColor: color,
        borderRadius: lineW,
        transform: [{ rotate: '-45deg' }],
      }} />
    </View>
  );
};

/**
 * Simple message icon — just a rounded rectangle chat bubble.
 */
const MessageIcon: React.FC<BubbleIconProps> = ({ size = 24, color = '#ffffff' }) => {
  const s = size;
  return (
    <View style={{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{
        width: s * 0.55,
        height: s * 0.4,
        borderRadius: s * 0.08,
        backgroundColor: color,
      }} />
      <View style={{
        position: 'absolute',
        bottom: s * 0.22,
        left: s * 0.19,
        width: 0,
        height: 0,
        borderTopWidth: s * 0.1,
        borderRightWidth: s * 0.08,
        borderTopColor: color,
        borderRightColor: 'transparent',
      }} />
    </View>
  );
};

// Map web widget icon names to components
const BUBBLE_ICONS: Record<string, React.FC<BubbleIconProps>> = {
  WidgetBubbleIcon1: BubbleIconDefault,
  WidgetBubbleIcon2: BubbleIconDefault,
  WidgetBubbleIcon3: MessageIcon,
  WidgetBubbleIcon4: MessageIcon,
  WidgetBubbleIcon5: BubbleIconDefault,
  WidgetBubbleIcon6: BubbleIconDefault,
  WidgetBubbleIcon7: MessageIcon,
  WidgetBubbleIcon8: BubbleIconDefault,
  WidgetBubbleIcon9: BubbleIconDefault,
  WidgetBubbleIcon10: BubbleIconDefault,
  WidgetBubbleIcon11: MessageIcon,
  WidgetBubbleIcon12: MessageIcon,
  WidgetBubbleIcon13: BubbleIconDefault,
  WidgetBubbleIcon14: MessageIcon,
  WidgetBubbleIcon15: MessageIcon,
};

export const getBubbleIcon = (iconName?: string): React.FC<BubbleIconProps> => {
  if (!iconName) return BubbleIconDefault;
  return BUBBLE_ICONS[iconName] || BubbleIconDefault;
};

export { BubbleIconDefault, MessageIcon };
