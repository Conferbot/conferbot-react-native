import React from 'react';
import Svg, { Path, Circle, Ellipse, Rect, G } from 'react-native-svg';

interface BubbleIconProps {
  size?: number;
  color?: string;
}

// ============================================================
// SVG ICONS — all 15 web widget WidgetBubbleIcon variants
// ============================================================

/** Icon 1 — Smiley face chat bubble */
const BubbleIcon1: React.FC<BubbleIconProps> = ({ size = 24, color = '#fff' }) => (
  <Svg width={size} height={size} viewBox="0 0 30 30">
    <Path fill={color} d="M16 19a6.99 6.99 0 0 1-5.833-3.129l1.666-1.107a5 5 0 0 0 8.334 0l1.666 1.107A6.99 6.99 0 0 1 16 19m4-11a2 2 0 1 0 2 2a1.98 1.98 0 0 0-2-2m-8 0a2 2 0 1 0 2 2a1.98 1.98 0 0 0-2-2" />
    <Path fill={color} d="M17.736 30L16 29l4-7h6a1.997 1.997 0 0 0 2-2V6a1.997 1.997 0 0 0-2-2H6a1.997 1.997 0 0 0-2 2v14a1.997 1.997 0 0 0 2 2h9v2H6a4 4 0 0 1-4-4V6a3.999 3.999 0 0 1 4-4h20a3.999 3.999 0 0 1 4 4v14a4 4 0 0 1-4 4h-4.835Z" />
  </Svg>
);

