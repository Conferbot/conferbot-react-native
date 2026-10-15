# Web widget parity: React Native

This file tracks how far this SDK matches the web widget: what's done, what's left, and how to pick the work up. RN is the reference SDK. Each feature's pure logic in `src/core/*.ts` is the spec that Android, iOS and Flutter port.

## Done in this SDK

| Issue | Feature | Key files |
|---|---|---|
| #18-#20 | Customization basics, readable ink | `src/core/customizations.ts`, `src/theme/color.ts` |
| #21 | Chat background | `src/core/chatBackground.ts`, `src/components/ChatBackground/` |
| #22 | 27 themes, light/dark/auto, palette | `src/core/widgetTheme.ts`, `widgetThemes.data.ts` (generated) |
| #23 | Launcher resolver (label only on screens wider than 480; greeting only when `chatIconCta`) | `src/core/launcher.ts`, `FloatingWidget/ConferBotWidget.tsx` |
| #24 | 56 icons, glyph at 70%, close cross at 60% | `src/core/launcherIcons.ts`, `launcherIcons.data.ts` (generated) |
| #25 | Launcher motion. `launcherMotion.ts` is the reference evaluator, checked against Chrome's animation in 784 cases. | `src/core/launcherMotion.ts`, `FloatingWidget/useLauncherMotion.ts` |
| #26 | User as `visitorContext` + identity hash on every response record | `src/core/state/ChatState.ts`, `src/types/index.ts` |
| #27 | Greeting card, all 11 styles checked on the Android emulator | `src/core/greeting.ts`, `FloatingWidget/useGreeting.ts`, `FloatingWidget/GreetingCard.tsx` |
| #57 | Launcher entrance, attention and idle call. `keyframes.ts` evaluates the web's Web Animations tracks; checked against Chrome in 447 cases (19,275 samples). | `src/core/keyframes.ts`, `launcherEntrance.ts`, `launcherAttention.ts`, `launcherIdleCall.ts`, `mascotArt.ts`, `fxPaint.ts`; `FloatingWidget/useLauncherEntrance.ts`, `useLauncherAttention.ts`, `useLauncherIdleCall.ts`, `FxSprites.tsx`, `IdleCallView.tsx`, `fxAnimated.ts` |

## Left in this SDK

In order: home screen; mascots; i18n; sounds; celebrations; reply-time wording. The web sources are listed below.

## Generators (`scripts/parity/`)

The data files shared by the 4 SDKs are generated from the widget's own CSS and SVG. The scripts expect `conferbot-widget` and `sdk/` side by side; set `CONFERBOT_DEV` to their parent folder if your layout differs. Run `npm install` in `scripts/parity` once. Chrome is `/usr/bin/google-chrome`, else the macOS app; set `CHROME_PATH` to use another (`chrome.js`).

- **`themes/gen.js`:** reads `css/themes/*.css`, `ts/theme/registry.ts` and `palettes.json`, and writes `themes.json`. That became each SDK's widget themes data file.
- **`icons/`:**
  - Generate in this order: `gen.js` (the icons as draw ops), then `boxes.js` (group boxes via Chrome getBBox), then `motion.js` (keyframes).
  - `sync-rn.js`, `sync-kt.js`, `sync-dart.js` and `sync-swift.js` write the data into each SDK.
  - `check.sh` regenerates, syncs RN and compares against Chrome.
  - `compare.js`, `mrest.js`, `mcompare.js` and `mall.js` render the web and the evaluator side by side.
  - `golden.json` holds the evaluator frames that the Kotlin, Dart and Swift tests check against.
- **`launcherfx/`:** `check.sh` compiles the RN core, plays every entrance, attention and idle-call track in Chrome (`element.animate`, paused at each sample) and writes `golden.json`, then `compare.js` prints the largest difference. `cases.js` lists the cases (a 50px launcher at 16/16 on a 390 x 844 screen, right and left; seed 4242). `golden.json` is what the Kotlin, Dart and Swift tests check against: `{ src, box, base, tracks, samples: [{ t, v }] }`, `v` holding only the channels away from rest, iterations `-1` for Infinity.
- **`ios-linux-baseline-fails.txt`:** the 28 iOS tests that already fail on Linux. Only failures outside this list matter.

## How to test

