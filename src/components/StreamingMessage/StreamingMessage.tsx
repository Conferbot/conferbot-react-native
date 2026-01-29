/**
 * StreamingMessage.tsx
 *
 * A message bubble component that displays AI responses with streaming support.
 * Shows text as tokens arrive, with typing indicator and stop/regenerate options.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import type { StyleProp, ViewStyle, TextStyle } from 'react-native';
import type { AIResponseUIState, StreamingState } from '../../services/ai/types';

// ========================================
// TYPES
// ========================================

export interface StreamingMessageProps {
  /** AI response state (from AIHandler) */
  responseState: AIResponseUIState;
  /** Callback when stop is pressed */
  onStop?: () => void;
  /** Callback when regenerate is pressed */
  onRegenerate?: () => void;
  /** Whether stop button is enabled */
  allowStop?: boolean;
  /** Whether regenerate button is enabled */
  allowRegenerate?: boolean;
  /** Show typing indicator while connecting */
  showTypingIndicator?: boolean;
  /** Custom container style */
  containerStyle?: StyleProp<ViewStyle>;
  /** Custom text style */
  textStyle?: StyleProp<TextStyle>;
  /** Custom bubble style */
  bubbleStyle?: StyleProp<ViewStyle>;
  /** Theme colors */
  theme?: StreamingMessageTheme;
}

export interface StreamingMessageTheme {
  bubbleBackground: string;
  textColor: string;
  secondaryTextColor: string;
  accentColor: string;
  errorColor: string;
  buttonBackground: string;
  buttonText: string;
  cursorColor: string;
}

// ========================================
// DEFAULT THEME
// ========================================

const DEFAULT_THEME: StreamingMessageTheme = {
  bubbleBackground: '#f0f0f0',
  textColor: '#333333',
  secondaryTextColor: '#666666',
  accentColor: '#007AFF',
  errorColor: '#FF3B30',
  buttonBackground: '#e0e0e0',
  buttonText: '#333333',
  cursorColor: '#007AFF',
};

// ========================================
// TYPING INDICATOR COMPONENT
// ========================================

interface TypingIndicatorProps {
  color?: string;
}

const TypingIndicator: React.FC<TypingIndicatorProps> = ({
  color = DEFAULT_THEME.accentColor,
}) => {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animateDot = (dot: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, {
            toValue: 1,
            duration: 300,
            easing: Easing.ease,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: 300,
            easing: Easing.ease,
            useNativeDriver: true,
          }),
        ])
      );
    };

    const animation1 = animateDot(dot1, 0);
    const animation2 = animateDot(dot2, 150);
    const animation3 = animateDot(dot3, 300);

    animation1.start();
    animation2.start();
    animation3.start();

    return () => {
      animation1.stop();
      animation2.stop();
      animation3.stop();
    };
  }, [dot1, dot2, dot3]);

  const dotStyle = (anim: Animated.Value) => ({
    transform: [
      {
        translateY: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -4],
        }),
      },
    ],
  });

  return (
    <View style={styles.typingContainer}>
      <Animated.View style={[styles.typingDot, { backgroundColor: color }, dotStyle(dot1)]} />
      <Animated.View style={[styles.typingDot, { backgroundColor: color }, dotStyle(dot2)]} />
      <Animated.View style={[styles.typingDot, { backgroundColor: color }, dotStyle(dot3)]} />
    </View>
  );
};

// ========================================
// CURSOR COMPONENT
// ========================================

interface CursorProps {
  visible: boolean;
  color?: string;
}

const Cursor: React.FC<CursorProps> = ({ visible, color = DEFAULT_THEME.cursorColor }) => {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
      return () => animation.stop();
    }
  }, [visible, opacity]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.cursor,
        { backgroundColor: color, opacity },
      ]}
    />
  );
};

// ========================================
// ACTION BUTTONS COMPONENT
// ========================================

interface ActionButtonsProps {
  state: StreamingState;
  isComplete: boolean;
  hasError: boolean;
  allowStop: boolean;
  allowRegenerate: boolean;
  onStop: () => void;
  onRegenerate: () => void;
  theme: StreamingMessageTheme;
}

const ActionButtons: React.FC<ActionButtonsProps> = ({
  state,
  isComplete,
  hasError,
  allowStop,
  allowRegenerate,
  onStop,
  onRegenerate,
  theme,
}) => {
  const showStop = allowStop && (state === 'STREAMING' || state === 'CONNECTING');
  const showRegenerate = allowRegenerate && (isComplete || hasError);

  if (!showStop && !showRegenerate) return null;

  return (
    <View style={styles.actionsContainer}>
      {showStop && (
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: theme.buttonBackground }]}
          onPress={onStop}
          activeOpacity={0.7}
        >
          <Text style={[styles.actionButtonText, { color: theme.buttonText }]}>
            Stop
          </Text>
        </TouchableOpacity>
      )}

      {showRegenerate && (
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: theme.buttonBackground }]}
          onPress={onRegenerate}
          activeOpacity={0.7}
        >
          <Text style={[styles.actionButtonText, { color: theme.buttonText }]}>
            Regenerate
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

// ========================================
// STATUS INDICATOR COMPONENT
// ========================================

interface StatusIndicatorProps {
  state: StreamingState;
  tokensUsed?: number;
  model?: string;
  provider?: string;
  error?: { message: string };
  theme: StreamingMessageTheme;
}

