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
import type { ConferBotTheme } from '../../theme/types';

const CONFERBOT_URL = 'https://www.conferbot.com';
const CONFERBOT_LOGO_URL =
  'https://prd.media.cdn.conferbot.com/62829a1c49f355163dfdbfb2/conferbot-logo-1710782074234.png';

export interface ChatBottomBarProps {
  onSend: (text: string) => void | Promise<void>;
  placeholder?: string;
  disabled?: boolean;
  hideBrand?: boolean;
  customBrand?: string;
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
  placeholder = 'Type a message...',
  disabled = false,
  hideBrand = false,
  customBrand,
  testID,
}) => {
  const theme = useTheme();
  const styles = createStyles(theme);
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);

  const canSend = text.trim().length > 0 && !disabled && !isSending;

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
        {/* Pill-shaped input with subtle border */}
        <View style={styles.inputPill}>
          <TextInput
            style={styles.textInput}
            value={text}
            onChangeText={setText}
            placeholder={placeholder}
            placeholderTextColor="#4D4D4D"
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
              backgroundColor: canSend
                ? theme.colors.primary
                : `${theme.colors.primary}59`, // 35% opacity
            },
          ]}
          testID={testID ? `${testID}-send` : undefined}
        >
          {isSending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.sendIcon}>➤</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Powered-by footer — same white background, no separator */}
      {!hideBrand && (
        <TouchableOpacity
          onPress={handleOpenUrl}
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
                <Text style={styles.conferbotText}>conferbot</Text>
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
      backgroundColor: '#fff',
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
      borderColor: '#E0E0E0',
      backgroundColor: '#fff',
      justifyContent: 'center',
    },
    textInput: {
      fontSize: 15,
      color: '#000',
      paddingHorizontal: 16,
      paddingVertical: Platform.OS === 'ios' ? 10 : 6,
      maxHeight: 100,
    },
    sendButton: {
      width: 38,
      height: 38,
      borderRadius: 19,
      justifyContent: 'center',
      alignItems: 'center',
    },
    sendIcon: {
      color: '#fff',
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
      color: '#56595B',
    },
    logo: {
      height: 18,
      width: 80,
    },
    conferbotText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#4A4A4A',
    },
    customBrandText: {
      fontSize: 12,
      fontWeight: '500',
      color: '#687882',
    },
  });

export default ChatBottomBar;
