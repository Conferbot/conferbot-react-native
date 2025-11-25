import type { ConferBotTheme } from './types';

// Default light theme for Conferbot React Native SDK
export const defaultTheme: ConferBotTheme = {
  mode: 'light',

  colors: {
    // Primary brand colors (iOS blue)
    primary: '#007AFF',
    primaryLight: '#5AC8FA',
    primaryDark: '#0051D5',

    // Secondary colors
    secondary: '#5856D6',
    secondaryLight: '#7B79F1',
    secondaryDark: '#3C3B9E',

    // Background colors
    background: '#F2F2F7',
    surface: '#FFFFFF',
    overlay: 'rgba(0, 0, 0, 0.5)',

    // Message bubble colors
    userBubble: '#007AFF',
    userBubbleText: '#FFFFFF',
    botBubble: '#E9E9EB',
    botBubbleText: '#000000',
    agentBubble: '#34C759',
    agentBubbleText: '#FFFFFF',
    systemBubble: '#F2F2F7',
    systemBubbleText: '#8E8E93',

    // Status colors
    success: '#34C759',
    warning: '#FF9500',
    error: '#FF3B30',
    info: '#5AC8FA',

    // Text colors
    text: '#000000',
    textSecondary: '#8E8E93',
    textDisabled: '#C7C7CC',
    textInverse: '#FFFFFF',

    // Border colors
    border: '#C6C6C8',
    borderLight: '#E5E5EA',
    divider: '#E5E5EA',

    // Special colors
    link: '#007AFF',
    typing: '#8E8E93',
    online: '#34C759',
    offline: '#8E8E93',
  },

  typography: {
    fontFamily: 'System',
    fontFamilyBold: 'System',
    fontFamilyMedium: 'System',

    fontSize: {
      xs: 11,
      sm: 13,
      md: 15,
      lg: 17,
      xl: 20,
      xxl: 24,
    },

    fontWeight: {
      light: '300',
      regular: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
    },

    lineHeight: {
      tight: 1.2,
      normal: 1.5,
      relaxed: 1.75,
    },
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },

  borderRadius: {
    none: 0,
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    full: 9999,
  },

  shadows: {
    none: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.18,
      shadowRadius: 1.0,
      elevation: 1,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.23,
      shadowRadius: 2.62,
      elevation: 4,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.30,
      shadowRadius: 4.65,
      elevation: 8,
    },
    xl: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.37,
      shadowRadius: 7.49,
      elevation: 12,
    },
  },

  animations: {
    duration: {
      fast: 150,
      normal: 300,
      slow: 500,
    },
    easing: {
      ease: 'ease',
      easeIn: 'ease-in',
      easeOut: 'ease-out',
      easeInOut: 'ease-in-out',
    },
  },

  layout: {
    headerHeight: 60,
    inputHeight: 56,
    maxBubbleWidth: '75%',
    avatarSize: 32,
    iconSize: 24,
  },
};
