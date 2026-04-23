import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { useTheme } from '../../theme';
import type { ConferBotTheme } from '../../theme/types';

export interface AvatarProps {
  // Avatar source
  source?: string | { uri: string };

  // Fallback text (initials)
  name?: string;

  // Size
  size?: number;

  // Shape
  shape?: 'circle' | 'square' | 'rounded';

  // Colors
  backgroundColor?: string;
  textColor?: string;

  // Accessibility
  accessibilityLabel?: string;
  testID?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
  source,
  name,
  size,
  shape = 'circle',
  backgroundColor,
  textColor,
  accessibilityLabel,
  testID,
}) => {
  const theme = useTheme();
  const styles = createStyles(theme);

  // Determine size
  const avatarSize = size || theme.layout.avatarSize;

  // Get initials from name
  const getInitials = (fullName?: string): string => {
    if (!fullName) return '?';

    const names = fullName.trim().split(' ');
    if (names.length === 1) {
      return names[0].charAt(0).toUpperCase();
    }

    return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
  };

  // Determine border radius based on shape
  const getBorderRadius = (): number => {
    switch (shape) {
      case 'circle':
        return avatarSize / 2;
      case 'square':
        return 0;
      case 'rounded':
        return theme.borderRadius.md;
      default:
        return avatarSize / 2;
    }
  };

  // Generate background color from name
  const getBackgroundColor = (fullName?: string): string => {
    if (backgroundColor) return backgroundColor;

    if (!fullName) return theme.colors.textSecondary;

    // Simple hash function to generate consistent color
    let hash = 0;
    for (let i = 0; i < fullName.length; i++) {
      hash = fullName.charCodeAt(i) + ((hash << 5) - hash);
    }

    const colors = [
      theme.colors.primary,
      theme.colors.secondary,
      '#FF6B6B',
      '#4ECDC4',
      '#45B7D1',
      '#FFA07A',
      '#98D8C8',
      '#6C5CE7',
    ];

    return colors[Math.abs(hash) % colors.length];
  };

  const hasImageSource = source && (typeof source === 'string' ? source.length > 0 : source.uri.length > 0);

  const containerStyle = {
    width: avatarSize,
    height: avatarSize,
    borderRadius: getBorderRadius(),
    backgroundColor: hasImageSource ? 'transparent' : 'transparent',
  };

  return (
    <View
      style={[styles.container, containerStyle]}
      accessible={true}
      accessibilityLabel={accessibilityLabel || `Avatar for ${name || 'user'}`}
      accessibilityRole="image"
      testID={testID}
    >
      {hasImageSource ? (
        <Image
          source={typeof source === 'string' ? { uri: source } : source}
          style={[styles.image, containerStyle]}
          resizeMode="cover"
        />
      ) : (
        <Text
          style={[
            styles.initials,
            {
              fontSize: avatarSize * 0.4,
              color: textColor || theme.colors.textInverse,
            },
          ]}
        >
          {getInitials(name)}
        </Text>
      )}
    </View>
  );
};

const createStyles = (_theme: ConferBotTheme) =>
  StyleSheet.create({
    container: {
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
    },
    image: {
      width: '100%',
      height: '100%',
    },
    initials: {
      fontWeight: '600',
      textAlign: 'center',
    },
  });
