import React from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

interface BubbleIconProps {
  size?: number;
  color?: string;
}

// ============================================================
// SVG ICONS — matching web widget's WidgetBubbleIcon variants
// ============================================================

/** Icon 10 — Rounded filled chat bubble with three dots (web default) */
const BubbleIcon10: React.FC<BubbleIconProps> = ({ size = 24, color = '#fff' }) => (
  <Svg width={size} height={size} viewBox="0 0 512 512">
    <Path fill={color} d="M408 48H104a72.08 72.08 0 0 0-72 72v192a72.08 72.08 0 0 0 72 72h24v64a16 16 0 0 0 26.25 12.29L245.74 384H408a72.08 72.08 0 0 0 72-72V120a72.08 72.08 0 0 0-72-72M160 248a32 32 0 1 1 32-32a32 32 0 0 1-32 32m96 0a32 32 0 1 1 32-32a32 32 0 0 1-32 32m96 0a32 32 0 1 1 32-32a32 32 0 0 1-32 32" />
  </Svg>
);

/** Icon 8 — Angular filled bubble with three dots */
const BubbleIcon8: React.FC<BubbleIconProps> = ({ size = 24, color = '#fff' }) => (
  <Svg width={size} height={size} viewBox="0 0 512 512">
    <Path fill={color} d="M456 48H56a24 24 0 0 0-24 24v288a24 24 0 0 0 24 24h72v80l117.74-80H456a24 24 0 0 0 24-24V72a24 24 0 0 0-24-24M160 248a32 32 0 1 1 32-32a32 32 0 0 1-32 32m96 0a32 32 0 1 1 32-32a32 32 0 0 1-32 32m96 0a32 32 0 1 1 32-32a32 32 0 0 1-32 32" />
  </Svg>
);

/** Icon 11 — Solid filled speech bubble */
const BubbleIcon11: React.FC<BubbleIconProps> = ({ size = 24, color = '#fff' }) => (
  <Svg width={size} height={size} viewBox="0 0 512 512">
    <Path fill={color} d="M144 464a16 16 0 0 1-16-16v-64h-24a72.08 72.08 0 0 1-72-72V120a72.08 72.08 0 0 1 72-72h304a72.08 72.08 0 0 1 72 72v192a72.08 72.08 0 0 1-72 72H245.74l-91.49 76.29A16.05 16.05 0 0 1 144 464" />
  </Svg>
);

/** Icon 7 — Outlined speech bubble */
const BubbleIcon7: React.FC<BubbleIconProps> = ({ size = 24, color = '#fff' }) => (
  <Svg width={size} height={size} viewBox="0 0 512 512">
    <Path fill="none" stroke={color} strokeLinejoin="round" strokeWidth={32} d="M408 64H104a56.16 56.16 0 0 0-56 56v192a56.16 56.16 0 0 0 56 56h40v80l93.72-78.14a8 8 0 0 1 5.13-1.86H408a56.16 56.16 0 0 0 56-56V120a56.16 56.16 0 0 0-56-56Z" />
  </Svg>
);

/** Close X icon */
export const CloseIcon: React.FC<BubbleIconProps> = ({ size = 24, color = '#fff' }) => (
  <Svg width={size} height={size} viewBox="0 0 25 25" fill="none">
    <Path stroke={color} strokeWidth={2.5} strokeLinecap="round" d="M6 6L19 19" />
    <Path stroke={color} strokeWidth={2.5} strokeLinecap="round" d="M6 19L19 6" />
  </Svg>
);

// Map web widget icon names to components
const BUBBLE_ICONS: Record<string, React.FC<BubbleIconProps>> = {
  WidgetBubbleIcon1: BubbleIcon10,
  WidgetBubbleIcon2: BubbleIcon10,
  WidgetBubbleIcon3: BubbleIcon10,
  WidgetBubbleIcon4: BubbleIcon10,
  WidgetBubbleIcon5: BubbleIcon10,
  WidgetBubbleIcon6: BubbleIcon10,
  WidgetBubbleIcon7: BubbleIcon7,
  WidgetBubbleIcon8: BubbleIcon8,
  WidgetBubbleIcon9: BubbleIcon10,
  WidgetBubbleIcon10: BubbleIcon10,
  WidgetBubbleIcon11: BubbleIcon11,
  WidgetBubbleIcon12: BubbleIcon11,
  WidgetBubbleIcon13: BubbleIcon8,
  WidgetBubbleIcon14: BubbleIcon7,
  WidgetBubbleIcon15: BubbleIcon11,
};

export const getBubbleIcon = (iconName?: string): React.FC<BubbleIconProps> => {
  if (!iconName) return BubbleIcon10;
  return BUBBLE_ICONS[iconName] || BubbleIcon10;
};
