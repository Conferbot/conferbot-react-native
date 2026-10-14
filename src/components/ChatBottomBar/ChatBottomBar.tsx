// @ts-nocheck
import React, { useState, useCallback } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  Image,
  Linking,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useTheme } from '../../theme';
import { readableOn } from '../../theme/color';
import type { ConferBotTheme } from '../../theme/types';

const CONFERBOT_URL = 'https://www.conferbot.com';
const CONFERBOT_LOGO_URL =
  'https://www.conferbot.com/img/logo/conferbot-logo.png';

export interface ChatBottomBarProps {
  onSend: (text: string) => void | Promise<void>;
  onTyping?: (isTyping: boolean) => void;
  placeholder?: string;
  disabled?: boolean;
  hideBrand?: boolean;
  customBrand?: string;
  /** The send button's colour: the bot's header colour, as on the web. */
  accent?: string;
  /** The paperclip: shown when given (a live chat that takes visitor files). */
  onAttach?: () => void;
  testID?: string;
}

/**
 * Unified bottom bar: chat input + powered-by footer as one seamless block.
 *
 * Matches the web widget where the input area and footer share the same
 * white background with a single upward shadow, creating one cohesive unit.
 */
export const ChatBottomBar: React.FC<ChatBottomBarProps> = ({
  onSend,
  onTyping,
  placeholder = 'Type a message...',
  disabled = false,
  hideBrand = false,
  customBrand,
  accent,
  onAttach,
  testID,
}) => {
  const theme = useTheme();
  const styles = createStyles(theme);
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const typingTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const canSend = text.trim().length > 0 && !disabled && !isSending;
  const sendColor = accent || theme.colors.primary;
  const sendInk = readableOn(sendColor);

  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || disabled || isSending) return;

    setIsSending(true);
    try {
      await onSend(trimmed);
      setText('');
    } catch (e) {
      // Handle error silently
    } finally {
      setIsSending(false);
    }
  }, [text, disabled, isSending, onSend]);

  const handleOpenUrl = useCallback(() => {
    Linking.openURL(CONFERBOT_URL);
  }, []);

  return (
    <View style={styles.container} testID={testID}>
      {/* Input row */}
      <View style={styles.inputRow}>
        {onAttach && (
          <TouchableOpacity
            onPress={onAttach}
            disabled={disabled}
            activeOpacity={0.7}
            style={[styles.attachButton, disabled && { opacity: 0.4 }]}
            accessibilityRole="button"
            accessibilityLabel="Attach a file"
            testID={testID ? `${testID}-attach` : undefined}
          >
            <Text style={styles.attachIcon}>{'\u{1F4CE}'}</Text>
          </TouchableOpacity>
        )}
        {/* Pill-shaped input with subtle border */}
        <View style={styles.inputPill}>
          <TextInput
            style={styles.textInput}
            value={text}
            onChangeText={(newText) => {
              setText(newText);
              if (onTyping) {
                if (newText.length > 0) {
                  onTyping(true);
                  if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                  typingTimeoutRef.current = setTimeout(() => onTyping(false), 1000);
                } else {
                  onTyping(false);
                }
              }
            }}
            placeholder={placeholder}
            placeholderTextColor={theme.colors.textSecondary}
            multiline
            maxLength={5000}
            editable={!disabled}
            returnKeyType="send"
            blurOnSubmit={false}
            onSubmitEditing={handleSend}
            testID={testID ? `${testID}-input` : undefined}
          />
        </View>

        {/* Themed circular send button */}
        <TouchableOpacity
          onPress={handleSend}
          disabled={!canSend}
          activeOpacity={0.7}
          style={[
            styles.sendButton,
            {
              backgroundColor: canSend ? sendColor : `${sendColor}59`, // 35% opacity
            },
          ]}
          testID={testID ? `${testID}-send` : undefined}
        >
          {isSending ? (
            <ActivityIndicator size="small" color={sendInk} />
          ) : (
            <Text style={[styles.sendIcon, { color: sendInk }]}>➤</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Powered-by footer — same white background, no separator */}
      {!hideBrand && (
        <TouchableOpacity
          onPress={customBrand ? undefined : handleOpenUrl}
          disabled={!!customBrand}
          activeOpacity={0.7}
          style={styles.footerContainer}
        >
          {customBrand ? (
            <Text style={styles.customBrandText}>{customBrand}</Text>
          ) : (
            <View style={styles.footerRow}>
              <Text style={styles.poweredByText}>Powered by </Text>
              {!logoFailed ? (
                <Image
                  source={{ uri: CONFERBOT_LOGO_URL }}
                  style={styles.logo}
                  resizeMode="contain"
                  onError={() => setLogoFailed(true)}
                />
              ) : (
                <Text style={styles.conferbotText}>Conferbot</Text>
              )}
            </View>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
};

const createStyles = (theme: ConferBotTheme) =>
  StyleSheet.create({
    container: {
      backgroundColor: theme.colors.surface,
      ...Platform.select({
        ios: {
          shadowColor: '#636363',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.12,
          shadowRadius: 4,
        },
        android: {
          elevation: 8,
        },
      }),
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingLeft: 10,
      paddingRight: 8,
      paddingTop: 6,
      paddingBottom: 2,
      gap: 8,
    },
    inputPill: {
      flex: 1,
      minHeight: 38,
      maxHeight: 100,
      borderRadius: 25,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      justifyContent: 'center',
    },
    textInput: {
      fontSize: 16,
      color: theme.colors.text,
      paddingHorizontal: 16,
      paddingVertical: Platform.OS === 'ios' ? 10 : 6,
      maxHeight: 100,
    },
    attachButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 6,
    },
    attachIcon: { fontSize: 20, color: theme.colors.textSecondary },
    sendButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      justifyContent: 'center',
      alignItems: 'center',
    },
    sendIcon: {
      fontSize: 18,
      fontWeight: '600',
    },
    footerContainer: {
      alignItems: 'center',
      paddingTop: 2,
      paddingBottom: 4,
    },
    footerRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    poweredByText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.colors.textSecondary,
    },
    logo: {
      height: 18,
      width: 80,
      marginLeft: -6,
      marginBottom: -3,
    },
    conferbotText: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.colors.textSecondary,
    },
    // The owner's footer text: weight 600 in the footer grey, as on the web.
    customBrandText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.colors.textSecondary,
    },
  });

export default ChatBottomBar;
