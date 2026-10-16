/**
 * The owner's font and the theme's (web ts/fonts/ownerFont.ts,
 * ts/theme/themeTokens.ts, ts/theme/applyTheme.ts loadThemeFont).
 */
import fs from 'fs';
import path from 'path';
import {
  FONT_CATALOG,
  chatFontsFor,
  faceName,
  findCatalogFont,
  firstFamily,
  fontFamilyFor,
  googleFontUrl,
  isDefaultFont,
  parseFontFaces,
  weightOf,
} from '../../src/core/ownerFont';
import { THEME_FONT_QUERIES } from '../../src/core/fonts.data';

const GOOGLE_TTF = `
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url(https://fonts.gstatic.com/s/inter/v20/a.ttf) format('truetype');
}
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url(https://fonts.gstatic.com/s/inter/v20/b.ttf) format('truetype');
}
@font-face {
  font-family: 'Inter';
  font-style: italic;
  font-weight: 400;
  src: url(https://fonts.gstatic.com/s/inter/v20/c.ttf) format('truetype');
}
@font-face {
  font-family: 'Inter';
  font-weight: 400;
  src: url(https://fonts.gstatic.com/s/inter/v20/d.woff2) format('woff2');
}`;

describe('owner font', () => {
  it('knows the defaults that mean no font was picked', () => {
    expect(isDefaultFont('')).toBe(true);
    expect(isDefaultFont('Arial')).toBe(true);
    expect(isDefaultFont('Gill Sans, sans-serif;')).toBe(true);
    expect(isDefaultFont(undefined)).toBe(true);
    expect(isDefaultFont('Inter')).toBe(false);
  });

  it('finds a catalog font by family, stack, id or our prefixed name', () => {
    expect(findCatalogFont('Inter')?.id).toBe('inter');
    expect(findCatalogFont("'Plus Jakarta Sans', sans-serif")?.id).toBe('plus-jakarta-sans');
    expect(findCatalogFont('dm-sans')?.family).toBe('DM Sans');
    expect(findCatalogFont('CB Font Poppins')?.id).toBe('poppins');
    expect(findCatalogFont('Charlesworth')).toBeNull();
    expect(firstFamily('"Gill Sans", serif')).toBe('Gill Sans');
  });

  it('reads Google Fonts\' TrueType faces, skipping italics only by style and woff2 entirely', () => {
    expect(parseFontFaces(GOOGLE_TTF)).toEqual([
      { weight: 400, style: 'normal', url: 'https://fonts.gstatic.com/s/inter/v20/a.ttf' },
      { weight: 700, style: 'normal', url: 'https://fonts.gstatic.com/s/inter/v20/b.ttf' },
      { weight: 400, style: 'italic', url: 'https://fonts.gstatic.com/s/inter/v20/c.ttf' },
    ]);
    expect(parseFontFaces('')).toEqual([]);
    expect(googleFontUrl('Inter:wght@400;700')).toBe('https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap');
  });

  it('names faces so the app\'s own text never picks them up', () => {
    expect(faceName('Inter', 400)).toBe('CB Font Inter');
    expect(faceName('Inter', 700)).toBe('CB Font Inter 700');
  });

  it('puts the owner\'s font over the theme\'s, everywhere', () => {
    const inter = { family: 'Inter', google: 'Inter:wght@400;500;600;700' };
    expect(chatFontsFor('Inter', { font: 'Fraunces', fontRole: 'display' })).toEqual({ body: inter, display: inter });
    // A system font is used by name; system-ui is the platform's own.
    expect(chatFontsFor('Georgia', null)).toEqual({ body: { family: 'Georgia', google: null }, display: { family: 'Georgia', google: null } });
    expect(chatFontsFor('system-ui', null)).toEqual({ body: null, display: null });
    // An older bot's unknown font stays a plain family name.
    expect(chatFontsFor('Charlesworth', null).body).toEqual({ family: 'Charlesworth', google: null });
  });

  it('uses a body theme font for all text, a display one for headings only', () => {
    expect(chatFontsFor('Arial', { font: 'Manrope', fontRole: 'body' })).toEqual({
      body: { family: 'Manrope', google: 'Manrope:wght@400;500;600;700' },
      display: { family: 'Manrope', google: 'Manrope:wght@400;500;600;700' },
    });
    expect(chatFontsFor('', { font: 'Fraunces', fontRole: 'display' })).toEqual({
      body: null,
      display: { family: 'Fraunces', google: THEME_FONT_QUERIES.Fraunces },
    });
    expect(chatFontsFor('', { font: null, fontRole: null })).toEqual({ body: null, display: null });
  });

  it('draws each weight with the nearest face it has, nothing until one is loaded', () => {
    const pick = { family: 'Inter', google: 'Inter' };
    expect(fontFamilyFor(pick, [], 400)).toBeNull();
    expect(fontFamilyFor(pick, [400, 700], 400)).toBe('CB Font Inter');
    expect(fontFamilyFor(pick, [400, 700], 600)).toBe('CB Font Inter 700');
    expect(fontFamilyFor(pick, [400, 600], 500)).toBe('CB Font Inter');
    expect(fontFamilyFor(pick, [500], 400)).toBe('CB Font Inter 500');
    expect(fontFamilyFor({ family: 'Georgia', google: null }, null, 700)).toBe('Georgia');
    expect(fontFamilyFor(null, [400], 400)).toBeNull();
    expect(weightOf('bold')).toBe(700);
    expect(weightOf('600')).toBe(600);
    expect(weightOf(undefined)).toBe(400);
  });

  it('carries the widget\'s catalog and theme fonts unchanged', () => {
    const web = path.resolve(__dirname, '../../../../conferbot-widget/src/ts');
    if (!fs.existsSync(path.join(web, 'fonts/catalog.ts'))) return; // the widget is not checked out beside the SDK
    const cat = fs.readFileSync(path.join(web, 'fonts/catalog.ts'), 'utf8');
    const block = JSON.parse(cat.split('/* FONTS:BEGIN */')[1].split('/* FONTS:END */')[0]);
    expect(FONT_CATALOG).toEqual(block.fonts);
    const reg = fs.readFileSync(path.join(web, 'theme/registry.ts'), 'utf8');
    const themes: Record<string, string> = {};
    for (const m of reg.matchAll(/font: font\("([^"]+)", "([^"]+)"\)/g)) themes[m[1]] = m[2];
    expect(THEME_FONT_QUERIES).toEqual(themes);
  });
});
