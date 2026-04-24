// @ts-nocheck
import { useMemo } from 'react';

export function useThemeOverride(serverCustomizations: Record<string, any> | null) {
  const serverThemeOverride = useMemo(() => {
    if (!serverCustomizations) return null;
    const c = serverCustomizations;
    const override: Record<string, any> = { colors: {} };

    if (c.headerBgColor) override.colors.headerBg = c.headerBgColor;
    if (c.headerTextColor) override.colors.headerText = c.headerTextColor;
    if (c.botMsgColor) {
      override.colors.botBubble = c.botMsgColor;
      override.colors.primary = c.botMsgColor;
      override.colors.primaryLight = c.botMsgColor + '33';
    }
    if (c.botTextColor) override.colors.botBubbleText = c.botTextColor;
    if (c.userMsgColor) override.colors.userBubble = c.userMsgColor;
    if (c.userTextColor) override.colors.userBubbleText = c.userTextColor;
    if (c.optionBubbleMsgColor) override.colors.optionBubble = c.optionBubbleMsgColor;
    if (c.optionBubbleTextColor) override.colors.optionBubbleText = c.optionBubbleTextColor;
    if (c.chatBgColor) override.colors.background = c.chatBgColor;

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
