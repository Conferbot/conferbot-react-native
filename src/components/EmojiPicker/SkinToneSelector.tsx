// @ts-nocheck
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Modal,
} from 'react-native';
import { useTheme } from '../../theme';
import type { ConferBotTheme } from '../../theme/types';
import { SKIN_TONES, applySkintone, type SkinToneId } from './emojiData';

export interface SkinToneSelectorProps {
  visible: boolean;
  emoji: string;
  position: { x: number; y: number };
  onSelectSkinTone: (emoji: string, skinTone: SkinToneId) => void;
  onClose: () => void;
  screenWidth?: number;
  screenHeight?: number;
  testID?: string;
}

export const SkinToneSelector: React.FC<SkinToneSelectorProps> = ({
  visible,
  emoji,
  position,
  onSelectSkinTone,
  onClose,
  screenWidth = 400,
  screenHeight = 800,
  testID,
}) => {
  const theme = useTheme();
  const styles = createStyles(theme);

  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      scaleAnim.setValue(0);
      opacityAnim.setValue(0);

      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 100,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: theme.animations.duration.fast,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 0,
          duration: theme.animations.duration.fast,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: theme.animations.duration.fast,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, scaleAnim, opacityAnim, theme.animations.duration.fast]);

  const handleSelect = (skinTone: SkinToneId) => {
    const modifiedEmoji = applySkintone(emoji, skinTone);
    onSelectSkinTone(modifiedEmoji, skinTone);
    onClose();
  };

  // Calculate position to keep within screen bounds
  const selectorWidth = SKIN_TONES.length * 48 + (SKIN_TONES.length - 1) * 4 + 16;
  const selectorHeight = 60;

  let left = position.x - selectorWidth / 2;
  let top = position.y - selectorHeight - 10;

  // Horizontal bounds
  if (left < 10) left = 10;
  if (left + selectorWidth > screenWidth - 10) left = screenWidth - selectorWidth - 10;

  // Vertical bounds - show below if not enough space above
  if (top < 50) top = position.y + 10;
  if (top + selectorHeight > screenHeight - 50) top = position.y - selectorHeight - 10;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={onClose}
      testID={testID}
    >
      <TouchableOpacity
        style={styles.backdrop}
        onPress={onClose}
        activeOpacity={1}
        accessible={true}
        accessibilityLabel="Close skin tone selector"
        accessibilityRole="button"
      >
        <Animated.View
          style={[
            styles.container,
            {
              left,
              top,
              opacity: opacityAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <View style={styles.skinToneRow}>
            {SKIN_TONES.map((skinTone) => {
              const displayEmoji = applySkintone(emoji, skinTone.id);
              return (
                <TouchableOpacity
                  key={skinTone.id}
                  onPress={() => handleSelect(skinTone.id)}
                  style={styles.skinToneButton}
                  activeOpacity={0.7}
                  accessible={true}
                  accessibilityLabel={`${skinTone.name} skin tone`}
                  accessibilityRole="button"
                  testID={`${testID}-${skinTone.id}`}
                >
                  <Text style={styles.emoji}>{displayEmoji}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
};

const createStyles = (theme: ConferBotTheme) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'transparent',
    },
    container: {
      position: 'absolute',
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.xl,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.sm,
      ...theme.shadows.lg,
    },
    skinToneRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    skinToneButton: {
      width: 44,
      height: 44,
      borderRadius: theme.borderRadius.full,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'transparent',
      marginHorizontal: 2,
    },
    emoji: {
      fontSize: 28,
    },
  });
