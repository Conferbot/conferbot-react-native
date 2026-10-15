# Greeting card - native spec (11 styles)

Sources: `conferbot-widget/src/css/polish-home.css` (lines 10-290 base, 646-890 note/imessage/postcard/sticky/typewriter, 1110-1276 glass/notification/neon/voice/aurora), `src/css/polish.css` 1092 (pre-card nudge), `src/css/liveChat/index.css` 99-183 (fixed position, close base), `src/ts/home/greetingStyle.ts`, `src/ts/home/firstImpression.ts` (upgradeGreeting, accentFor, brandColors), `src/ts/home/mascotMotion.ts`, `src/ts/visibility/greeting.ts`, `src/svg/WidgetIconBubble.ts` (launcherSolid / launcherInk), `src/ts/theme/registry.ts`.

All units are CSS px = dp (Android) = pt (iOS). Shadows are CSS `x y blur spread colour`; native sigma ~= blur / 2. A negative spread shrinks the shadow shape by that much on every side before blurring (iOS: shadowPath inset by |spread|; Compose: draw a blurred rounded rect inset by |spread| and offset by x,y; RN: use a blurred inner View or react-native-shadow-2; Flutter: `BoxShadow(offset, blurRadius: blur, spreadRadius: spread)` takes negative spread directly).

`accent` below = the `--cb-accent` RGB triple (see section 0.3). `accent(a)` = that colour at alpha a.

---

## 0. Shared inputs

### 0.1 Style selection
`customizations.greetingStyle` in `card | note | imessage | postcard | sticky | typewriter | glass | notification | neon | voice | aurora`. Anything else (including missing) -> **`imessage`** (DEFAULT_GREETING_STYLE). `card` = base card with no style class.

