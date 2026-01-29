import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  Modal,
} from 'react-native';
import { useTheme } from '../../theme';
import type { ConferBotTheme } from '../../theme/types';
import { getAnalyticsService } from '../../services/analytics';
import { VoiceRecorder, VoiceRecordingResult } from '../VoiceRecorder';
import { isAudioRecorderAvailable } from '../../utils/AudioRecorder';
import { EmojiPicker, EmojiButton } from '../EmojiPicker';

/**
 * ChatInput Props
 *
 * @interface ChatInputProps
 * @property {(text: string) => void | Promise<void>} onSend - Callback when send button is pressed
 * @property {string} [placeholder='Type a message...'] - Input placeholder text
 * @property {boolean} [disabled=false] - Whether input is disabled
 * @property {boolean} [enableAttachments=false] - Show attachment button
 * @property {() => void} [onAttachmentPress] - Callback when attachment button is pressed
 * @property {boolean} [enableVoiceMessage=false] - Show voice message button
 * @property {(recording: VoiceRecordingResult) => void | Promise<void>} [onVoiceSend] - Callback when voice message is sent
 * @property {boolean} [enableEmoji=true] - Show emoji picker button
 * @property {number} [emojiPickerHeight=300] - Height of the emoji picker panel
 * @property {number} [maxLength=1000] - Maximum message length
 * @property {string} [sendButtonText='Send'] - Text for send button
 * @property {React.ReactNode} [sendIcon] - Custom send button icon
 * @property {React.ReactNode} [attachmentIcon] - Custom attachment button icon
 * @property {React.ReactNode} [microphoneIcon] - Custom microphone button icon
 * @property {boolean} [enableAnalytics=true] - Enable analytics tracking for typing
 * @property {number} [voiceMaxDuration=300000] - Maximum voice recording duration (ms)
 * @property {number} [voiceMinDuration=1000] - Minimum voice recording duration (ms)
 * @property {object} [asyncStorage] - AsyncStorage instance for persisting recent emojis
 * @property {string} [testID] - Test identifier
 *
 * @example
 * ```tsx
 * <ChatInput
 *   onSend={(text) => handleSendMessage(text)}
 *   placeholder="Type your message..."
 *   enableAttachments={true}
 *   onAttachmentPress={() => openImagePicker()}
 *   enableVoiceMessage={true}
 *   onVoiceSend={(recording) => handleVoiceMessage(recording)}
 *   enableEmoji={true}
 * />
 * ```
 */
export interface ChatInputProps {
  onSend: (text: string) => void | Promise<void>;
  placeholder?: string;
  disabled?: boolean;
  enableAttachments?: boolean;
  onAttachmentPress?: () => void;
  enableVoiceMessage?: boolean;
  onVoiceSend?: (recording: VoiceRecordingResult) => void | Promise<void>;
  enableEmoji?: boolean;
  emojiPickerHeight?: number;
  maxLength?: number;
  sendButtonText?: string;
  sendIcon?: React.ReactNode;
  attachmentIcon?: React.ReactNode;
  microphoneIcon?: React.ReactNode;
  enableAnalytics?: boolean;
  voiceMaxDuration?: number;
  voiceMinDuration?: number;
  asyncStorage?: {
    getItem: (key: string) => Promise<string | null>;
    setItem: (key: string, value: string) => Promise<void>;
  };
  testID?: string;
}

/**
 * ChatInput Component
 *
 * A text input component for sending messages with optional file attachment,
 * voice message, and emoji picker support.
 *
 * Features:
 * - Multi-line text input
 * - Send button (disabled when empty)
 * - Optional attachment button
 * - Optional voice message recording
 * - Emoji picker with categories and search
 * - Character limit support
 * - Auto-growing input height
 * - Accessibility support
 * - Keyboard-friendly
 * - Analytics tracking for typing behavior
 *
 * @component
 */
