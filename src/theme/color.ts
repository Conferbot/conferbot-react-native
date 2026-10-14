/**
 * Server colours as the theme can use them. Customize saves "#fff",
 * "#0b4eb8", "rgb(...)"; the components append a two-digit alpha to theme
 * colours ("#0b4eb8" + "20"), which only works on six-digit hex - "#fff" +
 * "BF" is not a colour and React Native warns and draws nothing. Pure.
 */

const HEX3 = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i;
const HEX6 = /^#[0-9a-f]{6}$/i;
const HEX8 = /^#([0-9a-f]{6})[0-9a-f]{2}$/i;
const RGB = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*[\d.]+)?\s*\)$/i;

const hex2 = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');

/** "#rrggbb" for a hex or rgb() colour; null when it is not one. */
export const toHex6 = (value: unknown): string | null => {
  const v = typeof value === 'string' ? value.trim() : '';
  if (HEX6.test(v)) return v.toLowerCase();
  const short = HEX3.exec(v);
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`.toLowerCase();
  const long = HEX8.exec(v);
  if (long) return `#${long[1]}`.toLowerCase();
  const rgb = RGB.exec(v);
  if (rgb) return `#${hex2(+rgb[1])}${hex2(+rgb[2])}${hex2(+rgb[3])}`;
  return null;
};

/** `color` mixed toward `toward` by `amount` (0..1), as #rrggbb. */
export const mix = (color: string, toward: string, amount: number): string => {
  const a = toHex6(color);
  const b = toHex6(toward);
  if (!a || !b) return color;
  const ch = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  return `#${[0, 1, 2].map((i) => hex2(ch(a, i) + (ch(b, i) - ch(a, i)) * amount)).join('')}`;
};
