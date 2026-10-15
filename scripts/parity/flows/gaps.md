# Flow-node gaps per SDK (2026-10-15)

This compares each SDK's flow engine, as it is today, against `nodes.spec.json` and the fixtures.

- **How it was found:** by reading each SDK's code. React Native, Flutter, Android and iOS now run all 156 fixtures (`__tests__/parity/flows.test.ts`, `test/parity/flows_test.dart`, `FlowFixturesTest.kt`, `FlowFixtureTests.swift`, all pass), so their sections list only what remains; iOS has not run them yet. Paths are relative to each SDK repo.
- **Spot-checks:** I re-read the items marked ✓ myself.
- **No SDK code was changed** for this report.
- **Severity:**
  - **S1:** a visitor gets past a gate (payment, OTP, consent, a condition), or real flows stop or take the wrong branch.
  - **S2:** wrong data stored or shown.
  - **S3:** cosmetic or timing.

## All four SDKs

The same gaps appeared in every SDK; React Native, Flutter, Android and iOS have fixed all of them (see their sections). File these once per repo.

| # | Area | Web (spec) | SDKs today | Fixtures |
|---|---|---|---|---|
| A1 S1 | Rich steps | `dynamic-choices`, `hidden-fields`, `consent`, `product-card`, `slider`, `datetime`, `ranking`, `otp`, `address`, `matrix`, `ai-extract`, `ai-route`, `kb-answer`, `signature` and `payment` are drawn and validated, and each leaves by its own handles. | None has a handler, so each step is skipped along a default edge. That edge is usually `source`, which is the verified, paid, agreed or found path. **A visitor gets past payment, OTP and required consent.** | `otp.*`, `payment.*`, `consent.*`, `kb-answer.*`, `ai-route.*` |
| A2 S1 | Loops and sub-flows | `loop-node` uses `source-loop`/`source-done`. `subflow-node`, `run-subflow-node` (call stack, inputs/outputs, `source-error`) and `subflow-return-node` are supported. | None. | `loop.*`, `subflow.*` |
| A3 S1 | Missing exact handle | The chat ends (`engine.port`). | RN takes the first edge from the node. Android and Flutter take the next node in array order. iOS takes a default-handle edge, then any edge. All of them can land on a branch the web never takes. | `engine.port-not-wired-ends-chat`, `ai-route.intent-not-wired-no-fallback-ends` |
| A4 S1 | Start node | The first `welcome-node` in `nodes[]` (`engine.start`). | RN, Android and Flutter start at `nodes[0]`. iOS tries `START`, then `isStart`, then a node with no incoming edges, then `nodes[0]`. | `engine.start-first-welcome` |
| A5 S2 | Unknown variable in text | Shown as nothing, and the gap is tidied (`engine.interpolation`). | All four keep the literal `{name}`. None supports `$${x}` or `${ANSWERS.x}`, none HTML-escapes, and lists are not shown as "a, b". | `interpolation.*` |
| A6 S2 | Masking | Card numbers, IBANs and the like are masked in variables and records unless `redactSensitive === false`. | No SDK masks. | `variables.sensitive-values-masked` |
| A7 S2 | Mailchimp / Segment / Salesforce | Wait for the server result, then follow `source` or `source-failure` (falling back to success). | Missing, or treated as fire-and-forget. | `result-integration.*` |
| A8 S2 | Legacy two/three-choices | `choiceText1..3` | All four read `choice1..3`, so the buttons are blank or missing. ✓ (RN, iOS) | `legacy.two-choices`, `legacy.three-choices` |
| A9 S2 | Pacing | Typing time uses the `paceFor` formula. The name greeting and each multi-question get 2000 ms of typing. Images and video advance on load, or after 4000 ms at most. | Each SDK uses its own fixed delays (500, 800 or 1000 ms) instead. | `shown` in every fixture |
| A10 S1 | GPT / webhook secrets | The server makes the GPT call; the widget never receives `apiKey`. | RN, iOS and Flutter call OpenAI from the device with `data.apiKey`. The server now strips that key, so this path is broken, and it should never have been there. RN also runs webhooks from the device. | `gpt.*` |

