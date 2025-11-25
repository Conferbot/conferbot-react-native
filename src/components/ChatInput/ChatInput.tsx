import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme';
import type { ConferBotTheme } from '../../theme/types';

/**
 * ChatInput Props
 *
 * @interface ChatInputProps
 * @property {(text: string) => void | Promise<void>} onSend - Callback when send button is pressed
 * @property {string} [placeholder='Type a message...'] - Input placeholder text
 * @property {boolean} [disabled=false] - Whether input is disabled
 * @property {boolean} [enableAttachments=false] - Show attachment button
 * @property {() => void} [onAttachmentPress] - Callback when attachment button is pressed
 * @property {number} [maxLength=1000] - Maximum message length
 * @property {string} [sendButtonText='Send'] - Text for send button
 * @property {React.ReactNode} [sendIcon] - Custom send button icon
 * @property {React.ReactNode} [attachmentIcon] - Custom attachment button icon
 * @property {string} [testID] - Test identifier
 *
 * @example
 * ```tsx
 * <ChatInput
 *   onSend={(text) => handleSendMessage(text)}
 *   placeholder="Type your message..."
 *   enableAttachments={true}
 *   onAttachmentPress={() => openImagePicker()}
 * />
 * ```
 */
export interface ChatInputProps {
  onSend: (text: string) => void | Promise<void>;
  placeholder?: string;
  disabled?: boolean;
  enableAttachments?: boolean;
  onAttachmentPress?: () => void;
  maxLength?: number;
  sendButtonText?: string;
  sendIcon?: React.ReactNode;
  attachmentIcon?: React.ReactNode;
  testID?: string;
}

/**
 * ChatInput Component
 *
 * A text input component for sending messages with optional file attachment support.
 *
 * Features:
 * - Multi-line text input
 * - Send button (disabled when empty)
 * - Optional attachment button
 * - Character limit support
 * - Auto-growing input height
 * - Accessibility support
 * - Keyboard-friendly
 *
 * @component
 */
export const ChatInput: React.FC<ChatInputProps> = ({
  onSend,
  placeholder = 'Type a message...',
  disabled = false,
  enableAttachments = false,
  onAttachmentPress,
  maxLength = 1000,
  sendButtonText = 'Send',
  sendIcon,
  attachmentIcon,
  testID,
}) => {
  const theme = useTheme();
  const styles = createStyles(theme);

  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    const trimmedText = text.trim();
    if (!trimmedText || disabled || isSending) return;

    setIsSending(true);
    try {
      await onSend(trimmedText);
      setText(''); // Clear input after successful send
    } catch (error) {
      console.error('[ChatInput] Error sending message:', error);
    } finally {
      setIsSending(false);
    }
  };

  const canSend = text.trim().length > 0 && !disabled && !isSending;

  return (
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
            <Text style={styles.attachmentIcon}>📎</Text>
          )}
        </TouchableOpacity>
      )}

      {/* Text input */}
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
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

      {/* Send button */}
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
    </View>
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
  });
