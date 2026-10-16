/**
 * The chat's font (core/ownerFont.ts): the owner's font, else the theme's,
 * loaded at run time with expo-font when the app has it
 * (utils/fontLoader.ts), else the platform font.
 *
 *   useChatFontLoader(customizations, widgetTheme)  in the provider: picks
 *       and loads the fonts, returns the ChatFont the context hands out
 *   useChatFont()  in a component: `font.body(600)` / `font.display(700)`
 *       is a `{ fontFamily }` style for that weight, or null (no font set,
 *       or not loaded yet: the platform font draws it)
 */
import { useContext, useEffect, useMemo, useState } from 'react';
import { chatFontsFor, fontFamilyFor, type FontPick } from '../core/ownerFont';
import { loadChatFont } from '../utils/fontLoader';
import ConferBotContext from '../context/ConferBotContext';

export type FontStyle = { fontFamily: string } | null;

export interface ChatFont {
  body: (weight?: number) => FontStyle;
  display: (weight?: number) => FontStyle;
}

const style = (family: string | null): FontStyle => (family ? { fontFamily: family } : null);

export const NO_CHAT_FONT: ChatFont = { body: () => null, display: () => null };

const useLoaded = (pick: FontPick | null): number[] => {
  const [weights, setWeights] = useState<number[]>([]);
  const key = pick ? `${pick.family}|${pick.google || ''}` : '';
  useEffect(() => {
    let live = true;
    setWeights([]);
    if (pick?.google) {
      loadChatFont(pick).then((w) => {
        if (live) setWeights(w);
      });
    }
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return weights;
};

export function useChatFontLoader(customizations: any, widgetTheme: any): ChatFont {
  const fonts = useMemo(
    () => chatFontsFor(customizations?.font, widgetTheme ? { font: widgetTheme.font, fontRole: widgetTheme.fontRole } : null),
    [customizations?.font, widgetTheme?.font, widgetTheme?.fontRole]
  );
  const bodyLoaded = useLoaded(fonts.body);
  const displayLoaded = useLoaded(fonts.display);
  return useMemo(
    () => ({
      body: (weight?: number) => style(fontFamilyFor(fonts.body, bodyLoaded, weight)),
      display: (weight?: number) => style(fontFamilyFor(fonts.display, displayLoaded, weight)),
    }),
    [fonts, bodyLoaded, displayLoaded]
  );
}

/** The chat's font for a component under the provider (none outside it). */
export function useChatFont(): ChatFont {
  const ctx: any = useContext(ConferBotContext);
  return ctx?.chatFont || NO_CHAT_FONT;
}