export const ChatInput: React.FC<ChatInputProps> = ({
  onSend,
  placeholder = 'Type a message...',
  disabled = false,
  enableAttachments = false,
  onAttachmentPress,
  enableVoiceMessage = false,
  onVoiceSend,
  enableEmoji = true,
  emojiPickerHeight = 300,
  maxLength = 1000,
  sendButtonText = 'Send',
  sendIcon,
  attachmentIcon,
  microphoneIcon,
  enableAnalytics = true,
  voiceMaxDuration = 300000, // 5 minutes
  voiceMinDuration = 1000, // 1 second
  asyncStorage,
  testID,
}) => {
  const theme = useTheme();
  const styles = createStyles(theme);

  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);

  // Text input ref for cursor positioning
  const textInputRef = useRef<TextInput>(null);

  // Check if voice recording is available
  const voiceAvailable = enableVoiceMessage && isAudioRecorderAvailable() && onVoiceSend;

  // Analytics tracking refs
  const isTypingRef = useRef(false);
  const previousTextLengthRef = useRef(0);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Get analytics service (only if enabled)
  const analytics = enableAnalytics ? getAnalyticsService() : null;

  // Track typing start/stop
  const handleTypingStart = useCallback(() => {
    if (!analytics?.initialized || isTypingRef.current) return;
    isTypingRef.current = true;
    analytics.trackTypingStart();
  }, [analytics]);

  const handleTypingEnd = useCallback((wasSent: boolean = true) => {
    if (!analytics?.initialized || !isTypingRef.current) return;
    isTypingRef.current = false;
    analytics.trackTypingEnd(wasSent);
  }, [analytics]);

  // Handle text change with analytics
  const handleTextChange = useCallback((newText: string) => {
    const previousLength = previousTextLengthRef.current;

    // Track deletion
    if (analytics?.initialized && newText.length < previousLength) {
      analytics.trackDeletion();
    }

    // Start typing tracking if first character
    if (newText.length > 0 && previousLength === 0) {
      handleTypingStart();
    }

    // Reset typing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // If text is cleared without sending, track abandoned typing
    if (newText.length === 0 && previousLength > 0 && isTypingRef.current) {
      handleTypingEnd(false);
    }

    // Set timeout to track idle (stopped typing)
    if (newText.length > 0) {
      typingTimeoutRef.current = setTimeout(() => {
        // User stopped typing for 3 seconds
      }, 3000);
    }

    previousTextLengthRef.current = newText.length;
    setText(newText);
  }, [analytics, handleTypingStart, handleTypingEnd]);

  // Track cursor position
  const handleSelectionChange = useCallback((event: any) => {
    setCursorPosition(event.nativeEvent.selection.start);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      // If there's unsent text, track as abandoned
      if (isTypingRef.current && text.length > 0) {
        handleTypingEnd(false);
      }
    };
  }, [handleTypingEnd, text.length]);

  const handleSend = async () => {
    const trimmedText = text.trim();
    if (!trimmedText || disabled || isSending) return;

    // Close emoji picker if open
    if (showEmojiPicker) {
      setShowEmojiPicker(false);
    }

    // End typing tracking (successful send)
    if (isTypingRef.current) {
      handleTypingEnd(true);
    }

    setIsSending(true);
    try {
      await onSend(trimmedText);
      setText(''); // Clear input after successful send
      previousTextLengthRef.current = 0;

      // Track user message sent
      if (analytics?.initialized) {
        analytics.trackUserMessage(trimmedText);
      }
    } catch (error) {
      console.error('[ChatInput] Error sending message:', error);
    } finally {
      setIsSending(false);
    }
  };

  // Handle emoji selection - insert at cursor position
  const handleEmojiSelect = useCallback((emoji: string) => {
    setText((prevText) => {
      const pos = Math.min(cursorPosition, prevText.length);
      const newText = prevText.slice(0, pos) + emoji + prevText.slice(pos);
      previousTextLengthRef.current = newText.length;

      // Update cursor position after emoji insertion
      const newCursorPos = pos + emoji.length;
      setCursorPosition(newCursorPos);

      // Track emoji usage
      if (analytics?.initialized) {
        analytics.trackEvent('emoji_inserted', { emoji });
      }

      return newText;
    });
  }, [cursorPosition, analytics]);

  // Toggle emoji picker
  const handleEmojiButtonPress = useCallback(() => {
    if (showEmojiPicker) {
      // Show keyboard when closing emoji picker
      setShowEmojiPicker(false);
      textInputRef.current?.focus();
    } else {
      // Dismiss keyboard and show emoji picker
      textInputRef.current?.blur();
      setShowEmojiPicker(true);
    }
  }, [showEmojiPicker]);

  // Handle text input focus - close emoji picker
  const handleTextInputFocus = useCallback(() => {
    if (showEmojiPicker) {
      setShowEmojiPicker(false);
    }
  }, [showEmojiPicker]);

  // Handle voice message send
  const handleVoiceSend = useCallback(async (recording: VoiceRecordingResult) => {
    if (!onVoiceSend) return;

    setIsSending(true);
    try {
      await onVoiceSend(recording);
      setShowVoiceRecorder(false);

      // Track voice message sent
      if (analytics?.initialized) {
        analytics.trackEvent('voice_message_sent', {
          duration: recording.duration,
          size: recording.size,
        });
      }
    } catch (error) {
      console.error('[ChatInput] Error sending voice message:', error);
    } finally {
      setIsSending(false);
    }
  }, [onVoiceSend, analytics]);

  // Handle voice recorder cancel
  const handleVoiceCancel = useCallback(() => {
    setShowVoiceRecorder(false);

    // Track voice recording cancelled
    if (analytics?.initialized) {
      analytics.trackEvent('voice_recording_cancelled');
    }
  }, [analytics]);

  // Open voice recorder
  const handleMicrophonePress = useCallback(() => {
    // Close emoji picker if open
    if (showEmojiPicker) {
      setShowEmojiPicker(false);
    }

    setShowVoiceRecorder(true);

    // Track voice recording started
    if (analytics?.initialized) {
      analytics.trackEvent('voice_recording_started');
    }
  }, [showEmojiPicker, analytics]);

  const canSend = text.trim().length > 0 && !disabled && !isSending;
  const showMicButton = voiceAvailable && text.trim().length === 0;

  return (
    <>
      <View
        style={styles.container}
        accessible={true}
        accessibilityLabel="Message input"
        testID={testID}
      >
        {/* Attachment button */}
        {enableAttachments && (
          <TouchableOpacity
            style={styles.attachmentButton}
            onPress={onAttachmentPress}
            disabled={disabled}
            accessible={true}
            accessibilityLabel="Attach file"
            accessibilityRole="button"
            testID={`${testID}-attachment`}
          >
            {attachmentIcon || (
              <Text style={styles.attachmentIcon}>+</Text>
            )}
          </TouchableOpacity>
        )}

        {/* Emoji button */}
        {enableEmoji && (
          <EmojiButton
            onPress={handleEmojiButtonPress}
            isActive={showEmojiPicker}
            disabled={disabled}
            testID={`${testID}-emoji-button`}
          />
        )}

        {/* Text input */}
        <TextInput
          ref={textInputRef}
          style={styles.input}
          value={text}
          onChangeText={handleTextChange}
          onSelectionChange={handleSelectionChange}
          onFocus={handleTextInputFocus}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textSecondary}
          multiline
          maxLength={maxLength}
          editable={!disabled && !isSending}
          returnKeyType="send"
          blurOnSubmit={false}
          onSubmitEditing={handleSend}
          accessible={true}
          accessibilityLabel={placeholder}
          accessibilityHint="Type your message here"
          testID={`${testID}-input`}
        />

        {/* Microphone button - shown when no text is entered */}
        {showMicButton && (
          <TouchableOpacity
            style={styles.microphoneButton}
            onPress={handleMicrophonePress}
            disabled={disabled || isSending}
            accessible={true}
            accessibilityLabel="Record voice message"
            accessibilityRole="button"
            testID={`${testID}-microphone`}
          >
            {microphoneIcon || (
              <View style={styles.micIconContainer}>
                <View style={[styles.micBody, { backgroundColor: theme.colors.primary }]} />
                <View style={[styles.micBase, { borderColor: theme.colors.primary }]} />
                <View style={[styles.micStand, { backgroundColor: theme.colors.primary }]} />
              </View>
            )}
          </TouchableOpacity>
        )}

        {/* Send button - shown when text is entered */}
        {(!showMicButton || text.trim().length > 0) && (
          <TouchableOpacity
            style={[
              styles.sendButton,
              canSend ? styles.sendButtonActive : styles.sendButtonDisabled,
            ]}
            onPress={handleSend}
            disabled={!canSend}
            accessible={true}
            accessibilityLabel="Send message"
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSend }}
            testID={`${testID}-send`}
          >
            {sendIcon || (
              <Text
                style={[
                  styles.sendButtonText,
                  canSend ? styles.sendButtonTextActive : styles.sendButtonTextDisabled,
                ]}
              >
                {isSending ? '...' : sendButtonText}
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Emoji Picker */}
      {enableEmoji && (
        <EmojiPicker
          visible={showEmojiPicker}
          onEmojiSelect={handleEmojiSelect}
          onClose={() => setShowEmojiPicker(false)}
          height={emojiPickerHeight}
          asyncStorage={asyncStorage}
          testID={`${testID}-emoji-picker`}
        />
      )}

      {/* Voice Recorder Modal */}
      <Modal
        visible={showVoiceRecorder}
        animationType="slide"
        transparent={true}
        onRequestClose={handleVoiceCancel}
      >
        <View style={styles.voiceRecorderOverlay}>
          <View style={styles.voiceRecorderContainer}>
            <VoiceRecorder
              onSend={handleVoiceSend}
              onCancel={handleVoiceCancel}
              maxDuration={voiceMaxDuration}
              minDuration={voiceMinDuration}
              disabled={isSending}
              testID={`${testID}-voice-recorder`}
            />
          </View>
        </View>
      </Modal>
    </>
  );
};

