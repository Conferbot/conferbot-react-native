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
    // The visitor's bubble: light grey with dark text by default; an owner's
    // bubble colour with no text colour gets white text, as on the web.
    set('userBubble', c.userMsgColor || '#f0f0f0');
    set('userBubbleText', c.userTextColor || (c.userMsgColor ? '#ffffff' : '#000000'));
    // Choices: the option colours, else the bot's (as the web chains them).
    set('optionBubble', c.optionBubbleMsgColor || c.botMsgColor);
    set('optionBubbleText', c.optionBubbleTextColor || c.botTextColor);
    set('background', c.chatBgColor);

    // 14 is the unset default: AI and visitor bubbles are 14.5 on the web.
    const size = parseFloat(c.fontSize);
    override.typography = { fontSize: { md: Number.isFinite(size) && size !== 14 ? size : 14.5 } };

    // Choice buttons: the owner's radius (10, the server's default, is the web's 10 too).
    const optionRadius = parseFloat(c.optionBubbleBorderRadius);
    override.borderRadius = { button: Number.isFinite(optionRadius) ? optionRadius : 10 };

    return Object.keys(override.colors).length > 0 ? override : null;
  }, [serverCustomizations]);

  return { serverThemeOverride };
}
