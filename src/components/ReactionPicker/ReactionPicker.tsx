// @ts-nocheck
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Modal,
  Pressable,
  Dimensions,
} from 'react-native';
import { useTheme } from '../../theme';
import type { ConferBotTheme } from '../../theme/types';
import { REACTION_EMOJIS, type ReactionEmoji } from '../../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * ReactionPicker Props
 *
 * @interface ReactionPickerProps
 * @property {boolean} visible - Whether the picker is visible
 * @property {(emoji: ReactionEmoji) => void} onSelectReaction - Callback when reaction is selected
 * @property {() => void} onClose - Callback when picker is closed
 * @property {{ x: number; y: number }} [anchorPosition] - Position to anchor the picker
 * @property {ReactionEmoji[]} [selectedReactions] - Currently selected reactions by user
 * @property {string} [testID] - Test identifier
 *
 * @example
 * ```tsx
 * <ReactionPicker
 *   visible={showPicker}
 *   onSelectReaction={(emoji) => handleReaction(emoji)}
 *   onClose={() => setShowPicker(false)}
 *   anchorPosition={{ x: 100, y: 200 }}
 *   selectedReactions={['thumbsUp']}
 * />
 * ```
 */
export interface ReactionPickerProps {
  visible: boolean;
  onSelectReaction: (emoji: ReactionEmoji) => void;
  onClose: () => void;
  anchorPosition?: { x: number; y: number };
  selectedReactions?: ReactionEmoji[];
  testID?: string;
}

/**
 * ReactionPicker Component
 *
 * An animated emoji reaction selector that appears on long-press of messages.
 * Features a keyboard-style layout with common reactions.
 *
 * Features:
 * - Animated entrance/exit with spring animation
 * - Keyboard-style grid layout
 * - Visual feedback for selected reactions
 * - Backdrop press to close
 * - Accessibility support
 *
 * @component
 */
export const ReactionPicker: React.FC<ReactionPickerProps> = ({
  visible,
  onSelectReaction,
  onClose,
  anchorPosition,
  selectedReactions = [],
  testID,
}) => {
  const theme = useTheme();
  const styles = createStyles(theme);

  // Animation values
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const emojiAnims = useRef(
    REACTION_EMOJIS.map(() => new Animated.Value(0))
  ).current;

  // Animate entrance when visible
  useEffect(() => {
    if (visible) {
      // Reset animations
      scaleAnim.setValue(0);
      opacityAnim.setValue(0);
      emojiAnims.forEach((anim) => anim.setValue(0));

      // Container entrance animation
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

      // Staggered emoji entrance
      const staggeredAnimations = emojiAnims.map((anim, index) =>
        Animated.spring(anim, {
          toValue: 1,
          friction: 6,
          tension: 120,
          delay: index * 30,
          useNativeDriver: true,
        })
      );
      Animated.stagger(30, staggeredAnimations).start();
    } else {
      // Exit animation
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
  }, [visible, scaleAnim, opacityAnim, emojiAnims, theme.animations.duration.fast]);

  // Handle reaction selection
  const handleReactionPress = (emoji: ReactionEmoji) => {
    // Add haptic feedback animation
    const index = REACTION_EMOJIS.indexOf(emoji);
    if (index !== -1) {
      Animated.sequence([
        Animated.timing(emojiAnims[index], {
          toValue: 1.3,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.spring(emojiAnims[index], {
          toValue: 1,
          friction: 3,
          tension: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        onSelectReaction(emoji);
        onClose();
      });
    } else {
      onSelectReaction(emoji);
      onClose();
    }
  };

  // Check if reaction is selected
  const isSelected = (emoji: ReactionEmoji) => selectedReactions.includes(emoji);

  // Calculate picker position
  const getPickerPosition = () => {
    if (!anchorPosition) {
      return {
        top: '50%',
        left: '50%',
        transform: [
          { translateX: -((REACTION_EMOJIS.length * 48 + (REACTION_EMOJIS.length - 1) * 8 + 24) / 2) },
          { translateY: -30 },
        ],
      };
    }

    const pickerWidth = REACTION_EMOJIS.length * 48 + (REACTION_EMOJIS.length - 1) * 8 + 24;
    const pickerHeight = 60;

    // Ensure picker stays within screen bounds
    let left = anchorPosition.x - pickerWidth / 2;
    let top = anchorPosition.y - pickerHeight - 10;

    if (left < 10) left = 10;
    if (left + pickerWidth > SCREEN_WIDTH - 10) left = SCREEN_WIDTH - pickerWidth - 10;
    if (top < 10) top = anchorPosition.y + 10; // Show below if not enough space above

    return { top, left };
  };

  const pickerPosition = getPickerPosition();

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={onClose}
      testID={testID}
    >
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessible={true}
        accessibilityLabel="Close reaction picker"
        accessibilityRole="button"
      >
        <Animated.View
          style={[
            styles.container,
            pickerPosition,
            {
              opacity: opacityAnim,
              transform: [
                { scale: scaleAnim },
                ...(Array.isArray(pickerPosition.transform) ? pickerPosition.transform : []),
              ],
            },
          ]}
        >
          <View style={styles.emojiRow}>
            {REACTION_EMOJIS.map((emoji, index) => {
              const selected = isSelected(emoji);
              return (
                <Animated.View
                  key={emoji}
                  style={{
                    transform: [{ scale: emojiAnims[index] }],
                  }}
                >
                  <TouchableOpacity
                    onPress={() => handleReactionPress(emoji)}
                    style={[
                      styles.emojiButton,
                      selected && styles.emojiButtonSelected,
                    ]}
                    activeOpacity={0.7}
                    accessible={true}
                    accessibilityLabel={`React with ${emoji}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    testID={`${testID}-emoji-${emoji}`}
                  >
                    <Text style={styles.emoji}>{emoji}</Text>
                    {selected && <View style={styles.selectedIndicator} />}
                  </TouchableOpacity>
                </Animated.View>
              );
            })}
          </View>
        </Animated.View>
      </Pressable>
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
    emojiRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    emojiButton: {
      width: 44,
      height: 44,
      borderRadius: theme.borderRadius.full,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'transparent',
    },
    emojiButtonSelected: {
      backgroundColor: theme.colors.primaryLight + '30',
    },
    emoji: {
      fontSize: 28,
    },
    selectedIndicator: {
      position: 'absolute',
      bottom: 2,
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.colors.primary,
    },
  });
