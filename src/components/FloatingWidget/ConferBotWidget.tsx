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
} from 'react-native';
import { useConferBot } from '../../context/ConferBotContext';
import { ChatWidget } from '../ChatWidget/ChatWidget';
import type { ChatWidgetProps } from '../ChatWidget/ChatWidget';
import { getBubbleIcon, CloseIcon } from './WidgetBubbleIcons';
import { resolveLauncher } from '../../core/launcher';

// react-native-svg draws a gradient launcher when the app has it; else its first colour.
let SvgXml: React.ComponentType<{ xml: string; width: number | string; height: number | string }> | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  SvgXml = require('react-native-svg').SvgXml;
} catch {
  SvgXml = null;
}

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
  try {
    const ctx = useConferBot();
    serverCustomizations = (ctx as any).serverCustomizations;
  } catch {
    // Context not available — widget used outside provider, that's fine
  }

  const sc = serverCustomizations || {};
  // The launcher as the web draws it on a phone (core/launcher); props win.
  const { width: screenWidth } = useWindowDimensions();
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

  // CTA: only when the owner turned the greeting on; border radius capped at 20 (as the web).
  const ctaText = widgetConfig.ctaText || look.ctaText || '';
  const ctaBorderRadius = Math.min(sc.widgetBorderRadius ?? 50, 20);

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
        <View style={{ width: size, height: size, padding: 3 }}>
          <Image
            source={{ uri: avatarUrl }}
            style={{ flex: 1, backgroundColor: '#fff', borderTopLeftRadius: corners.topLeft, borderTopRightRadius: corners.topRight, borderBottomRightRadius: corners.bottomRight, borderBottomLeftRadius: corners.bottomLeft }}
            resizeMode="cover"
          />
          <View style={{ position: 'absolute', right: size >= 56 ? 2 : 1, bottom: size >= 56 ? 2 : 1, width: dot, height: dot, borderRadius: dot / 2, backgroundColor: '#22c55e', borderWidth: 2, borderColor: '#fff' }} />
        </View>
      );
    }
    const glyph = <IconComponent size={showLabel ? Math.round(size * 0.52) : iconSize} color={iconColor} />;
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
          <CloseIcon size={iconSize} color={iconColor} />
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
      </View>
    );
  };

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

      {/* Floating FAB */}
      <View
        style={[
          styles.fabContainer,
          position === 'left' ? { left: offsetX - look.tucked } : { right: offsetX - look.tucked },
          { bottom: offsetBottom },
        ]}
        pointerEvents="box-none"
      >
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
