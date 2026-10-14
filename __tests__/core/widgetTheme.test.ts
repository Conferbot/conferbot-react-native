import {
  WIDGET_THEMES,
  normalizeTheme,
  normalizeAppearance,
  normalizeThemeColors,
  resolveScheme,
  resolveWidgetTheme,
  withThemePalette,
  ownsChatBackground,
  parseColor,
} from '../../src/core/widgetTheme';
import { resolveCustomizations } from '../../src/core/customizations';

const HEX = /^#[0-9a-f]{6}$/;

describe('widget theme as the web widget applies it', () => {
  it('knows the 27 web themes, classic first', () => {
    expect(WIDGET_THEMES).toHaveLength(27);
    expect(WIDGET_THEMES[0]).toBe('classic');
    expect(WIDGET_THEMES).toEqual(expect.arrayContaining(['minimal', 'glass', 'neobrutal', 'midnight', 'space']));
  });

  it('falls back to classic / light / brand for unknown values', () => {
    expect(normalizeTheme('NOPE')).toBe('classic');
    expect(normalizeTheme(' Minimal ')).toBe('minimal');
    expect(normalizeAppearance('purple')).toBe('light');
    expect(normalizeAppearance('AUTO')).toBe('auto');
    expect(normalizeThemeColors('theme')).toBe('theme');
    expect(normalizeThemeColors(undefined)).toBe('brand');
  });

  it('resolves the scheme: always-dark themes, dark, and auto from the phone', () => {
    expect(resolveScheme('midnight', 'light', false)).toBe('dark');
    expect(resolveScheme('classic', 'dark', false)).toBe('dark');
    expect(resolveScheme('classic', 'auto', true)).toBe('dark');
    expect(resolveScheme('classic', 'auto', false)).toBe('light');
    expect(resolveScheme('minimal', 'light', true)).toBe('light');
  });

  it('changes nothing for classic in light', () => {
    const t = resolveWidgetTheme({}, false);
    expect(t.id).toBe('classic');
    expect(t.tokens).toBeNull();
    expect(t.shape).toBeNull();
  });

  it('repaints only the surfaces for classic in dark', () => {
    const t = resolveWidgetTheme({ themeAppearance: 'dark' }, false);
    expect(t.tokens?.bg).toBe('#14161c');
    expect(t.tokens?.ink).toBe('#f1f3f7');
    expect(t.shape).toBeNull();
  });

  it('gives every theme and scheme concrete six-digit colours', () => {
    for (const id of WIDGET_THEMES) {
      for (const appearance of ['light', 'dark']) {
        const t = resolveWidgetTheme({ widgetTheme: id, themeAppearance: appearance, headerBgColor: '#0F766E' }, false);
        if (!t.tokens) continue;
        for (const [k, v] of Object.entries(t.tokens)) expect(`${id}.${appearance}.${k}=${v}`).toMatch(/=#[0-9a-f]{6}$/);
      }
    }
  });

  it('brings the theme shape: minimal radii, neo-brutal outline', () => {
    const minimal = resolveWidgetTheme({ widgetTheme: 'minimal' }, false);
    expect(minimal.shape).toMatchObject({ rBubble: 14, rTail: 14, rCtl: 10, rField: 12 });
    expect(minimal.font).toBe('Inter');
    const brutal = resolveWidgetTheme({ widgetTheme: 'neobrutal' }, false);
    expect(brutal.shape?.bubbleBorder).toEqual({ width: 2, color: '#000000' });
  });

  it('tints brand-mixed surfaces with the bot colour (clay)', () => {
    const red = resolveWidgetTheme({ widgetTheme: 'clay', headerBgColor: '#ff0000' }, false).tokens!.bg;
    const blue = resolveWidgetTheme({ widgetTheme: 'clay', headerBgColor: '#0000ff' }, false).tokens!.bg;
    expect(red).toMatch(HEX);
    expect(red).not.toBe(blue);
  });

  it('makes glass opaque: an app has no page behind it', () => {
    expect(resolveWidgetTheme({ widgetTheme: 'glass' }, false).tokens!.bg).toBe('#fafbfd');
  });

  it('swaps in the theme palette only for themeColors "theme"', () => {
    const owner = { widgetTheme: 'minimal', headerBgColor: '#0F766E', chatBgType: 'pattern', logo: 'x' };
    expect(withThemePalette(owner, false)).toBe(owner);
    const p = withThemePalette({ ...owner, themeColors: 'theme' }, false)!;
    expect(p.headerBgColor).toBe('#09090b');
    expect(p.userMsgColor).toBe('#2563eb');
    expect(p.chatBgType).toBe('solid');
    expect(p.chatBgColor).toBe('#ffffff');
    expect(p.logo).toBe('x');
    const dark = withThemePalette({ ...owner, themeColors: 'theme', themeAppearance: 'dark' }, false)!;
    expect(dark.headerBgColor).toBe('#18181b');
    expect(withThemePalette({ themeColors: 'theme' }, false)).toEqual({ themeColors: 'theme' });
  });

  it('treats only a plain white solid as the default chat background', () => {
    expect(ownsChatBackground({})).toBe(false);
    expect(ownsChatBackground({ chatBgColor: '#ffffff' })).toBe(false);
    expect(ownsChatBackground({ chatBgColor: '#f8fafc' })).toBe(true);
    expect(ownsChatBackground({ chatBgType: 'gradient' })).toBe(true);
  });

  it('parses hex, short hex, rgba', () => {
    expect(parseColor('#abc')).toEqual([170, 187, 204, 1]);
    expect(parseColor('rgba(1, 2, 3, 0.5)')).toEqual([1, 2, 3, 0.5]);
    expect(parseColor('nope')).toBeNull();
  });
});

describe('customizations under a theme', () => {
  it('takes the theme radii unless the owner set their own', () => {
    const theme = resolveWidgetTheme({ widgetTheme: 'minimal' }, false);
    const c = resolveCustomizations({ bubbleBorderRadius: 10, optionBubbleBorderRadius: 10 }, '', theme);
    expect(c.botBubble).toEqual({ topLeft: 14, topRight: 14, bottomRight: 14, bottomLeft: 14 });
    expect(c.optionRadius).toBe(10);
    expect(c.fieldRadius).toBe(12);
    const own = resolveCustomizations({ bubbleBorderRadius: 4, optionBubbleBorderRadius: 20 }, '', theme);
    expect(own.botBubble.bottomLeft).toBe(4);
    expect(own.optionRadius).toBe(20);
  });

  it('keeps the classic look and the owner radius 10 without a theme', () => {
    const c = resolveCustomizations({ optionBubbleBorderRadius: 10 });
    expect(c.botBubble.bottomLeft).toBe(6);
    expect(c.optionRadius).toBe(10);
    expect(c.fieldRadius).toBe(25);
    expect(c.surface).toBeNull();
    expect(c.bubbleBorder).toBeNull();
  });

  it('paints the theme surface unless the owner has a background', () => {
    const theme = resolveWidgetTheme({ widgetTheme: 'midnight' }, false);
    expect(resolveCustomizations({}, '', theme).surface).toBe(theme.tokens!.bg);
    expect(resolveCustomizations({ chatBgType: 'gradient' }, '', theme).surface).toBeNull();
  });

  it('uses the palette accent for the send button', () => {
    const raw = withThemePalette({ widgetTheme: 'aurora', themeColors: 'theme' }, false);
    expect(resolveCustomizations(raw).accent).toBe('#6d28d9');
  });
});

describe('send button ink', () => {
  it('takes the palette ink on the accent, none for the owner colours', () => {
    expect(resolveCustomizations(withThemePalette({ widgetTheme: 'aurora', themeColors: 'theme', themeAppearance: 'dark' }, false)).accentInk).toBe('#0c0d18');
    expect(resolveCustomizations({ headerBgColor: '#0F766E' }).accentInk).toBeNull();
  });
});
