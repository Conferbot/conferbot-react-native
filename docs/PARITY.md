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
| #28-#32, #58, #59 | Handover lifecycle: the Connecting line and its 4 outcomes, the 20s waiting signal, "Talk to a person" only while nobody is coming, the header's reply time, leaving the queue on the server, a live chat picked back up after a restart. Checked against the local embed-server (`live-chat-state`, `queue-self-resolve`, `agent-accepted`, `agent-left`, `chat-ended`). | `src/core/handoverState.ts`, `handoverWaiting.ts`, `replyTime.ts`, `handoverPayload.ts`; `context/hooks/useHandoverLifecycle.ts`, `MessageBubble`, `LiveChatCards` |
| #57 | Launcher entrance, attention and idle call. `keyframes.ts` evaluates the web's Web Animations tracks; checked against Chrome in 447 cases (19,275 samples). | `src/core/keyframes.ts`, `launcherEntrance.ts`, `launcherAttention.ts`, `launcherIdleCall.ts`, `mascotArt.ts`, `fxPaint.ts`; `FloatingWidget/useLauncherEntrance.ts`, `useLauncherAttention.ts`, `useLauncherIdleCall.ts`, `FxSprites.tsx`, `IdleCallView.tsx`, `fxAnimated.ts` |
| #33-#38, #52, #61-#63 | Flow nodes: the engine and every node handler run the shared flow-node spec. **156 of 156 fixtures pass** (`__tests__/parity/flows.test.ts`); none pending. See "Flow nodes" below. | `src/core/NodeFlowEngine.ts`, `src/core/flow/*` (text, logic, flowControl, rich, inputs, calendar, context), `src/core/privacy/redact.ts`, `src/core/nodes/handlers/*` |

## Left in this SDK