/** Icon 2 — Microphone/voice chat */
const BubbleIcon2: React.FC<BubbleIconProps> = ({ size = 24, color = '#fff' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path fill={color} d="M11.999 0c-2.25 0-4.5.06-6.6.21a5.57 5.57 0 0 0-5.19 5.1c-.24 3.21-.27 6.39-.06 9.6a5.644 5.644 0 0 0 5.7 5.19h3.15v-3.9h-3.15c-.93.03-1.74-.63-1.83-1.56c-.18-3-.15-6 .06-9c.06-.84.72-1.47 1.56-1.53c2.04-.15 4.2-.21 6.36-.21s4.32.09 6.36.18c.81.06 1.5.69 1.56 1.53c.24 3 .24 6 .06 9c-.12.93-.9 1.62-1.83 1.59h-3.15l-6 3.9V24l6-3.9h3.15c2.97.03 5.46-2.25 5.7-5.19c.21-3.18.18-6.39-.03-9.57a5.57 5.57 0 0 0-5.19-5.1c-2.13-.18-4.38-.24-6.63-.24m-5.04 8.76c-.36 0-.66.3-.66.66v2.34c0 .33.18.63.48.78c1.62.78 3.42 1.2 5.22 1.26c1.8-.06 3.6-.48 5.22-1.26c.3-.15.48-.45.48-.78V9.42c0-.09-.03-.15-.09-.21a.648.648 0 0 0-.87-.36c-1.5.66-3.12 1.02-4.77 1.05c-1.65-.03-3.27-.42-4.77-1.08a.566.566 0 0 0-.24-.06" />
  </Svg>
);

/** Icon 3 — Chat bubble with face and dots */
const BubbleIcon3: React.FC<BubbleIconProps> = ({ size = 24, color = '#fff' }) => (
  <Svg width={size} height={size} viewBox="0 1 15 15">
    <Path fill={color} d="M7.5 5a1.5 1.5 0 1 0 0 3a1.5 1.5 0 0 0 0-3" />
    <Path fill={color} fillRule="evenodd" d="M9 2H8V0H7v2H6a6 6 0 0 0 0 12h3c.13 0 .26-.004.389-.013l3.99.998a.5.5 0 0 0 .606-.606l-.577-2.309A6 6 0 0 0 9 2M5 6.5a2.5 2.5 0 1 1 5 0a2.5 2.5 0 0 1-5 0M7.5 12a4.483 4.483 0 0 1-2.813-.987l.626-.78c.599.48 1.359.767 2.187.767c.828 0 1.588-.287 2.187-.767l.626.78A4.483 4.483 0 0 1 7.5 12" clipRule="evenodd" />
  </Svg>
);

/** Icon 4 — Live chat icon with face */
const BubbleIcon4: React.FC<BubbleIconProps> = ({ size = 24, color = '#fff' }) => (
  <Svg width={size} height={size} viewBox="0 1 15 15">
    <Path fill={color} d="M9 2.5V2zm-3 0V3zm6.856 9.422l-.35-.356l-.205.2l.07.277zM13.5 14.5l-.121.485a.5.5 0 0 0 .606-.606zm-4-1l-.354-.354l-.624.625l.857.214zm.025-.025l.353.354a.5.5 0 0 0-.4-.852zM.5 8H0zM7 0v2.5h1V0zm2 2H6v1h3zm6 6a6 6 0 0 0-6-6v1a5 5 0 0 1 5 5zm-1.794 4.279A5.983 5.983 0 0 0 15 7.999h-1a4.983 4.983 0 0 1-1.495 3.567zm.78 2.1L13.34 11.8l-.97.242l.644 2.578zm-4.607-.394l4 1l.242-.97l-4-1zm-.208-.863l-.025.024l.708.707l.024-.024zM9 14c.193 0 .384-.01.572-.027l-.094-.996A5.058 5.058 0 0 1 9 13zm-3 0h3v-1H6zM0 8a6 6 0 0 0 6 6v-1a5 5 0 0 1-5-5zm6-6a6 6 0 0 0-6 6h1a5 5 0 0 1 5-5zm1.5 6A1.5 1.5 0 0 1 6 6.5H5A2.5 2.5 0 0 0 7.5 9zM9 6.5A1.5 1.5 0 0 1 7.5 8v1A2.5 2.5 0 0 0 10 6.5zM7.5 5A1.5 1.5 0 0 1 9 6.5h1A2.5 2.5 0 0 0 7.5 4zm0-1A2.5 2.5 0 0 0 5 6.5h1A1.5 1.5 0 0 1 7.5 5zm0 8c1.064 0 2.042-.37 2.813-.987l-.626-.78c-.6.48-1.359.767-2.187.767zm-2.813-.987c.77.617 1.75.987 2.813.987v-1a3.483 3.483 0 0 1-2.187-.767z" />
  </Svg>
);

/** Icon 5 — Smiley face outline */
const BubbleIcon5: React.FC<BubbleIconProps> = ({ size = 24, color = '#fff' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <G fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}>
      <Path d="M18 4a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-5l-5 3v-3H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3zM9.5 9h.01m4.99 0h.01" />
      <Path d="M9.5 13a3.5 3.5 0 0 0 5 0" />
    </G>
  </Svg>
);

/** Icon 6 — Chat dots/comments */
const BubbleIcon6: React.FC<BubbleIconProps> = ({ size = 24, color = '#fff' }) => (
  <Svg width={size} height={size} viewBox="0 200 1900 1900">
    <Path fill={color} d="M768 1024H640V896h128zm512 0h-128V896h128zm512-128v256h-128v320q0 40-15 75t-41 61t-61 41t-75 15h-264l-440 376v-376H448q-40 0-75-15t-61-41t-41-61t-15-75v-320H128V896h128V704q0-40 15-75t41-61t61-41t75-15h448V303q-29-17-46-47t-18-64q0-27 10-50t27-40t41-28t50-10q27 0 50 10t40 27t28 41t10 50q0 34-17 64t-47 47v209h448q40 0 75 15t61 41t41 61t15 75v192zm-256-192q0-26-19-45t-45-19H448q-26 0-45 19t-19 45v768q0 26 19 45t45 19h448v226l264-226h312q26 0 45-19t19-45zm-851 462q55 55 126 84t149 30q78 0 149-29t126-85l90 91q-73 73-167 112t-198 39q-103 0-197-39t-168-112z" />
  </Svg>
);

/** Icon 7 — Outlined speech bubble */
const BubbleIcon7: React.FC<BubbleIconProps> = ({ size = 24, color = '#fff' }) => (
  <Svg width={size} height={size} viewBox="0 0 512 512">
    <Path fill="none" stroke={color} strokeLinejoin="round" strokeWidth={32} d="M408 64H104a56.16 56.16 0 0 0-56 56v192a56.16 56.16 0 0 0 56 56h40v80l93.72-78.14a8 8 0 0 1 5.13-1.86H408a56.16 56.16 0 0 0 56-56V120a56.16 56.16 0 0 0-56-56Z" />
  </Svg>
);

/** Icon 8 — Angular filled bubble with three dots */
const BubbleIcon8: React.FC<BubbleIconProps> = ({ size = 24, color = '#fff' }) => (
  <Svg width={size} height={size} viewBox="0 0 512 512">
    <Path fill={color} d="M456 48H56a24 24 0 0 0-24 24v288a24 24 0 0 0 24 24h72v80l117.74-80H456a24 24 0 0 0 24-24V72a24 24 0 0 0-24-24M160 248a32 32 0 1 1 32-32a32 32 0 0 1-32 32m96 0a32 32 0 1 1 32-32a32 32 0 0 1-32 32m96 0a32 32 0 1 1 32-32a32 32 0 0 1-32 32" />
  </Svg>
);

/** Icon 9 — Outlined bubble with three dots */
const BubbleIcon9: React.FC<BubbleIconProps> = ({ size = 24, color = '#fff' }) => (
  <Svg width={size} height={size} viewBox="0 0 512 512">
    <Path fill="none" stroke={color} strokeLinejoin="round" strokeWidth={32} d="M408 64H104a56.16 56.16 0 0 0-56 56v192a56.16 56.16 0 0 0 56 56h40v80l93.72-78.14a8 8 0 0 1 5.13-1.86H408a56.16 56.16 0 0 0 56-56V120a56.16 56.16 0 0 0-56-56Z" />
    <Circle cx={160} cy={216} r={32} fill={color} />
    <Circle cx={256} cy={216} r={32} fill={color} />
    <Circle cx={352} cy={216} r={32} fill={color} />
  </Svg>
);

/** Icon 10 — Rounded filled chat bubble with three dots (default) */
const BubbleIcon10: React.FC<BubbleIconProps> = ({ size = 24, color = '#fff' }) => (
  <Svg width={size} height={size} viewBox="0 0 512 512">
    <Path fill={color} d="M408 48H104a72.08 72.08 0 0 0-72 72v192a72.08 72.08 0 0 0 72 72h24v64a16 16 0 0 0 26.25 12.29L245.74 384H408a72.08 72.08 0 0 0 72-72V120a72.08 72.08 0 0 0-72-72M160 248a32 32 0 1 1 32-32a32 32 0 0 1-32 32m96 0a32 32 0 1 1 32-32a32 32 0 0 1-32 32m96 0a32 32 0 1 1 32-32a32 32 0 0 1-32 32" />
  </Svg>
);

/** Icon 11 — Solid filled speech bubble */
const BubbleIcon11: React.FC<BubbleIconProps> = ({ size = 24, color = '#fff' }) => (
  <Svg width={size} height={size} viewBox="0 0 512 512">
    <Path fill={color} d="M144 464a16 16 0 0 1-16-16v-64h-24a72.08 72.08 0 0 1-72-72V120a72.08 72.08 0 0 1 72-72h304a72.08 72.08 0 0 1 72 72v192a72.08 72.08 0 0 1-72 72H245.74l-91.49 76.29A16.05 16.05 0 0 1 144 464" />
  </Svg>
);

/** Icon 12 — Robot/helper face */
const BubbleIcon12: React.FC<BubbleIconProps> = ({ size = 24, color = '#fff' }) => (
  <Svg width={size} height={size} viewBox="0 2 24 24">
    <Path fill={color} d="M21.928 11.607c-.202-.488-.635-.605-.928-.633V8c0-1.103-.897-2-2-2h-6V4.61c.305-.274.5-.668.5-1.11a1.5 1.5 0 0 0-3 0c0 .442.195.836.5 1.11V6H5c-1.103 0-2 .897-2 2v2.997l-.082.006A1 1 0 0 0 1.99 12v2a1 1 0 0 0 1 1H3v5c0 1.103.897 2 2 2h14c1.103 0 2-.897 2-2v-5a1 1 0 0 0 1-1v-1.938a1.006 1.006 0 0 0-.072-.455M5 20V8h14l.001 3.996L19 12v2l.001.005l.001 5.995z" />
    <Ellipse cx={8.5} cy={12} fill={color} rx={1.5} ry={2} />
    <Ellipse cx={15.5} cy={12} fill={color} rx={1.5} ry={2} />
    <Rect x={8} y={16} width={8} height={2} fill={color} />
  </Svg>
);

/** Icon 13 — Video chat/screen */
const BubbleIcon13: React.FC<BubbleIconProps> = ({ size = 24, color = '#fff' }) => (
  <Svg width={size} height={size} viewBox="0 2 24 24">
    <G fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}>
      <Path d="M12 8V4H8" />
      <Rect width={16} height={12} x={4} y={8} rx={2} />
      <Path d="M2 14h2m16 0h2m-7-1v2m-6-2v2" />
    </G>
  </Svg>
);