## React Native

All 156 fixtures pass through `src/core/NodeFlowEngine.ts` and the handlers in `src/core/nodes/handlers/*` (`__tests__/parity/flows.test.ts`); none is pending. The A1-A10 and RN1-RN23 gaps found by reading are fixed (#33-#38, #52, #61-#63). What remains is outside what the fixtures check:

| # | Area | Web | RN today |
|---|---|---|---|
| RN1 S3 | Rich step UI | Each rich step draws its own card (`richNodesView.ts`). | Drawn through the existing UI states: consent as two buttons (no checkbox), ranking as buttons tapped in order (no drag), matrix as the form (one select per row), OTP / AI / KB / signature in the text input, address in the location picker (the typed address is the street line). The handlers also take the card actions (OTP skip and resend, address search and pick, a drawn signature's image), but the default UI offers no Skip on OTP, no address suggestions list and no drawing pad. |
| RN2 S3 | signature-node | A typed name is drawn on a canvas and uploaded as PNG. | Uploaded as an SVG of the typed name (`typedSignatureSvg`); a drawn signature needs the UI to hand over the image. |
| RN3 S3 | hidden-fields-node | The page's query, URL and referrer. | An app has no page: nothing is captured unless the engine is given `page` (headless use). |
| RN4 S2 | webhook-node | Called from the browser (spec `webOnly`: SDKs should leave it to the server). | Still called from the device, in the background, as before; the flow no longer waits for it. |
| RN5 S3 | google-calendar-node "book" | A slot picker. | Waits for the server's result, then moves on (spec `webOnly`). |
| RN6 S3 | Pacing | Media move on when they load. | Images move on at load through `engine.mediaSettled` (wired in `MessageList`); a video has no inline player, so it moves on at once. |

## Android

All 156 fixtures pass through `core/NodeFlowEngine.kt` and the handlers in `core/nodes/handlers/*` (`FlowFixturesTest`, one JUnit case each, on a virtual clock; the fixtures are copied by `scripts/sync-flow-fixtures.sh`); none is pending. The A1-A10 and AN1-AN23 gaps found by reading are fixed (conferbot-android #29-#34, #54, #64-#67; #48 stays open for native cards). What remains is outside what the fixtures check:

| # | Area | Web | Android today |
|---|---|---|---|
| AN1 S3 | Rich step UI | Each rich step draws its own card (`richNodesView.ts`). | Drawn through the existing cards: consent, dynamic choices, product card, payment and navigate as choices; slider as the range; date/time as the calendar; ranking as multiple choice; OTP, AI, KB, signature and address as the text box; matrix as the multiple-questions card. No drawing pad, no address results list, and a choice can't open a link or Checkout yet (#48). |
| AN2 S3 | signature-node | A typed name is drawn on a canvas and uploaded as PNG. | Uploaded as an SVG of the typed name; a drawn signature needs the UI to hand over the image. |
| AN3 S3 | hidden-fields-node | The page's query, URL and referrer. | Nothing is captured unless the engine is given a page (`NodeFlowEngine.Config.pageUrl`). |
| AN4 S2 | webhook-node | Called from the browser (spec `webOnly`). | Still called from the device, in the background; the flow no longer waits for it. |
| AN5 S3 | google-calendar-node "book" | A slot picker. | Waits for the server's result, then moves on (spec `webOnly`). |

## iOS

All 156 fixtures pass through `Sources/Conferbot/Core/NodeFlowEngine.swift` and the handlers in `Core/Nodes/Handlers/*` (`Tests/FlowFixtureTests.swift`, with the driver in `Tests/FlowFixtureDriver.swift` modelled on RN's); none is pending. The IO1-IO20 gaps found by reading are fixed (conferbot-ios #26-#31, #52, #53, #64, #67-#70; #45 stays open for the UI). What remains is outside what the fixtures check:

| # | Area | Web | iOS today |
|---|---|---|---|
| IO21 S3 | Rich step UI | Each rich step draws its own card. | The stock ChatView draws button steps as pills (choices, yes/no, consent, payment, navigate, dynamic choices, quiz) and composer steps in the text field (ask-*, OTP, AI, KB, signature by typed name, address as the street line). No view yet for rating, opinion scale / slider, calendar / datetime, file upload, multi-choice (n-check-options, ranking), cards (carousel, product) or the matrix (`.rich`); a custom UI answers them through `handleNodeInput` / `handleButtonClick` / `handleMultipleChoiceSelection` (#45). |
| IO22 S3 | signature-node | A typed name drawn on a canvas, uploaded as PNG. | Uploaded as an SVG of the typed name, as RN; a drawn signature needs the app to hand over the PNG (`["image": Data]`). |
| IO23 S3 | hidden-fields-node | The page's query, URL and referrer. | Nothing is captured unless the engine is given `Config.page`. |
| IO24 S2 | webhook-node | Called from the browser (spec `webOnly`). | Still called from the device in the background, as RN; the flow does not wait for it. |
| IO25 S3 | Pacing | Media move on when they load. | Images and videos move on at the 4000 ms cap unless the app calls `mediaSettled(nodeId:)`; the stock bubbles don't call it yet. |

## Flutter

All 156 fixtures pass through `lib/src/core/node_flow_engine.dart` and the handlers in `lib/src/core/nodes/handlers/*` (`test/parity/flows_test.dart`, a port of the RN driver with a Zone-based virtual clock); none is pending. The A1-A10 and FL1-FL18 gaps found by reading are fixed (conferbot-flutter #23, #29-#34, #48, #55, #66-#70). The engine, `core/flow/*` and the handlers are ports of RN's. What remains is outside what the fixtures check:

| # | Area | Web | Flutter today |
|---|---|---|---|
| FL1 S3 | Rich step UI | Each rich step draws its own card (`richNodesView.ts`). | Native cards for carousel and product card, slider, ranking (up/down buttons, no drag), matrix (chips per row), address (search list and manual form, no map), payment (Pay now, I've paid, Cancel), date/time. Consent, dynamic choices and navigate draw as buttons; OTP, AI, KB and signature use the bottom bar, and OTP shows its Skip chip. No OTP digit boxes and no signature drawing pad (#48). |
| FL2 S3 | signature-node | A typed name is drawn on a canvas and uploaded as PNG. | Uploaded as an SVG of the typed name, as RN; a drawn signature needs the UI to hand over the image. |
| FL3 S3 | hidden-fields-node | The page's query, URL and referrer. | An app has no page: nothing is captured unless the engine is given `NodeFlowEngineConfig.page` (the provider passes none). |
| FL4 S2 | webhook-node | Called from the browser (spec `webOnly`). | Called from the device in the background, as RN; the flow does not wait for it. |
| FL5 S3 | google-calendar-node "book" | A slot picker. | Waits for the server's result, then moves on (spec `webOnly`). |
| FL6 S3 | Visitor time zone | The browser's IANA zone. | Dart does not expose the device's IANA name: the device's offset as a fixed `Etc/GMT` zone unless `NodeFlowEngineConfig.visitorTimeZone` is set (the provider does not set it). Owner zones (business hours, calendar) are IANA with DST through `package:timezone`. |
| FL7 S3 | Pacing | Media move on when they load. | Images move on at load through `engine.mediaSettled` (wired in `MessageBubble`); a video moves on once its player is drawn. |

## Suggested order of work (per SDK)

1. **Engine** (A3, A4 and each SDK's start/next items): exact ports, first edge, end on missing, unknown-node passing.
2. **Gates:** `payment-node`, `otp-node`, `consent-node`, `kb-answer`/`ai-route`, `condition-node` and `boolean-logic-node`.
3. **Field keys of the common steps:** n-choices, ask-*, yes-or-no, rating, opinion, image-choice, media, two/three-choices.
4. **Variables:** `answerVariable` registration, interpolation (A5), masking (A6).
5. Then the rest of the rich steps, loops/sub-flows and pacing.

Each item has fixtures (see the `fixtures` list of each node in `nodes.spec.json`). Wire up the driver described in README.md first, then fix in that order.