In order: home screen; mascots; i18n; sounds; celebrations; the rest of the reply-time wording (the home card's `homePeople`, the wait card's `typicalWait`; the header's `headerLine` is done). The web sources are listed below.

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
- **`flows/`:** the flow-node conformance spec shared by the 4 SDKs.
  - `nodes.spec.json` lists the 82 node types the widget runs: the keys each one reads, its handles, what it stores, and file:line citations.
  - `fixtures/` holds 156 cases. `gen.js` produced every one by running the widget's own code.
  - `gaps.md` lists where each SDK differs today.
  - Its README covers how to regenerate it (`node gen.js`, `--check`) and how each SDK's tests should use the fixtures.

## How to test

- **Unit tests:** `npx jest --maxWorkers=2` (2026-10-16: 74 suites, 2102 pass, 22 skipped), plus `npx tsc --noEmit -p .`.
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
| Handover lifecycle: Connecting line + outcomes, 20s waiting signal, Talk to a person rules, leave queue on the server, restore after restart (#28-#31, #58) | done | todo | todo | todo |
| Header: bot name + Online + reply time, Online again when a person joins (#32) | done | todo | todo | todo |
| Flow nodes: shared spec, 156 fixtures (`scripts/parity/flows/`) | 156/156, every step card native (#52) | todo | todo | todo |
| Home screen | todo | todo | todo | todo |
| Mascots (incl. `mascotInGreeting`) | todo | todo | todo | todo |
| `widgetLanguage` (i18n) | todo | todo | todo | todo |
| Message sounds | todo | todo | todo | todo |
| Celebrations / reactions | todo | todo | todo | todo |
| Reply-time wording (home card, wait card) | todo | todo | todo | todo |

Live chat / agent features (handover, queue card, receipts, rating, files, prefill, max-wait timeout, agent bot replies, suggestion chips) are done in all 4. The handover lifecycle above (#28-#32, #58) is the RN reference for the other three.

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

## Flow nodes

The flow engine follows `scripts/parity/flows/nodes.spec.json`, and `__tests__/parity/flows.test.ts` runs all 156 fixtures through the real `NodeFlowEngine` and `registerAllHandlers` registry: **156 pass, 0 pending** (the fixtures as of commit `2f0b2a6`, read in place).

- **The driver** (`__tests__/parity/flowDriver.ts`): a virtual clock (`setTimeout` / `setInterval` / `Date`, 2026-10-15 10:00 UTC, as `web/env.js`), `fetch` scripted from `server.http`, a fake socket answering `execute-integration` and `initiate-handover` from `server.integration` / `server.handover`, and each visitor action played through `engine.submitResponse` with the answer the SDK's UI sends. The engine reports what it does through `config.onTrace` (enter, port, shown, unsupported, error, end, crash).
- **Compared:** path (node, type, via), ports, variables (key + value), end, errors (count + node), answers (shape + value fields), rendered text, emits, unsupported, http (path + body keys), flowVariables, and the typing pace between shown steps within 50 ms.
- **Not compared, on purpose:**
  - The pace in 7 cases (`TIMING_SKIP`): the web harness plays the next action after its cards' own UI timers (focus 30-50 ms, the address search debounce, animations), which this SDK's native views don't have.
  - Times the visitor acted at (`consent_at`, `signature_at`): compared as timestamps.
  - Emits of `response-record` and `join-chat-room-visitor` (transport, not flow).
- **Engine rules** (spec `engine`): start at the first `welcome-node`; a step that does not branch takes its first edge; a branch takes its exact handle or ends the chat; a wired edge to a missing node stops the chat where it is; unknown types (and a welcome reached again) pass along their first edge; a jump to a missing node ends; rich steps' `goPort` fallback; loops and sub-flows; answer variables registered per step and saved by name; `{var}` unknown shows nothing; masking (`redactSensitive`); typing pace (`paceFor`) unless a fixed `typingDelay` is set; images and videos move on when they load (`engine.mediaSettled`) or at 4000 ms.
- **The step cards** (`src/components/NodeComponents/steps/`, #52): each step the web draws as a card has its own native card, picked by `stepViewFor(uiState)` from the step type the engine stamps on every waiting state (`stepType`, `stepData`). Consent (box to tick, links open), OTP (e-mail, six digit boxes, Resend after its wait, Change email, Skip), address (suggestions while typing, confirm; the fields by hand), signature (finger pad sent as SVG through `react-native-svg`, Undo / Clear, Type instead; typed name only without `react-native-svg`), ranking (drag by the handle or the arrows), matrix (each row's columns, n of total answered), payment (Pay now opens Checkout, I've paid, Cancel, time left), slider, date / time (a month of days, hours and minutes on `timeStep`), carousel / product cards (link buttons open their page, Continue with no path), picture choices. They use the bot's option colours, radius and font size. Not drawn: the address map and "Use my location" (no browser map or location in an app). `__tests__/components/FlowStepViews.test.tsx` plays every fixture action for these steps on the cards (22 cases) and compares the outcome as `flows.test.ts` does.

### Porting the flow engine (from RN)

Port `src/core/flow/*.ts` (pure; `logic.ts`, `flowControl.ts` and `rich.ts` are the web's files with only the i18n import changed), the engine's routing (`NodeFlowEngine.ts` `enter`, `next`, `port`, `jump`, `end`, `passUnknown`, `runFlowControl`) and the handlers, then a driver like `flowDriver.ts` in the SDK's test framework (the fixtures README lists one per platform). Start with the `engine.*`, `condition.*`, `interpolation.*` and choice cases.

### Porting the handover lifecycle (from RN, #28-#32, #58, #59)

The logic is pure and tested in `src/core/`; port each file with its test (`__tests__/core/handoverState.test.ts`, `handoverWaiting.test.ts`, `replyTime.test.ts`), then wire it the way `context/hooks/useHandoverLifecycle.ts` does. The web sources are `ts/chat/handoverState.ts`, `handoverWaiting.ts`, `quickActions.ts`, `replyTime.ts`, `headerPresence.ts`, `core/events/agentListeners.ts`, `ts/chat/handlers/special.ts` and the restore in `index.ts`.

- **`handoverState.ts`** reads the record. It never mutates: settling returns a new list, unlike the web.
  - `handoverPhase(record)`: `none`, `connecting` (an `agent-left-chat` with `handover: true` and no person since), or `joined` (a person's `agent-joined-message`; an AI join, `ai: true` or an `ai-agent-` id, does not count).
  - `talkToPersonAllowed` is `phase === 'none'`.
  - `isRepeatJoin(record, agentId)`: the same person again, so draw nothing.
  - The line's words come from `handoverLineText(settled)`: pending is "Connecting you with the team…"; the outcomes are `joined`, `unavailable`, `cancelled` and `ended`.
  - Restore runs `annotateRestoredHandovers` first. It settles lines whose outcome the record knows and marks a person's join after an AI handover `afterAI` (the note "They can see your conversation so far").
- **Socket readings:**
  - `agentLeftKind(data)`: `visitor_inactive` is `ignore` (draw nothing). `escalated`, `handover: true` or an AI leaver is `handover` (one Connecting line; a repeat while one is pending draws none). Anything else is a person who `left`.
  - `acceptedPlan(record, data)`: the outcome to settle (`joined` for a person; `unavailable` when the AI takes the chat back), whether to draw the join (not a repeat), and `afterAI`. Settle before the agent bot's silent-start check, as the web does.
  - `handover-waiting` and `no-agents-available` settle `unavailable`. `chat-ended` and `ai-agent-inactive-close` settle `ended`.
- **Leaving the queue (#58):**
  - Send `queue-self-resolve {chatSessionId}` and wait for the answer. `ok` leaves. `agent_joined` stays.
  - `not_waiting` is also what the server answers once a person has accepted (the ticket is then in progress, not open). Ask `live-chat-state`; `live` means stay (`queueLeaveNeedsState`, `queueLeaveResult`).
  - On leave: record `queue-self-resolved`, draw "You left the queue", settle `cancelled`, signal `cb:wait-over`, and move the flow on.
  - The server has no visitor end-chat and no `handover:*` events. End chat sends `queue-self-resolve`; the handover survey goes as `submit-chat-rating` (`surveyRatingPayload`).
- **Restore (#29):** a session restored from the device must not run its flow again before asking the server.
  - Join the room first (the server answers `live-chat-state` only for `socket.chatSessionId`). Then call `restoreNeedsLiveChatState(record, atHandover)` and `restoredLiveChat(state, record)`.
  - `restoreStep` says what to do. `live`: live mode, the agent, the join line it missed. `wait`: back on the handover step's wait without asking again (RN `NodeFlowEngine.waitAt`). `continue`: the flow carries on from the handover step. `ask`: run the step again. `start`: as before.
  - `atHandover` is the persisted current node being the `human-handover-node`.
- **`handoverWaiting.ts`:**
  - `createConnectingSignal(fire, canFire, setTimer, clearTimer)` fires `cb:waiting-for-human` 20s into a wait, once per wait. `end()` cancels it. While the chat is closed it re-checks every 2s.
  - Start it when a flow handover with no AI agents begins, when an AI escalates (`agent-left` handover), and when a restore finds the chat still waiting.
  - End it on `agent-accepted`, `handover-waiting` (the server's own signal), leaving the queue, nobody available, or the chat ending.
  - The signals go through a listener bus (`createSignalBus`); RN exposes it as `useConferBot().onWidgetSignal`.
- **`replyTime.ts`:**
  - `headerStatus(customizations.replyTime, { personInChat, agentBot })` is the header's line under the bot name.
  - Before anyone joins it shows the reply time ("Typically replies in a few minutes", "Online · team back Monday 9 AM", "Online · team replies by email"). Once a person is in the chat it shows plain "Online". An AI agent bot shows no reply-time line.
  - The header never switches to the agent.
- **`handoverPayload.ts` (#59):** `initiate-handover` carries the step's `enableHandoverEmail` (an explicit `false` is what keeps the team's email off), the sound settings, and `assignmentMethod` / `requiredSkills` when set.

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