/** Icon 14 — Arcade/gaming controller */
const BubbleIcon14: React.FC<BubbleIconProps> = ({ size = 24, color = '#fff' }) => (
  <Svg width={size} height={size} viewBox="0 1 23 23">
    <G fill={color}>
      <Rect x={10.125} y={13} width={4} height={2} />
      <Path fillRule="evenodd" d="M8.125 13a2 2 0 1 0 0-4a2 2 0 0 0 0 4m0-1.5a.5.5 0 1 0 0-1a.5.5 0 0 0 0 1m10-.5a2 2 0 1 1-4 0a2 2 0 0 1 4 0m-1.5 0a.5.5 0 1 1-1 0a.5.5 0 0 1 1 0" clipRule="evenodd" />
      <Path fillRule="evenodd" d="M2.749 14.666A6 6 0 0 0 8.125 18h8c2.44 0 4.54-1.456 5.478-3.547A2.997 2.997 0 0 0 22.875 12c0-1.013-.503-1.91-1.272-2.452A6.001 6.001 0 0 0 16.125 6h-8A6 6 0 0 0 2.75 9.334a3 3 0 0 0 0 5.332M8.125 8h8c1.384 0 2.603.702 3.322 1.77c.276.69.428 1.442.428 2.23s-.152 1.54-.428 2.23A3.996 3.996 0 0 1 16.125 16h-8a4 4 0 0 1 0-8" clipRule="evenodd" />
    </G>
  </Svg>
);