const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  state,
  tokensUsed,
  model,
  provider,
  error,
  theme,
}) => {
  if (state === 'ERROR' && error) {
    return (
      <View style={styles.statusContainer}>
        <Text style={[styles.statusText, { color: theme.errorColor }]}>
          Error: {error.message}
        </Text>
      </View>
    );
  }

  if (state === 'STOPPED') {
    return (
      <View style={styles.statusContainer}>
        <Text style={[styles.statusText, { color: theme.secondaryTextColor }]}>
          Generation stopped
        </Text>
      </View>
    );
  }

  if (state === 'COMPLETED' && (tokensUsed || model)) {
    const parts: string[] = [];
    if (provider) parts.push(provider);
    if (model) parts.push(model);
    if (tokensUsed) parts.push(`${tokensUsed} tokens`);

    return (
      <View style={styles.statusContainer}>
        <Text style={[styles.statusText, { color: theme.secondaryTextColor }]}>
          {parts.join(' - ')}
        </Text>
      </View>
    );
  }

  return null;
};

// ========================================
// MAIN COMPONENT
// ========================================

export const StreamingMessage: React.FC<StreamingMessageProps> = ({
  responseState,
  onStop,
  onRegenerate,
  allowStop = true,
  allowRegenerate = true,
  showTypingIndicator = true,
  containerStyle,
  textStyle,
  bubbleStyle,
  theme: customTheme,
}) => {
  const theme = { ...DEFAULT_THEME, ...customTheme };

  const {
    state,
    content,
    isComplete,
    error,
    tokensUsed,
    model,
    provider,
  } = responseState;

  // Determine what to show
  const showTyping = showTypingIndicator && state === 'CONNECTING' && !content;
  const showCursor = state === 'STREAMING' && !isComplete;
  const hasContent = content && content.length > 0;
  const hasError = !!error;

  // Handle actions
  const handleStop = useCallback(() => {
    onStop?.();
  }, [onStop]);

  const handleRegenerate = useCallback(() => {
    onRegenerate?.();
  }, [onRegenerate]);

  return (
    <View style={[styles.container, containerStyle]}>
      <View style={[styles.bubble, { backgroundColor: theme.bubbleBackground }, bubbleStyle]}>
        {showTyping && <TypingIndicator color={theme.accentColor} />}

        {hasContent && (
          <View style={styles.contentContainer}>
            <Text style={[styles.text, { color: theme.textColor }, textStyle]}>
              {content}
              <Cursor visible={showCursor} color={theme.cursorColor} />
            </Text>
          </View>
        )}

        {!showTyping && !hasContent && state === 'ERROR' && (
          <Text style={[styles.text, { color: theme.errorColor }]}>
            {error?.message || 'An error occurred'}
          </Text>
        )}

        <StatusIndicator
          state={state}
          tokensUsed={tokensUsed}
          model={model}
          provider={provider}
          error={error}
          theme={theme}
        />

        <ActionButtons
          state={state}
          isComplete={isComplete}
          hasError={hasError}
          allowStop={allowStop}
          allowRegenerate={allowRegenerate}
          onStop={handleStop}
          onRegenerate={handleRegenerate}
          theme={theme}
        />
      </View>
    </View>
  );
};

// ========================================
// HOOK FOR STREAMING MESSAGE STATE
// ========================================

export interface UseStreamingMessageOptions {
  initialContent?: string;
}

export interface UseStreamingMessageResult {
  content: string;
  state: StreamingState;
  isComplete: boolean;
  error: { message: string } | null;
  appendContent: (text: string) => void;
  setContent: (text: string) => void;
  setState: (state: StreamingState) => void;
  setError: (error: { message: string }) => void;
  reset: () => void;
}

export function useStreamingMessage(
  options?: UseStreamingMessageOptions
): UseStreamingMessageResult {
  const [content, setContent] = useState(options?.initialContent || '');
  const [state, setState] = useState<StreamingState>('IDLE');
  const [error, setErrorState] = useState<{ message: string } | null>(null);

  const appendContent = useCallback((text: string) => {
    setContent((prev) => prev + text);
  }, []);

  const setError = useCallback((err: { message: string }) => {
    setErrorState(err);
    setState('ERROR');
  }, []);

  const reset = useCallback(() => {
    setContent('');
    setState('IDLE');
    setErrorState(null);
  }, []);

  const isComplete = state === 'COMPLETED' || state === 'STOPPED' || state === 'ERROR';

  return {
    content,
    state,
    isComplete,
    error,
    appendContent,
    setContent,
    setState,
    setError,
    reset,
  };
}

// ========================================
// STYLES
// ========================================

const styles = StyleSheet.create({
  container: {
    alignItems: 'flex-start',
    marginVertical: 4,
    marginHorizontal: 12,
  },
  bubble: {
    maxWidth: '85%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopLeftRadius: 4,
  },
  contentContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
  },
  text: {
    fontSize: 16,
    lineHeight: 22,
    ...Platform.select({
      ios: {
        fontFamily: 'System',
      },
      android: {
        fontFamily: 'Roboto',
      },
    }),
  },
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 2,
  },
  cursor: {
    width: 2,
    height: 18,
    marginLeft: 1,
    borderRadius: 1,
  },
  actionsContainer: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '500',
  },
  statusContainer: {
    marginTop: 6,
  },
  statusText: {
    fontSize: 11,
    fontStyle: 'italic',
  },
});

export default StreamingMessage;