const createStyles = (theme: ConferBotTheme) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      backgroundColor: theme.colors.surface,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      minHeight: theme.layout.inputHeight,
      gap: theme.spacing.sm,
    },
    attachmentButton: {
      justifyContent: 'center',
      alignItems: 'center',
      width: 36,
      height: 36,
      marginBottom: theme.spacing.xs,
    },
    attachmentIcon: {
      fontSize: 20,
    },
    input: {
      flex: 1,
      minHeight: 40,
      maxHeight: 120,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      backgroundColor: theme.colors.background,
      borderRadius: theme.borderRadius.full,
      borderWidth: 1,
      borderColor: theme.colors.borderLight,
      fontSize: theme.typography.fontSize.md,
      color: theme.colors.text,
      lineHeight: theme.typography.fontSize.md * theme.typography.lineHeight.normal,
    },
    microphoneButton: {
      justifyContent: 'center',
      alignItems: 'center',
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.borderLight,
      marginBottom: theme.spacing.xs,
    },
    micIconContainer: {
      width: 20,
      height: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    micBody: {
      width: 8,
      height: 12,
      borderRadius: 4,
    },
    micBase: {
      width: 12,
      height: 6,
      borderWidth: 1.5,
      borderTopWidth: 0,
      borderBottomLeftRadius: 6,
      borderBottomRightRadius: 6,
      backgroundColor: 'transparent',
      marginTop: -1,
    },
    micStand: {
      width: 1.5,
      height: 4,
      marginTop: 0,
    },
    sendButton: {
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.borderRadius.full,
      minWidth: 60,
      marginBottom: theme.spacing.xs,
    },
    sendButtonActive: {
      backgroundColor: theme.colors.primary,
    },
    sendButtonDisabled: {
      backgroundColor: theme.colors.borderLight,
    },
    sendButtonText: {
      fontSize: theme.typography.fontSize.md,
      fontWeight: theme.typography.fontWeight.semibold,
    },
    sendButtonTextActive: {
      color: theme.colors.textInverse,
    },
    sendButtonTextDisabled: {
      color: theme.colors.textDisabled,
    },
    // Voice recorder modal styles
    voiceRecorderOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    voiceRecorderContainer: {
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: theme.borderRadius.xl,
      borderTopRightRadius: theme.borderRadius.xl,
      ...theme.shadows.lg,
    },
  });