- **Unit tests:** `npx jest --maxWorkers=2`, plus `npx tsc --noEmit -p .`.
- **On a device:**
  - Run the example app (`example/`) against a local embed-server. Uncomment `ConferBotEndpoints.configure(...)` in `example/App.tsx` and set `BOT_ID`.
  - Run `npx react-native start --port 8081`, then `adb reverse tcp:8081 tcp:8081` and `adb reverse tcp:8001 tcp:8001`.
  - Revert `example/App.tsx` before committing.

## The goal

Every web widget feature works the same in the 4 mobile SDKs: customization, launcher, greeting and the live chat / agent features. The web widget (`conferbot-widget/src`) is the reference. Each feature is built and checked against the web in React Native first, then ported to Android, iOS and Flutter. The web source file it came from is named in a comment.

## Status across the SDKs (2026-10-15)

| Feature | RN | Android | iOS | Flutter |
|---|---|---|---|---|
| Customization basics (header, bubbles, avatar, typing styles, composer, footer) | done | done | done | done |
| Chat background (solid, gradient, image + mask, patterns) | done | done | done | done |
| 27 widget themes, light/dark/auto, theme palette | done | done | done | done |
| Launcher shape, size, offsets, gradient, image, avatar, label, glow | done | done | done | done |
| 56 launcher icons, drawn from the widget SVGs | done | done | done | done |
| Launcher motion (idle moments, message reaction, ripple) | done | done | done | done |
| Signed-in user as `visitorContext` + identity hash | done | done | done | done |
| Greeting card (rules, frequency, 11 styles) | done | logic done, UI on a branch | todo | todo |
| Launcher entrance / attention / idle call (#57) | done | todo | todo | todo |
| Home screen | todo | todo | todo | todo |
| Mascots (incl. `mascotInGreeting`) | todo | todo | todo | todo |
| `widgetLanguage` (i18n) | todo | todo | todo | todo |
| Message sounds | todo | todo | todo | todo |
| Celebrations / reactions | todo | todo | todo | todo |
| Reply-time wording | todo | todo | todo | todo |

Live chat / agent features (handover, queue card, receipts, rating, files, prefill, max-wait timeout, agent bot replies, suggestion chips) are done in all 4.

Each SDK repo has its own `docs/PARITY.md`. The React Native one also covers the generators in `scripts/parity/` and the greeting card spec in `docs/greeting-card-native-spec.md`.

### Web sources for the features still to do

All paths are under `conferbot-widget/src/`.

- **Launcher entrance / attention / idle call (all default off; done in RN, #57):**
  - `ts/launcher/entrance.ts`, setting `launcherEntrance`: classic default; lightning, rocket, portal, ufo, drop, confetti, coin, meteor, magic, parachute, plane, egg.
  - `ts/launcher/attention.ts`, setting `launcherAttention`: off, pulse, wobble, bounce, wave, float, shine, heartbeat, orbit. The pulse ring's keyframes are in its `ATTENTION_CSS`.
  - `ts/launcher/idleCall.ts` and `idlePacing.ts`, settings `launcherIdleCall` (off, psst, peek, wave, knock, tap), `launcherIdleCallDelay` (12, 5-120), `launcherIdleCallText` (24 characters). The mascot is `ts/launcher/art3d.ts` `mascot()`.
  - Mounted in `index.ts` after `mountLauncherMotion`; `launcherMotion.ts` holds idle moments while a launcher attention runs.
- **Home screen:** `ts/home/` (homeCopy, askBox, trust, pageAware, visitorMemory).
- **Mascots:** `ts/home/mascotMotion.ts`, `ts/launcher/launcherStyle.ts`, `ts/launcher/art3d.ts`, `ts/visibility/greeting.ts`. The `mascot` typing style is accepted but not drawn yet.
- **i18n:** `ts/i18n.ts` + `ts/i18n/{en,de,es,fr,nl}.ts`.
- **Sounds:** `ts/chat/messageSound.ts`.
- **Celebrations:** `ts/chat/delight/` (celebrate, reactions, rules) and `ts/chat/ratingFx.ts`.
- **Reply time:** `ts/chat/replyTime.ts`, `replyTimeView.ts`, `headerPresence.ts`.

### Porting the launcher entrance, attention and idle call (from RN, #57)

- **`src/core/keyframes.ts`** first: a Web Animations evaluator (offsets spaced evenly, per-property keyframes, each keyframe's easing on its step, the options' easing on the iteration, delay / iterations / fill, the later animation winning). Two Chrome details matter: a property missing at 0% starts from the element's own value but eases with the 0% keyframe's easing; and `rotate: "y 180deg"` is a flat flip, so draw it as `scaleX(cos a)`. Test it on `scripts/parity/launcherfx/golden.json` (RN: within 0.01px / 0.01deg / 0.001 scale and opacity).
- **`launcherAttention.ts`**, **`launcherIdleCall.ts`**, **`launcherEntrance.ts`** are the web's tracks as data, port them as they are (keep the keyframe strings); the golden's `src` names each case (`attention:wobble:self`, `idle:knock@right:arm`, `entrance:rocket@right:s3.1`) so a port can rebuild its own and compare. `mascotArt.ts` is the blob mascot as SVG layers; `fxPaint.ts` draws CSS gradients (radial, linear, conic as wedges) and flattens the plane's motion path (Chrome measures it from the box's own top-left).
- **The rules** (in the RN hooks):
  - Entrance: decided when the settings arrive, once per app session per bot and entrance, not over an open chat or with reduced motion. Hold the launcher invisible until `revealAt` (still tappable; a tap ends it), play `arrive`, keep the greeting hidden until `settleAt`, then fade it up (`SETTLE_REVEAL`). It is `busy` until then.
  - Attention: the clock starts when the launcher (or, for wave / float, the card) shows and no entrance is busy; it pauses during a launcher idle / message moment; over once the chat opens; not started within 30 minutes of an opening. A launcher mode holds the idle moments (they still count) and the three load ripples (not a message's).
  - Idle call: after the delay, retry every 4s while blocked (chat open, app in the background, keyboard up, entrance busy, greeting up less than 15s). Two calls per app session 3 minutes apart, then a 3-day rest in storage (also after an opening); closing the greeting stops calls for the session. No bubble while the greeting is up. Knock and tap draw in front of the launcher, the others behind it.
- **Drawing:** RN samples the evaluator every 16ms into native-driven interpolations of one clock per effect (nothing re-renders while they play). Filters (brightness, glows, blur, the bevel) have no react-native-svg counterpart and are left out. On the web, a left-hand launcher's mascot loses its mirror while it slides (the slide's `scale` replaces it) and the coin's gloss sits at the button's left edge until its sweep; both are kept as the web plays them.

### Porting the greeting card (from RN)

- **`src/core/greeting.ts`** is pure and tested. Port it with its tests.
  - `decideGreeting(c, facts)` picks the card:
    - The app counts as path "/". Rules for given pages, countries, sources, page attributes or browser-only behaviour never apply.
    - The rest are checked for audience (new/returning, signed in), schedule, `minVisits`, chatted, and their own limits (`maxShows` within `windowDays`, `quietDaysAfterDismiss`). They are ranked by priority, then by order.
    - A "show nothing" rule silences the card. A smart rule (sgpric, sgads0, sgretn, sgengd, sgcust, sgchko) gives way when the owner's own talking rule applies.
    - The legacy `proactivePrompt*` teaser has a delay of 8. Text is capped at 140 characters.
  - `frequencyAllows`:
    - page: 300s rest after a close or after the chat opens.
    - session: once per app session.
    - visitor: once every N days.
- **`FloatingWidget/useGreeting.ts`** holds the state, stored per bot as `{visits, chatted, shows, dismissed, closedAt, shownAt, last}`.
  - Visits are counted once per app session.
  - The X calls `dismiss()`, which records a dismissal of that rule. Tapping the card calls `closeForNow()`, which only rests it.
  - Opening the chat sets `chatted` and rests the card.
  - Signed in means the visitor context has an id or email.
- **`FloatingWidget/GreetingCard.tsx`** draws the 11 styles: card, note, imessage (default), postcard, sticky, typewriter, glass, notification, neon, voice, aurora. The geometry, colours, reveal timings and native font fallbacks are in RN's `docs/greeting-card-native-spec.md`.

## Conventions

- One commit per file: `feat|fix|style|test|docs|ci(scope): ... (#issue)`.
- One GitHub issue per bug, in this repo. Close it with the commit hashes.
- Update the README in the same batch.