### 0.2 Data shown
- **Name** (`.cb-greet__name`): `look.name` if mascot is on (`c.mascotInGreeting === true`), else `agent.displayName` || `c.logoText` || botName || "Support" (i18n `home.support`).
- **Status** (`.cb-greet__status`): "Online" (`greetingPresence`), omitted entirely when `c.hideOnlineStatus === true`. Overridden by style: notification -> "now", postcard -> "Greetings from {name}" (i18n `greeting.from`, name = agent.displayName || c.logoText || botName || "us").
- **Avatar** (`.cb-greet__avatar`, an image): if mascot off: `agent.avatar` || (`!c.hideAvatar` && `c.avatar`) || `c.initialPageAvatar` || (`!c.hideLogo` && `c.logo`). No source -> no avatar (no placeholder circle).
- **Mascot** (`.cb-greet__mascot`) replaces the avatar when `c.mascotInGreeting === true`: 40x40, margins top -6, right 0, bottom -4, left -2 (it overhangs). Mascot colour `c.widgetIconBgColor || c.headerBgColor || #4f46e5`.
- **Message** (`.cb-greet__msg`): `c.chatIconCtaText` (or the page rule's text), whitespace preserved (`pre-wrap`).
- **Starter chips**: `agent.starters`, first 3 only, only for AI-agent bots (or page-rule starters from greeting.ts, same chip styling). Tap -> open chat and send that text (tap must not also trigger the card tap).
- **Close**: dismisses (never again on this page). a11y label "Dismiss".
- Card tap -> opens the chat.

### 0.3 Colour variables (set in JS)
- `--cb-accent` (firstImpression.ts `upgradeGreeting`, `accentFor`): first candidate that resolves to a colour whose relative luminance (WCAG, sRGB-linearised, 0.2126R+0.7152G+0.0722B) is **<= 0.55**, in this order:
  1. `brandColorOf(c)` = (`!c._themePalette` && hex `c.brandColor`) || `c.headerBgColor` || `#1b55f3`
  2. `c.headerBgColor`
  3. `brandColors(c)`: gradient launcher (`widgetIconThemeType === "Gradient"` and both stops set) -> `widgetGradientBgOne`, `widgetGradientBgTwo`; else `widgetIconBgColor || headerBgColor || #4f46e5` (twice)
  4. fallback `rgb(79, 70, 229)` (#4f46e5).
- `--cb-im-bg`, `--cb-im-tail`, `--cb-im-fg`, `--cb-im-font` (greetingStyle.ts, only for imessage, voice, aurora, neon; only imessage and voice actually read them):
  - gradient launcher (`widgetIconThemeType === "Gradient"` && `widgetGradientBgOne` && `widgetGradientBgTwo`): bg = `linear-gradient(135deg, One, Two)`, tail = `Two`.
  - else bg = tail = `launcherSolid(c)` = `widgetIconBgColor` if parseable #rgb/#rrggbb/rgb(); else `#1b55f3`. (For gradient type launcherSolid is `widgetGradientBgOne`.)
  - fg = `launcherInk(c)`: luminance of the solid (gradient: stop One) **> 0.6** -> `#111827`, else `#ffffff`.
  - font = `c.font` if set.
- Fallbacks when unset: im-bg `linear-gradient(#34a2ff, #0a7cff)` (top->bottom), im-tail `#0a7cff`, im-fg `#fff`.
- Card font: `c.font` if set (inline), else `"Roboto", sans-serif`. Styles that declare their own family (note, postcard, sticky, typewriter, notification) override `c.font`.

### 0.4 Fonts (theme registry, Google Fonts)
| Style | Web stack | Bundle in SDK | iOS fallback | Android fallback |
|---|---|---|---|---|
| note | "Patrick Hand" (400 only; theme `sketch`), "Segoe Print", "Comic Sans MS", cursive | Patrick Hand Regular (OFL) | `Noteworthy-Light` | `FontFamily.Cursive` / "casual" |
| sticky | "Permanent Marker" (400 only; theme `sticky`), "Marker Felt", "Comic Sans MS", cursive | Permanent Marker (Apache 2.0) | `MarkerFelt-Wide` | "casual" |
| postcard | "Fraunces" (variable opsz 9..144, wght 400-700, roman only; theme `editorial`), Georgia, "Times New Roman", serif | Fraunces (OFL) roman 400/600 (+ italic file recommended; web synthesises the italic) | `Georgia` | `FontFamily.Serif` |
| typewriter | "Courier New", Courier, "JetBrains Mono", ui-monospace, monospace (nothing loaded) | none needed | `Courier New` (built in) / `CourierNewPS-BoldMT` | `FontFamily.Monospace` |
| notification | -apple-system, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial | system | system (SF) | Roboto (system) |
| others | `c.font` or Roboto | `c.font` | system | system |

Note: Patrick Hand and Permanent Marker have no bold; where the CSS asks 700 (note's name) the browser fakes bold. Natively use 400 or synthetic bold (Compose `FontSynthesis.Weight`, iOS default synthesises).
Permanent Marker's lowercase glyphs look like capitals; that is the font, not `text-transform`.

### 0.5 Position relative to the launcher (firstImpression.ts `layoutCorner`, homeUtils `stackCorner`)
- Card **bottom** = (launcher top measured from screen bottom) **+ 12** (gap 12).
- Card **right** edge = launcher's right inset, `max(8, inset)`; for `widgetPosition === "left"` the left edges align instead.
- Width per style (below); `max-width = screenWidth - 24`.
- Transform origin for entrance scale: bottom-right (bottom-left when the launcher is on the left).
- No RTL-specific rules exist; mirror only on `widgetPosition === "left"` (close always stays top-right).
- Not shown while chat is open. Embedded full-page chat: no card.

### 0.6 Show / hide lifecycle (greeting.ts, polish-home.css)
- Show: `display:flex` + `.show`. Hide: `.hide` (exit anim), removed after **300 ms** (FADE_MS).
- Entrance (card level), pick one:
  - Default (mascotMotion `lively`, i.e. unset): **cb-greet-spring 620 ms cubic-bezier(0.2, 0.9, 0.3, 1)**: 0% opacity 0, translateY 14, scale 0.94 -> 55% opacity 1, translateY -3, scale 1.01 -> 78% translateY 1, scale 0.998 -> 100% identity.
  - `mascotMotion: "subtle"` or `"off"`: **cb-greet-in 450 ms cubic-bezier(0.22, 1, 0.36, 1)**: from opacity 0, translateY 10, scale 0.98 -> identity.
  - notification and neon replace both with their own (sections 8, 9).
- Exit: **cb-greet-out 220 ms ease-in**: -> opacity 0, translateY 6, scale 0.98. When the card is tapped to open chat (lively/subtle): **cb-greet-collapse 240 ms cubic-bezier(0.55, 0, 0.75, 0.2), delay 40 ms**: -> opacity 0, translateY 16, scale 0.86.
- Word fade-up (lively only, all styles except imessage and typewriter, message >= 2 words): each word fades in 320 ms cubic-bezier(0.22,1,0.36,1), delay **380 ms + i x step**, step = `min(55, floor(520 / (words - 1)))` ms; from opacity 0, translateY 5, blur 2 -> clear.
- "Online" ping (lively 900 ms, subtle 600 ms after show; not in notification/postcard): the 7px dot scales 1 -> 1.35 (40%) -> 1 over 500 ms cubic-bezier(0.3,1.6,0.5,1); a second 7px #22c55e circle at the dot's position animates opacity 0.55 -> 0, scale 1 -> 3.2 over 1100 ms cubic-bezier(0.2,0.7,0.3,1), once.
- Figure (avatar/mascot) gestures: mascotMotion.ts (pop at 140 ms 620 ms, wave 760 ms, nod 1660 ms, breath from 1900 ms; amplitude 1 mascot, 0.75 photo, 0.55 initials). Port separately; not style specific.
- **Reduced motion**: no card entrance/exit (just appears, opacity 1), no word fade, no ping, figure only a 220 ms fade. Per-style reduced rules in each section.

---

## 1. Base card (style `card`, and the skeleton every other style modifies)

### Container
- Width **296**, max-width screen - 24. Height: content.
- Padding **14 top, 16 right, 14 bottom, 16 left**.
- Layout: vertical stack, children stretch, **gap 8**.
- Background `#ffffff`; text colour `#0f172a`.
- Corner radius **16** all corners.
- Shadows: `0 18 44 -14 rgba(15,23,42,0.32)` + hairline ring `0 0 0 1 rgba(15,23,42,0.06)` (a 1px outside border).
- Pressed/hover: `0 22 48 -14 rgba(15,23,42,0.38)` + ring `rgba(15,23,42,0.08)`, transition 200 ms ease.
- Base font size 14, weight 500.
- Theming (only `card`, never the 10 styled variants): when a widget theme is active (`:host([data-cb-tokens])`) bg = theme `--t-card`, text `--t-ink`, shadow `--t-sh-float`, avatar bg `--t-card-2`, name `--t-ink`, status `--t-muted`, message `--t-text`, close `--t-faint` (pressed bg `--t-hover`, colour `--t-text`). Dark scheme: `--cb-accent` becomes the theme's lifted dark accent (`--cb-o-accent-dark-rgb`). Without a theme, the card is always white (no OS dark mode).

### Head (row, centre-aligned, gap 10, padding-right 22 so it clears the close)
- Avatar: 32x32 circle, image aspect-fill, placeholder bg `#eef2f7`, no shadow.
- Initials avatar (agent proactive message without photo): 32 circle, bg `accent`, text white 12.5 / 700, letter-spacing 0.02em, rings `0 0 0 2 #fff` then `0 0 0 3 accent(0.28)` (white 2px ring, then 1px tinted ring outside it).
- Mascot instead of avatar: 40x40 with margins -6 / 0 / -4 / -2.
- Who (column, line-height 1.25, shrinkable):
  - Name 13.5 / 700 `#0f172a`, single line, ellipsis.
  - Status row (gap 5): dot 7x7 circle `#22c55e`, then text 12 / 500 `#64748b`.

### Message
14 / weight 500 / line-height 1.45 (20.3) / `#1e293b`, margin 0, max **3 lines** with ellipsis, preserves newlines.

### Close
- Absolute, top 10, right 10, 26x26 hit box, radius 8, transparent, glyph colour `#94a3b8`.
- Pressed: bg `#f1f5f9`, glyph `#334155`, no scale.
- Glyph: 20x20 SVG, viewBox `-6 -6 24 24`, path `m7.314 5.9l3.535-3.536A1 1 0 1 0 9.435.95L5.899 4.485L2.364.95A1 1 0 1 0 .95 2.364l3.535 3.535L.95 9.435a1 1 0 1 0 1.414 1.414l3.535-3.535l3.536 3.535a1 1 0 1 0 1.414-1.414L7.314 5.899z` fill currentColor. Visually: an X about **8.3 x 8.3** centred, round-capped strokes about **1.7** thick (at 20px icon size; scale proportionally for other sizes).

### Starter chips
- Row: wrap, gap 6 (both axes), margin-top 2 (so 10 below the message), start-aligned.
- Chip: padding 6 x 12, radius 999 (pill), font = card font 13 / 600 / line-height 1.3, text `accent`, bg `accent(0.07)`, border 1px inside `accent(0.22)`. Single line, ellipsis, max-width 100% of row.
- Pressed: bg `accent(0.13)`, border `accent(0.4)`, 150 ms. Focus ring 2px `accent(0.6)` offset 2.

### Agent reply field (proactive agent message only)
Pill, margin-top 2, padding 8 x 12, radius 999, bg `#f1f5f9`, text `#64748b` 13 / 500, send icon 16x16 (path `M3.4 20.4 21 12 3.4 3.6 3.4 10l12.6 2-12.6 2z`, opacity 0.7) at the end. Pressed: bg `accent(0.1)`, text `accent`.

---

## 2. note - handwritten note on ruled paper

### Container
- Width 296. Padding **20** top (others 14/16/14/16).
- Rotation **-1.6deg** (counter-clockwise) about centre.
- Background `#fffdf5` + ruled lines: **1px lines `rgba(59,130,246,0.16)` every 26px**. Exact web placement (repeating gradient tile offset 44px down, tile repeats): lines at **y = 69 + 26k** (y from the card's outer top) for y >= 44; above y = 44 the previous tile shows, giving lines at `y = 44 - H + 25 + 26k` that fall in [0, 44) (H = card height). In practice 0-1 line in the top 44px (screenshot: one line at y=24 for H=201). Native: draw y = 69 + 26k, plus any `y = 69 - H + 26k` (k integer) that lands in [0, 44). Lines span full width, clipped by the 3px radius.
- Text colour `#1f2a44`. Radius **3** all corners.
- Shadows `0 16 34 -14 rgba(30,41,59,0.45)`, `0 1 0 0 rgba(30,41,59,0.06)`.
- Font: Patrick Hand for everything except where noted.

### Tape (::before)
- 84 x 20, centred horizontally, top **-9** (overhangs the top edge by 9), extra rotation **+2deg** (on top of the card's -1.6deg).
- Fill `rgba(253,230,138,0.72)` (translucent yellow), shadow `0 1 2 rgba(0,0,0,0.12)`. Square corners. Not tappable.

### Head
Avatar 32 circle as base. Name Patrick Hand **17** / 700 (synthetic) `#1f2a44`. Status Patrick Hand 12 / 500 `#475569`, green dot as base.

### Message
Patrick Hand **20 / 400 / line-height 26** `#1f2a44`, 3 lines max. (Line-height equals the ruling pitch so lines of text sit between rules.)

### Close
Base (top 10 right 10, `#94a3b8`).

### Chips
Patrick Hand **16 / 400**, padding 2 x 4, radius 4, **no fill, no border**, text `accent`, **wavy underline** `accent(0.5)`, underline offset 4 (wave amplitude ~1.5, wavelength ~6 at 16px; draw a sine path). Layout as base (they wrap one per line when long).

### Motion
Base entrance + word fade. Reduced motion: **rotation removed (0deg)**; tape keeps its own 2deg.

---

## 3. imessage (DEFAULT) - typing dots, then a text bubble, "Delivered"

### Container
- Width **270**, **no background, no shadow, no radius visible**. Padding **18 top, 0 right, 0 bottom, 0 left**. Gap **6**.
- Font: `c.font` (via --cb-im-font) else card font.
- **Head hidden** (no avatar, mascot, name or status).

### Message bubble
- Right-aligned (align end), max-width **88%** (237.6), padding **9 x 14**, radius **19** all corners.
- Fill `--cb-im-bg` (launcher colour; gradient 135deg if gradient launcher; fallback vertical `#34a2ff -> #0a7cff`). Text `--cb-im-fg`.
- 15 / 400 / line-height 1.35, max 3 lines.
- Shadow `0 10 26 -12 rgba(15,23,42,0.45)`.
- **Tail**: a 16x16 shape whose box sits at the bubble's bottom-right, its right edge **5 past** the bubble's right edge (right: -5, bottom: 0). Path in the 16x16 box: `M0 0 C 2 9 7 14 16 16 C 8 16 3 14 0 11 Z`. Fill `--cb-im-tail` (solid launcher colour; gradient's second stop; fallback `#0a7cff`). Drawn over the bubble corner.

### Typing dots bubble
- Overlays the message's top-right corner: absolute top **18**, right **0** (same corner as the bubble), above it (z 1).
- Padding **12 x 14**, radius 19, fill **`#e9e9eb`**, no shadow; tail same path, fill `#e9e9eb`.
- Three dots 7x7 circles `#8e8e93`, gap 4 (bubble ~57 x 31).

### "Delivered"
Under the bubble, right-aligned, margin top **-2**, right **6** (so ~4 below the bubble). 11 / 600 `#8e8e93`. Text i18n `receipt.delivered`.

### Close
Absolute top **-6**, right **-4** (card box), **22x22 circle**, fill `rgba(142,142,147,0.9)`, glyph white, icon **16** (glyph ~6.7).

### Chips (quick replies)
- Row aligned **end** (right), wrap, gap 6.
- Chip: padding 6 x 12, radius **17**, bg `rgba(255,255,255,0.94)` (+ background blur 8 where cheap), text `accent` 13 / 600, border 1px inside `accent(0.35)`, drop shadow `0 6 16 -10 rgba(15,23,42,0.45)`.
- Pressed: bg `--cb-im-bg`, text `--cb-im-fg`, shadow `0 8 18 -10 accent(0.8)`, 150 ms.

### Reveal (first show on this page only)
Timeline from `.show` (alongside the card entrance):
- 0 ms: dots bubble appears: **cb-im-dots 1100 ms ease, forwards**: 0% opacity 0 scale 0.6 -> 15% opacity 1 scale 1 -> 80% opacity 1 scale 1 -> 100% opacity 0 scale 1.08 (centre origin). Each dot loops **cb-im-dot 1000 ms ease-in-out infinite**, delays 0 / 150 / 300 ms: 0%,60%,100% opacity 0.35 y 0; 30% opacity 1 y **-3**.
- **1050 ms**: bubble pops: **cb-im-pop 420 ms cubic-bezier(0.2, 1.3, 0.4, 1)** (overshoots), from opacity 0 scale 0.4 origin **bottom-right** -> 1. Hidden before (fill both).
- **1450 ms**: "Delivered" and chips fade in 300 ms ease (opacity 0 -> 1).
- 1700 ms: marked played. Every later show on the same page (module flag, i.e. per app session/screen): no dots, everything visible immediately with the card entrance.
- No word fade (style owns its text).
- Reduced motion: no dots, bubble/delivered/chips no animation (shown at once).

---

## 4. postcard - airmail edge, stamp, postmark, serif

### Container
- Width 296; padding 14/16/14/16 **inside** a 6px border.
- **Airmail border**: 6px all round, outer radius **6** (inner corners square: 6 - 6 = 0). Stripes = `repeating-linear-gradient(135deg, #d9383a 0 12px, #fbf6ea 12px 18px, #2754c5 18px 30px, #fbf6ea 30px 36px)` over the whole border box: bands run diagonally like "/" (bottom-left to top-right), measured perpendicular to the bands: **red 12, paper 6, blue 12, paper 6**, period **36** (along a horizontal or vertical edge each band is x1.414: red 17, gap 8.5, blue 17, gap 8.5, period 50.9). Gradient line goes from top-left corner toward bottom-right; first red band starts at the top-left corner. Native: fill the rounded rect with the rotated stripe pattern, then fill the inner rect (inset 6) with paper.
- Paper (inside the border) `#fbf6ea`. Text `#2b2118`.
- Shadow `0 18 40 -16 rgba(43,33,24,0.5)`.
- Font: Fraunces everywhere (chips too).
- Head padding-right **62**; message padding-right **40** (clear the stamp).

### Stamp (::before) - positions are from the inner (paper) edge
- Box 40 w x 48 h at top **12**, right **14**. Square corners.
- Fill `linear-gradient(160deg, accent, accent(0.7))` (160deg: from top, slightly left, to bottom, slightly right).
- Glyph: "♥" (U+2665), Georgia 20, line-height 1, `rgba(255,255,255,0.92)`, centred.
- White frame: `0 0 0 2 #fff` (2px white around the box) + soft shadow `0 1 3 2 rgba(43,33,24,0.25)`.
- **Perforation**: dotted outline 3px wide in paper colour `#fbf6ea`, offset 1px outside the box (band from 1 to 4 px outside). Native: circles of diameter 3, colour #fbf6ea, centres on the rectangle inflated by 2.5, pitch ~6 (Chrome's dotted: dot = width, equal gap), drawn over the white frame -> scalloped edge.

### Postmark (::after) - drawn over the stamp
- Circle 44x44, top **34**, right **34** (paper edge), rotation **-14deg**.
- Ring 2px `rgba(43,33,24,0.35)`.
- Fill: horizontal (before rotation) 1px lines `rgba(43,33,24,0.28)` every **6px** (gap 5, line 1, first line at y=5 of the inner box), clipped to the circle -> rotate the whole thing -14deg.

### Head
- **Avatar hidden** (an enabled mascot still shows).
- Name: Fraunces **12 / 600, uppercase, letter-spacing 0.12em** (1.44), `#8a6d4b`.
- Status: "**Greetings from {name}**", Fraunces **17 / 600 italic** `#2b2118`, **no dot**, can wrap (2 lines in screenshot: line-height 1.25).
- No ping ring.

### Message
Fraunces **15 italic**, weight 500, `#3b2f24`, line-height 1.45, 3 lines.

### Close
Absolute top **-12**, right **-12** from the paper edge (= 6 outside the outer border's corner), 26x26 **circle**, fill `#fbf6ea`, glyph `#94a3b8` (20 icon), shadow `0 2 6 rgba(0,0,0,0.2)`.

### Chips
Base chip (accent text, `accent(0.07)` fill, `accent(0.22)` 1px border, padding 6 x 12, 13 / 600) but Fraunces and radius **3** (rectangular label look).

### Motion
Base entrance + word fade. No reduced-motion specifics.

---

## 5. sticky - yellow sticky note in marker, corner lifting

### Container
- Width **250**. Padding base 14/16/14/16.
- Rotation **+1.8deg** (clockwise).
- Background `linear-gradient(170deg, #fff8b0, #ffec6e)` (top, tilted 10deg, to bottom).
- Text `#3a2f00`.
- Radius **TL 2, TR 2, BR 18, BL 2**.
- Shadows: outer `0 22 30 -18 rgba(90,70,0,0.55)` (sits mostly under the bottom); inner `inset 0 -18 22 -18 rgba(120,90,0,0.18)` (darkening toward the bottom edge inside).
- Font Permanent Marker (except status and chips).

### Curl (::after)
- 22 x 22 at bottom-right corner (right 0, bottom 0), radius BR 18 (matches card).
- `linear-gradient(135deg, #ffe45c 50%, rgba(0,0,0,0.12) 50%, #f4d63a 60%)`: diagonal from top-left to bottom-right; the top-left triangle (to the diagonal) `#ffe45c`; at the diagonal a hard edge to `rgba(0,0,0,0.12)` fading to `#f4d63a` by 60%, then `#f4d63a` to the corner.

### Head
- Avatar **26x26** circle.
- Name Permanent Marker **15 / 400** `#3a2f00`.
- Status system sans (-apple-system / Roboto) 12 / 500 `#6b5a00`, green dot.

### Message
Permanent Marker **18 / 400 / line-height 1.3** `#2b2300`, 3 lines.

### Close
Base, glyph `#6b5a00`.

### Chips
System sans 13 / 600, pill, bg `rgba(255,255,255,0.55)`, text `#3a2f00`, 1px inside border `rgba(58,47,0,0.25)`, padding 6 x 12.

### Motion
Base entrance + word fade. Reduced motion: **rotation removed**.

---

## 6. typewriter - paper, typed out, blinking caret

### Container
- Width 296, padding base.
- Background `#fcfbf6`, text `#1c1c1c`, radius **4**.
- Shadows `0 16 36 -16 rgba(0,0,0,0.45)` + **inset `0 3 0 0 accent`** = a 3px accent band along the inside top edge (follows the 4px corner curve; native: a 3px top strip clipped to the card shape).
- Font Courier New stack (everything).

### Head
Avatar 32. Name Courier **13.5 / 700**, letter-spacing **0.02em**, `#0f172a`. Status Courier 12 / 500 `#64748b`, green dot.

### Message
Courier **15 / 600 / line-height 1.5** `#1c1c1c`, max **4 lines**.

### Caret
After the typed text, inline: width **0.55em** (8.25), height **1.05em** (15.75), margin-left 1, baseline shift: bottom at -0.15em (2.25 below baseline). Fill `accent`. Blink: `1000 ms steps(1) infinite`, visible 0-500 ms, hidden 500-1000 ms. Keeps blinking after typing ends (the `--done` class has no CSS).

### Close / chips
Close base. Chips base colours, Courier font, radius **3**.

### Reveal (every show, not just the first)
- Text cleared; typing starts **260 ms** after show.
- One character per step; next step after **34 ms + random(0..30) ms**; after a character in `. , ! ?` the pause is **204 ms** (34 x 6).
- Ends with full text + caret. If the card is hidden mid-way, cancel; re-shown -> type again from empty.
- No word fade.
- Reduced motion: full text at once, **no caret**.
- Accessibility label = full text.

---

## 7. glass - frosted, translucent, brand glow

### Container
- Width 296, padding base, radius **20**.
- Background layers (bottom to top): `rgba(255,255,255,0.62)`; then `radial-gradient(120% 90% at 100% 0%, accent(0.22), transparent 60%)`: ellipse centred on the **top-right corner**, radii 120% of width x 90% of height, accent 0.22 at centre fading to transparent at 60% of those radii.
- **Backdrop blur 18 + saturate 1.6** (iOS `UIVisualEffectView` .systemUltraThinMaterialLight / SwiftUI `.ultraThinMaterial` under the white 0.62; Android 12+ `RenderEffect` blur of the host behind, else just the translucent white; Flutter `BackdropFilter(ImageFilter.blur(18,18))`).
- Text `#0f172a`.
- Shadows: `inset 0 0 0 1 rgba(255,255,255,0.7)` (1px inner white border), `inset 0 1 0 0 rgba(255,255,255,0.9)` (brighter 1px top highlight), outer `0 24 48 -20 rgba(15,23,42,0.45)`.

### Head / message
Base head; status text `#475569`. Message `#0f172a` (14 / 500 / 1.45).

### Close
Base.

### Chips
Pill, bg `rgba(255,255,255,0.7)`, text `#0f172a` 13 / 600, 1px inside border `rgba(15,23,42,0.08)`.

### Motion
Base entrance + word fade.

---

## 8. notification - a phone push banner sliding down

### Container
- Width **300**, padding **12 top/bottom, 14 left/right**, radius **22**.
- Background `rgba(246,246,248,0.88)`, **backdrop blur 24, saturate 1.8**.
- Text `#111`.
- Shadows `0 18 40 -16 rgba(0,0,0,0.45)`, `inset 0 0 0 0.5 rgba(0,0,0,0.08)` (hairline inner border).
- Font: system (-apple-system / SF Pro Text / Roboto).

### Head (single row)
- Avatar **22x22, radius 6** (rounded square app-icon), gap 10.
- Name and status on **one row** (who = row, centre, fills width): name **12 / 600, uppercase, letter-spacing 0.02em**, `#555`, ellipsis.
- Status = "**now**" (literal, not localised), pushed to the right end (margin-left auto), padding-right **18**, 12 / 500 `#8e8e93`, **no dot**. With head padding-right 22, "now" ends 40 from the content's right edge, left of the close.
- No ping ring.

### Message
**14.5 / 500 / line-height 1.35** `#111`, 3 lines.

### Close
Base (top 10, right 10, 26 box, `#94a3b8`).

### Chips
Pill radius **12**, bg `rgba(0,0,0,0.06)`, text `#111` 13 / 600, **no border**, padding 6 x 12.

### Reveal
Replaces the card entrance: **cb-notif-in 500 ms cubic-bezier(0.2, 1.2, 0.3, 1), both**: from opacity 0, **translateY -14** (comes from above), scale 0.96 -> identity (slight overshoot). Word fade still plays (lively). Reduced motion: none.

---

## 9. neon - a dark sign lit in the brand colour

### Container
- Width 296, padding base, radius **16**.
- Background `radial-gradient(140% 120% at 0% 0%, #1b1530, #07070c 70%)`: ellipse centred on the **top-left corner**, radii 140% width x 120% height; `#1b1530` at centre to `#07070c` at 70%, then solid `#07070c`.
- Text `#f5f3ff`.
- Shadows: `inset 0 0 0 1.5 accent(0.95)` (1.5px neon tube border inside), glow `0 0 18 0 accent(0.55)`, wide glow `0 0 42 -6 accent(0.5)`, drop `0 24 40 -20 rgba(0,0,0,0.7)`.
- Note: greetingStyle.ts sets the --cb-im-* vars for neon, but neon's CSS only uses `accent`.

### Head
- Avatar 32 circle (placeholder `#eef2f7`).
- Name `#fff` 13.5 / 700 with text glow: `0 0 8 accent(0.9)`, `0 0 18 accent(0.6)` (two text shadows, no offset).
- Status `#a5a3c7`, green dot `#22c55e`.

### Message
`#ede9fe`, 14 / 500 / 1.45.

### Close
Base geometry, glyph `#c4b5fd`.

### Chips
Pill, transparent fill, text `#f5f3ff` 13 / 600, 1px inside border `accent(0.8)`, outer glow `0 0 10 accent(0.35)`.

### Reveal (flicker on)
Replaces the card entrance (no translate/scale): **900 ms, steps(1)** = hard jumps, opacity holds each value until the next stop:
| t (ms) | 0-90 | 90-144 | 144-216 | 216-270 | 270-342 | 342-900+ |
|---|---|---|---|---|---|---|
| opacity | 0 | 1 | 0.3 | 1 | 0.55 | 1 |
Word fade still plays. Reduced motion: no flicker.

---

## 10. voice - a voice note: play, waveform, transcript

### Container
- Width **280**, padding base, radius **20**.
- Background `#fff`, text `#0f172a`.
- Shadows `0 20 40 -18 rgba(15,23,42,0.4)`, `inset 0 0 0 1 rgba(15,23,42,0.06)` (1px inner hairline).
- Order: head, **voice pill**, message (transcript), chips. Gap 8.

### Head
Base (avatar 32, name, Online + dot).

### Voice pill (`.cb-greet__voice`, inserted before the message)
- Row, centre, gap **10**, padding **8 top, 12 right, 8 bottom, 8 left**, radius 999.
- Fill `--cb-im-bg` (launcher colour / 135deg gradient; fallback `accent`), content colour `--cb-im-fg` (fallback #fff).
- **Play**: 30x30 circle, fill `rgba(255,255,255,0.22)`, triangle 14x14 icon: viewBox 24, path `M8 5.5v13l10.5-6.5z`, fill currentColor (fg).
- **Waveform**: fills remaining width, height **26**, **22 bars**, gap 2, each bar equal width (flex 1, ~4.9 at 280 width), radius 2, colour fg at opacity **0.85**, vertically centred. Bar i (0..21) height = `30 + round(70 * |sin(1.7 i) * cos(0.45 i)|)` % of 26: `[30, 93, 41, 44, 38, 65, 74, 73, 84, 47, 44, 32, 74, 37, 98, 52, 67, 38, 42, 65, 64, 94]` % (compute with JS-style round half up).
- **Duration**: "0:SS", SS = `clamp(round(words / 2.4), 2, 59)` zero-padded, words = whitespace-split message words. 12 / 600, tabular figures, opacity 0.9.

### Message (transcript)
**13 / italic**, weight 500, line-height 1.45, `#475569`, padding 0 x 4, 3 lines.

### Close / chips
Base.

### Reveal
Each show: bar i animates **scaleY 1 -> 0.35 -> 1** (centre origin), **1200 ms ease-in-out, 2 iterations**, delay **i x 60 ms** (total ~3.66 s), then still. The mascot "talks" (rhythmic squash, 640 ms loop) for that long if mascot motion is on. Word fade plays on the transcript. Reduced motion: bars static.
Not interactive: play does not play audio.

---

## 11. aurora - white card, slowly turning coloured edge

### Container
- Width 296, padding base, radius **20**, clips content (overflow hidden).
- Inside fill `#fff`, text `#0f172a`.
- Outer shadow **`0 24 50 -22 accent(0.55)`** (brand-tinted glow below).
- No hairline ring (box-shadow replaced).

### Animated edge (`.cb-greet__aurora`, behind content)
- Fills the card (inset 0, same radius 20).
- A square of side **180% of card width**, centred on the card, filled with `conic-gradient(from 0deg, accent, #22d3ee, #a78bfa, #f472b6, accent)` (0deg = 12 o'clock, clockwise, stops evenly at 0/25/50/75/100%), **rotating 360deg every 6 s linear, forever**.
- Clipped to the card; covered by a white rounded rect inset **2** with radius **18** -> visible as a **2px gradient ring**.
- Native: draw a rotating sweep gradient (`SweepGradient` / `AngularGradient` / `SweepGradient` in Flutter with a rotation transform) inside the card clip, then the white inset 2/radius 18 shape, or stroke a 2px rounded-rect border with the rotating sweep shader.

### Head / message / close / chips
All base.

### Motion
Base entrance + word fade + the ring rotation. Reduced motion: ring stops (static gradient at 0deg).

---

## 12. Quick reference table

| Style | Width | Radius | Bg | Head | Font | Tilt | Special reveal |
|---|---|---|---|---|---|---|---|
| card | 296 | 16 | #fff (theme card) | yes | c.font | - | spring / fade-up |
| note | 296 | 3 | #fffdf5 + 26px rules | yes, 17 name | Patrick Hand | -1.6deg | - |
| imessage | 270 | bubble 19 | none | hidden | c.font | - | dots 1.1s, pop at 1.05s, fade at 1.45s (first show) |
| postcard | 296 | 6 (6px airmail border) | #fbf6ea | no avatar; caps name + "Greetings from" | Fraunces | - | - |
| sticky | 250 | 2/2/18/2 | 170deg #fff8b0->#ffec6e | avatar 26 | Permanent Marker | +1.8deg | - |
| typewriter | 296 | 4 | #fcfbf6 + 3px accent top | yes | Courier | - | typed 34-64 ms/char, caret |
| glass | 296 | 20 | white 0.62 + blur 18 + accent glow TR | yes | c.font | - | - |
| notification | 300 | 22 | #f6f6f8 0.88 + blur 24 | 22 sq avatar, caps name, "now" | system | - | slide down 0.5s |
| neon | 296 | 16 | radial #1b1530->#07070c | glow name | c.font | - | flicker 0.9s |
| voice | 280 | 20 | #fff | yes | c.font | - | waveform 2x1.2s |
| aurora | 296 | 20 | #fff + 2px rotating conic ring | yes | c.font | - | ring 6s loop |

Fixed vs bot colours:
- From `accent` (`--cb-accent`): chips (all styles), note chip underline, typewriter top band + caret, postcard stamp, glass glow, neon border/glows/name glow, aurora ring + shadow, initials avatar, imessage chip outline/text.
- From launcher (`--cb-im-*`): imessage bubble + tail + text + pressed chip, voice pill fill + content.
- From theme tokens: only the plain `card` style.
- Everything else is fixed per style (styles do not change with dark scheme or widget theme).
