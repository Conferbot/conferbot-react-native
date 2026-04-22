import type { ConferBotTheme } from './types';

// Default light theme matching Android SDK's LightTheme
export const defaultTheme: ConferBotTheme = {
  mode: 'light',

  colors: {
    // Primary brand color (Android: #0100EC)
    primary: '#0100EC',
    primaryLight: '#5A5AFF',
    primaryDark: '#0000B3',

    // Secondary colors
    secondary: '#6750A4',
    secondaryLight: '#9A82DB',
    secondaryDark: '#3C2A6E',

    // Background colors
    background: '#FFFBFF',
    surface: '#FFFBFF',
    overlay: 'rgba(0, 0, 0, 0.5)',

    // Message bubble colors (Android palette)
    userBubble: '#0100EC',
    userBubbleText: '#FFFFFF',
    botBubble: '#F5F5F5',
    botBubbleText: '#1C1B1F',
    agentBubble: '#E8F5E9',
    agentBubbleText: '#1B5E20',
    systemBubble: '#F5F5F5',
    systemBubbleText: '#6B6B6B',

    // Status colors
    success: '#4CAF50',
    warning: '#FF9500',
    error: '#B3261E',
    info: '#0100EC',

    // Text colors
    text: '#1C1B1F',
    textSecondary: '#49454F',
    textDisabled: '#C7C7CC',
    textInverse: '#FFFFFF',

    // Border colors
    border: '#E0E0E0',
    borderLight: '#E0E0E0',
    divider: '#E0E0E0',

    // Header (Android: primary + white)
    headerBg: '#0100EC',
    headerText: '#FFFFFF',

    // Choice buttons
    optionBubble: '#F5F5F5',
    optionBubbleText: '#1C1B1F',

    // Special colors
    link: '#0100EC',
    typing: '#9E9E9E',
    online: '#4CAF50',
    offline: '#9E9E9E',
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
      normal: 1.4,
      relaxed: 1.75,
    },
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 48,
    bubblePaddingH: 14,
    bubblePaddingV: 10,
    messageSpacing: 10,
    chatContentPadding: 14,
  },

  borderRadius: {
    none: 0,
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    full: 9999,
    bubble: 16,
    bubbleSmall: 4,
    button: 12,
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
    headerHeight: 56,
    inputHeight: 48,
    maxBubbleWidth: '75%',
    avatarSize: 32,
    iconSize: 24,
  },
};