/** Icon 15 — Robot with chat (filled) */
const BubbleIcon15: React.FC<BubbleIconProps> = ({ size = 24, color = '#fff' }) => (
  <Svg width={size} height={size} viewBox="0 2 24 24">
    <Path fill={color} d="M21 10.975V8a2 2 0 0 0-2-2h-6V4.688c.305-.274.5-.668.5-1.11a1.5 1.5 0 0 0-3 0c0 .442.195.836.5 1.11V6H5a2 2 0 0 0-2 2v2.998l-.072.005A.999.999 0 0 0 2 12v2a1 1 0 0 0 1 1v5a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5a1 1 0 0 0 1-1v-1.938a1.004 1.004 0 0 0-.072-.455c-.202-.488-.635-.605-.928-.632M7 12c0-1.104.672-2 1.5-2s1.5.896 1.5 2s-.672 2-1.5 2S7 13.104 7 12m8.998 6c-1.001-.003-7.997 0-7.998 0v-2s7.001-.002 8.002 0zm-.498-4c-.828 0-1.5-.896-1.5-2s.672-2 1.5-2s1.5.896 1.5 2s-.672 2-1.5 2" />
  </Svg>
);

/** Default — rounded chat bubble shape */
const BubbleIconDefault: React.FC<BubbleIconProps> = ({ size = 24, color = '#fff' }) => (
  <Svg width={size} height={size} viewBox="0 -1 24 25" fill="none">
    <Path fillRule="evenodd" clipRule="evenodd" fill={color} d="M21.5 18C21.5 18 20.5 18.5 20.5 20.1453V21.2858V22.5287V23.3572C20.5 24.131 20.0184 24.1046 19.3517 23.7118L18.75 23.3572L13.5 20C12.8174 19.6587 12.6007 19.5504 12.3729 19.516C12.267 19.5 12.1587 19.5 12 19.5H7.5C2.5 19.5 0 17.5 0 12.5V7.5C0 2.5 2.5 0 7.5 0H16.5C21.5 0 24 2.5 24 7.5V12.5C24 17.5 21.5 18 21.5 18Z" />
  </Svg>
);

/** Close X icon */
export const CloseIcon: React.FC<BubbleIconProps> = ({ size = 24, color = '#fff' }) => (
  <Svg width={size} height={size} viewBox="0 0 25 25" fill="none">
    <Path stroke={color} strokeWidth={2.5} strokeLinecap="round" d="M6 6L19 19" />
    <Path stroke={color} strokeWidth={2.5} strokeLinecap="round" d="M6 19L19 6" />
  </Svg>
);

// Map web widget icon names to their exact components
const BUBBLE_ICONS: Record<string, React.FC<BubbleIconProps>> = {
  WidgetBubbleIcon1: BubbleIcon1,
  WidgetBubbleIcon2: BubbleIcon2,
  WidgetBubbleIcon3: BubbleIcon3,
  WidgetBubbleIcon4: BubbleIcon4,
  WidgetBubbleIcon5: BubbleIcon5,
  WidgetBubbleIcon6: BubbleIcon6,
  WidgetBubbleIcon7: BubbleIcon7,
  WidgetBubbleIcon8: BubbleIcon8,
  WidgetBubbleIcon9: BubbleIcon9,
  WidgetBubbleIcon10: BubbleIcon10,
  WidgetBubbleIcon11: BubbleIcon11,
  WidgetBubbleIcon12: BubbleIcon12,
  WidgetBubbleIcon13: BubbleIcon13,
  WidgetBubbleIcon14: BubbleIcon14,
  WidgetBubbleIcon15: BubbleIcon15,
};

export const getBubbleIcon = (iconName?: string): React.FC<BubbleIconProps> => {
  if (!iconName) return BubbleIconDefault;
  return BUBBLE_ICONS[iconName] || BubbleIconDefault;
};
