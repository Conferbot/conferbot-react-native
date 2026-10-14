// @ts-nocheck
import { useMemo } from 'react';
import { toHex6, mix } from '../../theme/color';

export function useThemeOverride(serverCustomizations: Record<string, any> | null) {
  const serverThemeOverride = useMemo(() => {
    if (!serverCustomizations) return null;
    const c = serverCustomizations;
    const override: Record<string, any> = { colors: {} };

    // Six-digit hex only: components append an alpha (theme/color.ts).
    const col = (v: unknown) => toHex6(v);
    const set = (key: string, v: unknown) => {
      const hex = col(v);
      if (hex) override.colors[key] = hex;
    };

    set('headerBg', c.headerBgColor);
    set('headerText', c.headerTextColor);
    const bot = col(c.botMsgColor);
    if (bot) {
      override.colors.botBubble = bot;
      // An agent - person or AI - speaks in the bot's colours, as on the web.
      override.colors.agentBubble = bot;
      override.colors.primary = bot;
      override.colors.primaryLight = mix(bot, '#ffffff', 0.8);
    }
    const botText = col(c.botTextColor);
    if (botText) {
      override.colors.botBubbleText = botText;
      override.colors.agentBubbleText = botText;
    }
    set('userBubble', c.userMsgColor);
    set('userBubbleText', c.userTextColor);
    set('optionBubble', c.optionBubbleMsgColor);
    set('optionBubbleText', c.optionBubbleTextColor);
    set('background', c.chatBgColor);

    // Font size
    if (c.fontSize) {
      const size = parseInt(c.fontSize, 10);
      if (!isNaN(size)) {
        override.typography = { fontSize: { md: size } };
      }
    }

    return Object.keys(override.colors).length > 0 ? override : null;
  }, [serverCustomizations]);

  return { serverThemeOverride };
}
