import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
  Image,
  Text,
  useWindowDimensions,
  Linking,
} from 'react-native';
import { useConferBot } from '../../context/ConferBotContext';
import { ChatWidget } from '../ChatWidget/ChatWidget';
import type { ChatWidgetProps } from '../ChatWidget/ChatWidget';
import { getBubbleIcon, CloseIcon } from './WidgetBubbleIcons';
import { resolveLauncher } from '../../core/launcher';
import { launcherIconSvg } from '../../core/launcherIcons';
import { useLauncherMotion, noteLauncherOpened } from './useLauncherMotion';
import { GreetingCard } from './GreetingCard';
import { useGreeting } from './useGreeting';
import { useReducedMotion } from './fxAnimated';
import { useLauncherEntrance } from './useLauncherEntrance';
import { useLauncherAttention, ORBIT_DOT, GLOSS, HAND } from './useLauncherAttention';
import { useLauncherIdleCall } from './useLauncherIdleCall';
import { FxSpriteView } from './FxSprites';
import { IdleCallStage, IdleCallBubble } from './IdleCallView';
import { mascotColor } from '../../core/mascotArt';
import { WAVING_HAND } from '../../core/launcherAttention';
import { linearBox, radialDisc, stops } from '../../core/fxPaint';

// react-native-svg draws a gradient launcher when the app has it; else its first colour.
let SvgXml: React.ComponentType<{ xml: string; width: number | string; height: number | string }> | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  SvgXml = require('react-native-svg').SvgXml;
} catch {
  SvgXml = null;
}

// Attention "shine": the gloss band, clear - white - clear across it.
const glossXml = (w: number, h: number) => linearBox(w, h, 90, stops('rgba(255,255,255,0)', 'rgba(255,255,255,0.75)', 'rgba(255,255,255,0)'));

