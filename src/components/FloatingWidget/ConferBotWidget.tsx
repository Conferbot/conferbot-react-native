import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
  Image,
  Text,
} from 'react-native';
import { useConferBot } from '../../context/ConferBotContext';
import { ChatWidget } from '../ChatWidget/ChatWidget';
import type { ChatWidgetProps } from '../ChatWidget/ChatWidget';
import { getBubbleIcon, CloseIcon } from './WidgetBubbleIcons';

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
  /** Icon size relative to button (default: 0.55) */
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
  visible: boolean;
  onDismiss: () => void;
}> = ({ text, position, backgroundColor, visible, onDismiss }) => {
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
        position === 'right' ? ctaStyles.right : ctaStyles.left,
        { opacity, transform: [{ translateY }] },
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onDismiss}
        style={[ctaStyles.bubble, { backgroundColor }]}
      >
        <Text style={ctaStyles.text}>{text}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

const ctaStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 4,
    maxWidth: 220,
  },
  right: { right: 64 },
  left: { left: 64 },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6 },
      android: { elevation: 4 },
    }),
  },
  text: {
    color: '#ffffff',
    fontSize: 13,
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

  // Resolve config: prop > server > default
  const sc = serverCustomizations || {};
  const position = widgetConfig.position || (sc.widgetPosition === 'left' ? 'left' : 'right');
  const offsetX = widgetConfig.offsetX ?? sc.widgetOffsetRight ?? sc.widgetOffsetLeft ?? 16;
  const offsetBottom = widgetConfig.offsetBottom ?? sc.widgetOffsetBottom ?? 16;
  const size = widgetConfig.size ?? sc.widgetSize ?? 56;
  const borderRadius = widgetConfig.borderRadius ?? sc.widgetBorderRadius ?? size / 2;
  const iconColor = widgetConfig.iconColor ?? '#ffffff';
  const iconScale = widgetConfig.iconScale ?? 0.55;
  const iconSize = Math.round(size * iconScale);

  // Background
  const themeType = widgetConfig.themeType || (sc.widgetIconThemeType === 'Gradient' ? 'gradient' : 'solid');
  const bgColor = widgetConfig.backgroundColor || sc.widgetIconBgColor || sc.headerBgColor || '#1b55f3';
  const gradStart = widgetConfig.gradientColorStart || sc.widgetGradientBgOne || '#fffcf1';
  const gradEnd = widgetConfig.gradientColorEnd || sc.widgetGradientBgTwo || '#1b55f3';

  // Icon
  const iconName = widgetConfig.iconName || sc.widgetIconSVG;
  const iconImageUrl = widgetConfig.iconImageUrl || sc.widgetIconImage;

  // CTA
  const ctaText = widgetConfig.ctaText || sc.chatIconCtaText || '';

  // Show CTA after a short delay
  useEffect(() => {
    if (ctaText && !isChatOpen) {
      const timer = setTimeout(() => setShowCta(true), 2000);
      return () => clearTimeout(timer);
    } else {
      setShowCta(false);
    }
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

  // Rotate interpolation for icon swap
  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '90deg'],
  });

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

  // Shadow style
  const shadowStyle = (widgetConfig.showShadow !== false) ? Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
    },
    android: {
      elevation: 8,
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
    return <IconComponent size={iconSize} color={iconColor} />;
  };

  // Render button background (solid or gradient)
  const renderButtonContent = () => {
    const innerContent = (
      <>
        {/* Open icon */}
        <Animated.View style={[styles.iconLayer, { opacity: openIconOpacity }]}>
          {renderIcon()}
        </Animated.View>
        {/* Close icon */}
        <Animated.View style={[styles.iconLayer, { opacity: closeIconOpacity }]}>
          <CloseIcon size={iconSize} color={iconColor} />
        </Animated.View>
      </>
    );

    const buttonStyle = {
      width: size,
      height: size,
      borderRadius,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    };

    // Gradient support: use gradEnd color as solid fallback
    const resolvedBg = themeType === 'gradient' ? gradEnd : bgColor;

    return (
      <View style={[buttonStyle, { backgroundColor: resolvedBg }]}>
        {innerContent}
      </View>
    );
  };

  return (
    <>
      {/* Floating FAB */}
      <View
        style={[
          styles.fabContainer,
          position === 'left' ? { left: offsetX } : { right: offsetX },
          { bottom: offsetBottom },
        ]}
        pointerEvents="box-none"
      >
        {/* CTA Tooltip */}
        {ctaText ? (
          <CtaTooltip
            text={ctaText}
            position={position}
            backgroundColor={bgColor}
            visible={showCta && !isChatOpen}
            onDismiss={() => setShowCta(false)}
          />
        ) : null}

        {/* FAB Button */}
        <Animated.View style={[{ transform: [{ scale: scaleAnim }, { rotate }] }, shadowStyle]}>
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
