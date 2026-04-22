// Theme type definitions for Conferbot React Native SDK

export interface ConferBotTheme {
  mode: 'light' | 'dark';

  colors: {
    // Primary brand colors
    primary: string;
    primaryLight: string;
    primaryDark: string;

    // Secondary colors
    secondary: string;
    secondaryLight: string;
    secondaryDark: string;

    // Background colors
    background: string;
    surface: string;
    overlay: string;

    // Message bubble colors
    userBubble: string;
    userBubbleText: string;
    botBubble: string;
    botBubbleText: string;
    agentBubble: string;
    agentBubbleText: string;
    systemBubble: string;
    systemBubbleText: string;

    // Status colors
    success: string;
    warning: string;
    error: string;
    info: string;

    // Text colors
    text: string;
    textSecondary: string;
    textDisabled: string;
    textInverse: string;

    // Border colors
    border: string;
    borderLight: string;
    divider: string;

    // Header colors
    headerBg: string;
    headerText: string;

    // Choice/option button colors
    optionBubble: string;
    optionBubbleText: string;

    // Special colors
    link: string;
    typing: string;
    online: string;
    offline: string;
  };

  typography: {
    fontFamily: string;
    fontFamilyBold: string;
    fontFamilyMedium: string;

    fontSize: {
      xs: number;
      sm: number;
      md: number;
      lg: number;
      xl: number;
      xxl: number;
    };

    fontWeight: {
      light: '300';
      regular: '400';
      medium: '500';
      semibold: '600';
      bold: '700';
    };

    lineHeight: {
      tight: number;
      normal: number;
      relaxed: number;
    };
  };

  spacing: {
    xs: number;    // 4
    sm: number;    // 8
    md: number;    // 12
    lg: number;    // 16
    xl: number;    // 24
    xxl: number;   // 48
    bubblePaddingH: number;   // 14
    bubblePaddingV: number;   // 10
    messageSpacing: number;   // 10
    chatContentPadding: number; // 14
  };

  borderRadius: {
    none: number;    // 0
    sm: number;      // 4
    md: number;      // 8
    lg: number;      // 12
    xl: number;      // 16
    full: number;    // 9999
    bubble: number;       // 16
    bubbleSmall: number;  // 4
    button: number;       // 12
  };

  shadows: {
    none: {
      shadowColor: string;
      shadowOffset: { width: number; height: number };
      shadowOpacity: number;
      shadowRadius: number;
      elevation: number;
    };
    sm: {
      shadowColor: string;
      shadowOffset: { width: number; height: number };
      shadowOpacity: number;
      shadowRadius: number;
      elevation: number;
    };
    md: {
      shadowColor: string;
      shadowOffset: { width: number; height: number };
      shadowOpacity: number;
      shadowRadius: number;
      elevation: number;
    };
    lg: {
      shadowColor: string;
      shadowOffset: { width: number; height: number };
      shadowOpacity: number;
      shadowRadius: number;
      elevation: number;
    };
    xl: {
      shadowColor: string;
      shadowOffset: { width: number; height: number };
      shadowOpacity: number;
      shadowRadius: number;
      elevation: number;
    };
  };

  animations: {
    duration: {
      fast: number;     // 150ms
      normal: number;   // 300ms
      slow: number;     // 500ms
    };
    easing: {
      ease: string;
      easeIn: string;
      easeOut: string;
      easeInOut: string;
    };
  };

  layout: {
    headerHeight: number;
    inputHeight: number;
    maxBubbleWidth: string;
    avatarSize: number;
    iconSize: number;
  };
}

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type ConferBotThemeOverride = DeepPartial<ConferBotTheme>;