// Left to right, stretched to whatever size the button is (as the web's linear-gradient(to right)).
const gradientXml = (a: string, b: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1" preserveAspectRatio="none"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="1" height="1" fill="url(#g)"/></svg>`;

// ========================================
// TYPES
// ========================================

export interface WidgetConfig {
  /** Position on screen: 'left' or 'right' (default: 'right') */
  position?: 'left' | 'right';
  /** Offset from the edge in pixels (default: 16) */
  offsetX?: number;
  /** Offset from the bottom in pixels (default: 16) */
  offsetBottom?: number;
  /** Widget button size in pixels (default: 56) */
  size?: number;
  /** Border radius (default: 28 — circular) */
  borderRadius?: number;
  /** Background color (solid). Falls back to server headerBgColor or '#1b55f3' */
  backgroundColor?: string;
  /** Theme type: 'solid' or 'gradient' (default: 'solid') */
  themeType?: 'solid' | 'gradient';
  /** Gradient start color (only used when themeType is 'gradient') */
  gradientColorStart?: string;
  /** Gradient end color */
  gradientColorEnd?: string;
  /** Icon name matching web widget (e.g., 'WidgetBubbleIcon1'). Falls back to server config */
  iconName?: string;
  /** Custom icon image URL (overrides SVG icon) */
  iconImageUrl?: string;
  /** Icon color inside the button (default: '#ffffff') */
  iconColor?: string;
  /** Icon size relative to button (default: 0.6 — matches web widget's 60% width) */
  iconScale?: number;
  /** CTA tooltip text (shown above/beside the button) */
  ctaText?: string;
  /** Whether to show the CTA tooltip (default: false) */
  showCta?: boolean;
  /** Shadow enabled (default: true) */
  showShadow?: boolean;
}

export interface ConferBotWidgetProps extends ChatWidgetProps {
  /** Floating button configuration */
  widgetConfig?: WidgetConfig;
}

// ========================================
// CTA TOOLTIP
// ========================================

const CtaTooltip: React.FC<{
  text: string;
  position: 'left' | 'right';
  backgroundColor: string;
  borderRadius: number;
  visible: boolean;
  onDismiss: () => void;
}> = ({ text, position, backgroundColor, borderRadius, visible, onDismiss }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 10, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!text) return null;

  return (
    <Animated.View
      style={[
        ctaStyles.container,
        { opacity, transform: [{ translateY }] },
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onDismiss}
        style={[ctaStyles.bubble, { backgroundColor, borderRadius }]}
      >
        <Text style={ctaStyles.text}>{text}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

const ctaStyles = StyleSheet.create({
  container: {
  },
  bubble: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    maxWidth: 212,
    ...Platform.select({
      ios: {
        shadowColor: 'rgba(50,50,93,1)',
        shadowOffset: { width: 0, height: 13 },
        shadowOpacity: 0.25,
        shadowRadius: 27,
      },
      android: { elevation: 8 },
    }),
  },
  text: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
});

// ========================================
// MAIN COMPONENT
// ========================================

export const ConferBotWidget: React.FC<ConferBotWidgetProps> = ({
  widgetConfig = {},
  ...chatWidgetProps
}) => {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [showCta, setShowCta] = useState(widgetConfig.showCta ?? false);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  // Try to get server customizations from context
  let serverCustomizations: any = null;
  let unreadCount = 0;
  let agentBot: any = null;
  let sendMessage: ((text: string) => Promise<void>) | null = null;
  // Past the home screen to the conversation, then ask (web firstImpression.ts openConversation).
  let showChat: ((text?: string) => void) | null = null;
  let botId = '';
  try {
    const ctx = useConferBot();
    serverCustomizations = (ctx as any).serverCustomizations;
    unreadCount = (ctx as any).unreadCount || 0;
    agentBot = (ctx as any).agentBot || null;
    sendMessage = (ctx as any).sendMessage || null;
    showChat = (ctx as any).showChat || null;
    botId = (ctx as any).chatbotConfig?.botId || (ctx as any).botId || '';
  } catch {
    // Context not available — widget used outside provider, that's fine
  }

  const sc = serverCustomizations || {};
  // The launcher as the web draws it on a phone (core/launcher); props win.
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const look = resolveLauncher(serverCustomizations, screenWidth);
  const position = widgetConfig.position || look.position;
  const flipped = position !== look.position;
  const size = widgetConfig.size ?? look.size;
  const width = widgetConfig.size ?? look.width;
  const offsetX = widgetConfig.offsetX ?? look.side;
  const offsetBottom = widgetConfig.offsetBottom ?? look.bottom;
  const corners = widgetConfig.borderRadius !== undefined
    ? { topLeft: widgetConfig.borderRadius, topRight: widgetConfig.borderRadius, bottomRight: widgetConfig.borderRadius, bottomLeft: widgetConfig.borderRadius }
    : flipped
    ? { topLeft: look.corners.topRight, topRight: look.corners.topLeft, bottomRight: look.corners.bottomLeft, bottomLeft: look.corners.bottomRight }
    : look.corners;
  const iconColor = widgetConfig.iconColor ?? look.ink;
  const iconSize = widgetConfig.iconScale ? Math.round(size * widgetConfig.iconScale) : look.glyph;

  // Background
  const themeType = widgetConfig.themeType || look.background.type;
  const bgColor = widgetConfig.backgroundColor || look.solid;
  const gradStart = widgetConfig.gradientColorStart || (look.background.type === 'gradient' ? look.background.colors[0] : bgColor);
  const gradEnd = widgetConfig.gradientColorEnd || (look.background.type === 'gradient' ? look.background.colors[1] : bgColor);

  // Icon: an uploaded image always wins; the avatar style fills the button with the bot's photo.
  const iconName = widgetConfig.iconName || look.iconId || undefined;
  const iconImageUrl = widgetConfig.iconImageUrl || look.imageUrl;
  const avatarUrl = !iconImageUrl && look.style === 'avatar' ? look.avatar : null;
  const showLabel = !iconImageUrl && look.style === 'label';

  // A host-app CTA text (widgetConfig.ctaText) keeps the simple tooltip; the
  // bot's own greeting is the web's greeting card (core/greeting).
  const ctaText = widgetConfig.ctaText || '';
  const ctaBorderRadius = Math.min(sc.widgetBorderRadius ?? 50, 20);
  const greeting = useGreeting({ customizations: serverCustomizations, chatOpen: isChatOpen, botId, agentBot, enabled: !ctaText });
  const cardShown = !!greeting.card && !isChatOpen;

  // The launcher's entrance, attention loop and idle call (core/launcherEntrance,
  // launcherAttention, launcherIdleCall): all off unless the owner chose one.
  const reduced = useReducedMotion();
  const [launcherSize, setLauncherSize] = useState<{ w: number; h: number } | null>(null);
  const [moment, setMoment] = useState(false);
  const edge = offsetX - look.tucked;
  const launcherLeft = launcherSize ? (position === 'right' ? screenWidth - edge - launcherSize.w : edge) : 0;
  const entrance = useLauncherEntrance({
    mode: look.entrance,
    botId,
    enabled: !!serverCustomizations,
    reduced,
    chatOpen: isChatOpen,
    size: launcherSize,
    position,
    screen: { width: screenWidth, height: screenHeight },
    side: edge,
    bottom: offsetBottom,
    accent: bgColor,
  });
  const attention = useLauncherAttention({
    mode: look.attention,
    enabled: !!serverCustomizations,
    reduced,
    chatOpen: isChatOpen,
    cardShown,
    moment,
    entranceBusy: entrance.busy,
    size: launcherSize,
    wide: showLabel,
  });
  const idleCall = useLauncherIdleCall({
    mode: look.idleCall,
    delay: look.idleCallDelay,
    enabled: !!serverCustomizations && !!SvgXml,
    reduced,
    chatOpen: isChatOpen,
    cardShown,
    entranceBusy: entrance.busy,
    botId,
    size: launcherSize,
    position,
  });

  // The icon's idle and new-message moments and the ripple rings (core/launcherMotion).
  const motion = useLauncherMotion({
    iconId: iconName,
    mode: look.animation,
    chatOpen: isChatOpen,
    unreadCount,
    enabled: !!serverCustomizations && !!SvgXml && !iconImageUrl && !avatarUrl,
    attention: attention.onLauncher,
  });
  // A moment playing pauses the attention loop.
  const momentNow = !!motion.frame;
  useEffect(() => setMoment(momentNow), [momentNow]);

  // Show CTA after a short delay
  useEffect(() => {
    if (ctaText && !isChatOpen) {
      const timer = setTimeout(() => setShowCta(true), 2000);
      return () => clearTimeout(timer);
    }
    setShowCta(false);
    return undefined;
  }, [ctaText, isChatOpen]);

  // Animate button press
  const handlePressIn = useCallback(() => {
    Animated.spring(scaleAnim, { toValue: 0.9, useNativeDriver: true }).start();
  }, []);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, { toValue: 1, friction: 3, useNativeDriver: true }).start();
  }, []);

  // Toggle chat with rotation animation
  const toggleChat = useCallback(() => {
    const opening = !isChatOpen;
    if (opening) noteLauncherOpened();
    setIsChatOpen(opening);
    setShowCta(false);

    Animated.spring(rotateAnim, {
      toValue: opening ? 1 : 0,
      useNativeDriver: true,
      friction: 6,
    }).start();
  }, [isChatOpen]);

  const handleChatClose = useCallback(() => {
    setIsChatOpen(false);
    Animated.spring(rotateAnim, {
      toValue: 0,
      useNativeDriver: true,
      friction: 6,
    }).start();
    chatWidgetProps.onClose?.();
  }, [chatWidgetProps.onClose]);

  const openIconOpacity = rotateAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 0, 0],
  });

  const closeIconOpacity = rotateAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0, 1],
  });

  // Resolve icon component
  const IconComponent = getBubbleIcon(iconName);

  // A soft glow in the header colour (0 0 4px), as the web draws it.
  const shadowStyle = (widgetConfig.showShadow !== false) ? Platform.select({
    ios: {
      shadowColor: look.glow,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.9,
      shadowRadius: 4,
    },
    android: {
      elevation: 6,
    },
  }) : undefined;

  // Render the icon content
  const renderIcon = () => {
    if (iconImageUrl) {
      return (
        <Image
          source={{ uri: iconImageUrl }}
          style={{ width: iconSize, height: iconSize, borderRadius: iconSize / 2 }}
          resizeMode="cover"
        />
      );
    }
    if (avatarUrl) {
      // The photo fills the button inside a thin ring of its colour, with an online dot.
      const dot = Math.max(10, Math.round(size * 0.24));
      return (
        <View style={{ width, height: size, padding: 3 }}>
          <Image
            source={{ uri: avatarUrl }}
            style={{ flex: 1, backgroundColor: '#fff', borderTopLeftRadius: corners.topLeft, borderTopRightRadius: corners.topRight, borderBottomRightRadius: corners.bottomRight, borderBottomLeftRadius: corners.bottomLeft }}
            resizeMode="cover"
          />
          <View style={{ position: 'absolute', right: size >= 56 ? 2 : 1, bottom: size >= 56 ? 2 : 1, width: dot, height: dot, borderRadius: dot / 2, backgroundColor: '#22c55e', borderWidth: 2, borderColor: '#fff' }} />
        </View>
      );
    }
    const glyphSize = showLabel ? Math.round(size * 0.52) : iconSize;
    // The web's launcher icons (core/launcherIcons) when react-native-svg is there; else the simple set.
    const glyph = SvgXml ? (
      <SvgXml xml={launcherIconSvg(iconName, iconColor, look.solid, glyphSize, motion.frame || undefined)} width={glyphSize} height={glyphSize} />
    ) : (
      <IconComponent size={glyphSize} color={iconColor} />
    );
    if (showLabel) {
      return (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Math.round(size * 0.16) }}>
          {glyph}
          <Text numberOfLines={1} style={{ color: iconColor, fontWeight: '600', fontSize: Math.max(13, Math.min(16, Math.round(size * 0.3))), maxWidth: 220 }}>
            {look.label}
          </Text>
        </View>
      );
    }
    return glyph;
  };

  // Render button background (solid or gradient)
  const renderButtonContent = () => {
    const innerContent = (
      <>
        {/* Open icon */}
        <Animated.View style={[showLabel ? null : styles.iconLayer, { opacity: openIconOpacity }]}>
          {renderIcon()}
        </Animated.View>
        {/* Close icon */}
        <Animated.View style={[styles.iconLayer, { opacity: closeIconOpacity }]}>
          <CloseIcon size={Math.round(size * 0.6)} color={iconColor} />
        </Animated.View>
      </>
    );

    // The label pill grows from the button's edge; even padding either side.
    const labelPad = Math.round((size - Math.round(size * 0.52)) / 2);
    const buttonStyle = {
      width: showLabel ? undefined : width,
      minWidth: showLabel ? size : undefined,
      paddingHorizontal: showLabel ? labelPad : 0,
      height: size,
      borderTopLeftRadius: corners.topLeft,
      borderTopRightRadius: corners.topRight,
      borderBottomRightRadius: corners.bottomRight,
      borderBottomLeftRadius: corners.bottomLeft,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    };

    const gradient = themeType === 'gradient' && SvgXml;
    return (
      <View style={[buttonStyle, { backgroundColor: gradient ? gradStart : bgColor }]}>
        {gradient && SvgXml ? (
          <View
            style={[StyleSheet.absoluteFill, { overflow: 'hidden', borderTopLeftRadius: corners.topLeft, borderTopRightRadius: corners.topRight, borderBottomRightRadius: corners.bottomRight, borderBottomLeftRadius: corners.bottomLeft }]}
            pointerEvents="none"
          >
            <SvgXml xml={gradientXml(gradStart, gradEnd)} width="100%" height="100%" />
          </View>
        ) : null}
        {innerContent}
        {/* Attention: the gloss band sweeping across, the spark circling it. */}
        {attention.styles?.shine && launcherSize ? (
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden', borderTopLeftRadius: corners.topLeft, borderTopRightRadius: corners.topRight, borderBottomRightRadius: corners.bottomRight, borderBottomLeftRadius: corners.bottomLeft }]}>
            <Animated.View style={[{ position: 'absolute', left: 0, top: launcherSize.h * GLOSS.top, width: launcherSize.w * GLOSS.width, height: launcherSize.h * GLOSS.height }, attention.styles.shine]}>
              {SvgXml ? <SvgXml xml={glossXml(launcherSize.w * GLOSS.width, launcherSize.h * GLOSS.height)} width="100%" height="100%" /> : null}
            </Animated.View>
          </View>
        ) : null}
        {attention.styles?.orbit ? (
          <Animated.View
            pointerEvents="none"
            style={[
              { position: 'absolute', left: 0, top: 0, width: ORBIT_DOT, height: ORBIT_DOT, borderRadius: ORBIT_DOT / 2, backgroundColor: '#fff' },
              Platform.select({ ios: { shadowColor: bgColor, shadowOpacity: 1, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } }, default: {} }),
              attention.styles.orbit,
            ]}
          />
        ) : null}
      </View>
    );
  };

  // The entrance's stage over (or, for the portal, just behind) the launcher.
  const renderStage = () =>
    entrance.plan && launcherSize && SvgXml ? (
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width: launcherSize.w, height: launcherSize.h, zIndex: entrance.plan.behind ? 0 : 10000, elevation: entrance.plan.behind ? 0 : 7 }}>
        {entrance.plan.sprites.map((sp, i) => (
          <FxSpriteView key={i} sp={sp} clock={entrance.clock} end={entrance.end} Svg={SvgXml!} />
        ))}
      </View>
    ) : null;

  // CTA offset from edge: FAB offset + FAB size + gap
  const ctaEdgeOffset = offsetX - look.tucked + width + 10;

  return (
    <>
      {/* CTA Tooltip — positioned independently so it can size freely */}
      {ctaText ? (
        <View
          style={[
            styles.ctaWrapper,
            position === 'right' ? { right: ctaEdgeOffset } : { left: ctaEdgeOffset },
            { bottom: offsetBottom },
          ]}
          pointerEvents="box-none"
        >
          <CtaTooltip
            text={ctaText}
            position={position}
            backgroundColor={bgColor}
            borderRadius={ctaBorderRadius}
            visible={showCta && !isChatOpen}
            onDismiss={() => setShowCta(false)}
          />
        </View>
      ) : null}

      {/* The greeting card: 12 above the launcher, its edge in line with it. */}
      {greeting.card && !isChatOpen ? (
        <View
          style={[styles.ctaWrapper, position === 'right' ? { right: Math.max(8, offsetX - look.tucked) } : { left: Math.max(8, offsetX - look.tucked) }, { bottom: offsetBottom + size + 12, maxWidth: screenWidth - 24 }]}
          pointerEvents="box-none"
        >
          <Animated.View style={entrance.styles?.greeting}>
          <Animated.View style={attention.target === 'greeting' ? attention.styles?.self : null}>
          <GreetingCard
            {...greeting.card}
            onPress={() => {
              greeting.closeForNow();
              const g = greeting.card!;
              if (g.click === 'link' && g.linkUrl) {
                Linking.openURL(g.linkUrl).catch(() => {});
                return;
              }
              if (!isChatOpen) toggleChat();
              if (g.click === 'send') {
                if (showChat) showChat(g.text);
                else if (sendMessage) setTimeout(() => sendMessage!(g.text).catch(() => {}), 400);
              }
            }}
            onClose={() => {
              greeting.dismiss();
              idleCall.greetingClosed();
            }}
            onStarter={(text) => {
              greeting.closeForNow();
              if (!isChatOpen) toggleChat();
              if (showChat) showChat(text);
              else if (sendMessage) setTimeout(() => sendMessage!(text).catch(() => {}), 400);
            }}
          />
          {/* Attention "wave": a waving hand on the card's corner (unless the text has its own). */}
          {attention.styles?.hand && !greeting.card.text.includes(WAVING_HAND) ? (
            <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: -13, left: -9, width: HAND.w, height: HAND.h, zIndex: 3 }, attention.styles.hand]}>
              <Text style={{ fontSize: 20, lineHeight: 20 }}>{WAVING_HAND}</Text>
            </Animated.View>
          ) : null}
          </Animated.View>
          </Animated.View>
        </View>
      ) : null}

      {/* Floating FAB */}
      <View
        style={[
          styles.fabContainer,
          position === 'left' ? { left: offsetX - look.tucked } : { right: offsetX - look.tucked },
          { bottom: offsetBottom },
        ]}
        pointerEvents="box-none"
      >
        {/* Attention "bounce": the contact shadow on the screen under it. */}
        {attention.styles?.shadow && launcherSize && SvgXml ? (
          <Animated.View
            pointerEvents="none"
            style={[{ position: 'absolute', left: launcherSize.w * 0.12, top: launcherSize.h * 0.9, width: launcherSize.w * 0.76, height: Math.max(6, launcherSize.h * 0.2) }, attention.styles.shadow]}
          >
            <SvgXml xml={radialDisc(launcherSize.w * 0.76, Math.max(6, launcherSize.h * 0.2), stops('rgba(15,23,42,.55)', 'rgba(15,23,42,0)'))} width="100%" height="100%" />
          </Animated.View>
        ) : null}
        {/* The idle call's mascot, hidden behind the button until it slides out. */}
        {idleCall.perf && idleCall.styles && !idleCall.perf.front && SvgXml && launcherSize ? (
          <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width: launcherSize.w, height: launcherSize.h }}>
            <IdleCallStage perf={idleCall.perf} styles={idleCall.styles} accent={mascotColor(serverCustomizations, bgColor)} launcherAccent={bgColor} Svg={SvgXml} />
          </View>
        ) : null}
        {entrance.plan && entrance.plan.behind && SvgXml ? renderStage() : null}
        <Animated.View onLayout={(e) => {
          const { width: w, height: h } = e.nativeEvent.layout;
          if (!launcherSize || Math.abs(launcherSize.w - w) > 0.5 || Math.abs(launcherSize.h - h) > 0.5) setLauncherSize({ w, h });
        }} style={entrance.styles?.launcher}>
        <Animated.View style={entrance.styles?.wipe ? { overflow: 'hidden', transform: entrance.styles.wipe.outer } : null}>
        <Animated.View style={entrance.styles?.wipe ? { transform: entrance.styles.wipe.inner } : null}>
        <Animated.View style={attention.target === 'launcher' ? attention.styles?.self : null}>
        <Animated.View style={idleCall.styles?.jolt}>
        {/* The ripple: rings of the launcher's colour growing out from behind it. */}
        {motion.rings.map((ring, k) =>
          ring ? (
            <View
              key={k}
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: launcherSize ? launcherSize.w : width,
                height: size,
                backgroundColor: bgColor,
                opacity: ring.opacity,
                transform: [{ scale: ring.scale }],
                borderTopLeftRadius: corners.topLeft,
                borderTopRightRadius: corners.topRight,
                borderBottomRightRadius: corners.bottomRight,
                borderBottomLeftRadius: corners.bottomLeft,
              }}
            />
          ) : null
        )}
        {/* Attention "pulse": two sonar rings in the launcher's colour. */}
        {(['ring', 'ring2'] as const).map((part) =>
          attention.styles?.[part] && launcherSize ? (
            <Animated.View
              key={part}
              pointerEvents="none"
              style={[
                {
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: launcherSize.w,
                  height: launcherSize.h,
                  borderWidth: 2.5,
                  borderColor: bgColor,
                  borderTopLeftRadius: corners.topLeft,
                  borderTopRightRadius: corners.topRight,
                  borderBottomRightRadius: corners.bottomRight,
                  borderBottomLeftRadius: corners.bottomLeft,
                },
                Platform.select({ ios: { shadowColor: bgColor, shadowOpacity: 1, shadowRadius: 7, shadowOffset: { width: 0, height: 0 } }, default: {} }),
                attention.styles[part],
              ]}
            />
          ) : null
        )}
        {/* FAB Button */}
        <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, shadowStyle]}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={toggleChat}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            accessibilityLabel={isChatOpen ? 'Close chat' : 'Open chat'}
            accessibilityRole="button"
          >
            {renderButtonContent()}
          </TouchableOpacity>
        </Animated.View>
        </Animated.View>
        </Animated.View>
        </Animated.View>
        </Animated.View>
        </Animated.View>
        {/* Knock and tap: the mascot in front of the button, its paw on it. */}
        {idleCall.perf && idleCall.styles && idleCall.perf.front && SvgXml && launcherSize ? (
          <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width: launcherSize.w, height: launcherSize.h, zIndex: 10001, elevation: 7 }}>
            <IdleCallStage perf={idleCall.perf} styles={idleCall.styles} accent={mascotColor(serverCustomizations, bgColor)} launcherAccent={bgColor} Svg={SvgXml} />
          </View>
        ) : null}
        {entrance.plan && !entrance.plan.behind && SvgXml ? renderStage() : null}
        {/* The idle call's speech bubble (none while the greeting is up). */}
        {idleCall.perf && idleCall.styles && idleCall.perf.talks && launcherSize ? (
          <IdleCallBubble
            perf={idleCall.perf}
            style={idleCall.styles.bubble}
            line={look.idleCallText}
            launcherLeft={launcherLeft}
            launcherHeight={launcherSize.h}
            screenWidth={screenWidth}
            font={null}
            onPress={() => {
              idleCall.stop();
              if (!isChatOpen) toggleChat();
            }}
          />
        ) : null}
      </View>

      {/* Chat Widget */}
      <ChatWidget
        {...chatWidgetProps}
        visible={isChatOpen}
        onClose={handleChatClose}
      />
    </>
  );
};

const styles = StyleSheet.create({
  ctaWrapper: {
    position: 'absolute',
    zIndex: 9998,
  },
  fabContainer: {
    position: 'absolute',
    zIndex: 9999,
    alignItems: 'center',
  },
  iconLayer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
