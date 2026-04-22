import type { ConferBotTheme } from './types';
import { defaultTheme } from './defaultTheme';

// Default dark theme for Conferbot React Native SDK
export const darkTheme: ConferBotTheme = {
  ...defaultTheme,
  mode: 'dark',

  colors: {
    // Primary brand colors
    primary: '#0A84FF',
    primaryLight: '#64D2FF',
    primaryDark: '#0051D5',

    // Secondary colors
    secondary: '#5E5CE6',
    secondaryLight: '#7D7AFF',
    secondaryDark: '#3C3B9E',

    // Background colors
    background: '#000000',
    surface: '#1C1C1E',
    overlay: 'rgba(0, 0, 0, 0.7)',

    // Message bubble colors
    userBubble: '#0A84FF',
    userBubbleText: '#FFFFFF',
    botBubble: '#2C2C2E',
    botBubbleText: '#FFFFFF',
    agentBubble: '#30D158',
    agentBubbleText: '#FFFFFF',
    systemBubble: '#1C1C1E',
    systemBubbleText: '#98989D',

    // Status colors
    success: '#30D158',
    warning: '#FF9F0A',
    error: '#FF453A',
    info: '#64D2FF',

    // Text colors
    text: '#FFFFFF',
    textSecondary: '#98989D',
    textDisabled: '#48484A',
    textInverse: '#000000',

    // Border colors
    border: '#38383A',
    borderLight: '#2C2C2E',
    divider: '#38383A',

    // Header
    headerBg: '#0A84FF',
    headerText: '#FFFFFF',

    // Choice buttons
    optionBubble: '#2C2C2E',
    optionBubbleText: '#FFFFFF',

    // Special colors
    link: '#0A84FF',
    typing: '#98989D',
    online: '#30D158',
    offline: '#98989D',
  },
};
