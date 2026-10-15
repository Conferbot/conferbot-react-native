# Flow-node gaps per SDK (2026-10-15)

This compares each SDK's flow engine, as it is today, against `nodes.spec.json` and the fixtures.

- **How it was found:** by reading each SDK's code. React Native now runs all 156 fixtures (`__tests__/parity/flows.test.ts`, all pass), so its section lists only what remains; Android, iOS and Flutter have not run them yet. Paths are relative to each SDK repo.
- **Spot-checks:** I re-read the items marked ✓ myself.
- **No SDK code was changed** for this report.
- **Severity:**
  - **S1:** a visitor gets past a gate (payment, OTP, consent, a condition), or real flows stop or take the wrong branch.
  - **S2:** wrong data stored or shown.
  - **S3:** cosmetic or timing.

## All four SDKs

The same gaps appeared in every SDK; React Native has fixed all of them (see its section). File these once per repo.

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

The engine is in `conferbot/src/main/java/com/conferbot/sdk/core/NodeFlowEngine.kt`. The handlers are in `core/handlers/*.kt`.

| # | Node / area | Web | Android today |
|---|---|---|---|
| AN1 S1 | start | first `welcome-node` | `steps[0]` (`NodeFlowEngine.kt:89`) |
| AN2 S1 | missing edge, port, target or unknown | ends | Falls back to `steps[currentIndex+1]`, the next node in array order ✓ (`NodeFlowEngine.kt:596-602`). Also accepts a handle without its `source-` prefix (`:623-625`) |
| AN3 S1 | condition-node | variable lookup by bare name, `customLeft/RightValue`, operator set | A bare name is compared as literal text (`state/ChatState.kt:738`). Missing operators: `not_equals`, `not_contains`, `starts_with`, `ends_with`, `does_not_match`, `is_set`, `is_not_set`; anything unknown is `==`. Always case-insensitive (`LogicNodeHandlers.kt:111`). Ports are right |
| AN4 S1 | random-flow-node | `source-<branch.id>`, wired branches only | `source-<index>`, no wiring check (`LogicNodeHandlers.kt:279`) |
| AN5 S1 | user-redirect-node | link CTA, auto-advance | Reads `url`, **opens the browser by itself**, and stalls with no callback (`ui/compose/NodeComponents.kt:2380-2385`, engine `:247-252`) |
| AN6 S1 | navigate-node | links + Done | Ignores `navigateOptions`/`doneNavigatingText` and moves on after 600 ms (`DisplayNodeHandlers.kt:304`) |
| AN7 S1 | quiz-node | `correctAnswer` = "optionN" | Parsed as an Int: "option3" becomes 0, so only option 1 scores (`LegacyNodeHandlers.kt:259`) |
| AN8 S1 | stripe-node | not a gate | A failure returns `shouldProceed = true`; the payment UI has no callback, so it stalls (`IntegrationNodeHandlers.kt`) |
| AN9 S2 | choice prompts | `questionText` (image, yes-no, rating, opinion), `selectPrompt`, `checkOptionsPrompt` | All read `choicePrompt`, so these prompts are blank (`ChoiceNodeHandlers.kt:235,304,363,424,489,557,617`) |
| AN10 S2 | yes-or-no default ids | `"1"`/`"2"` | `yes`/`no` (`ChoiceNodeHandlers.kt:504-505`) |
| AN11 S2 | rating-choice `ratingType` | 1..10 or `smiley` | Only `smiley` and `10`; anything else is 5 (`ChoiceNodeHandlers.kt:561-565`) |
| AN12 S2 | opinion-scale `from` | default 0 | default 1 (`ChoiceNodeHandlers.kt:614,655`) |
| AN13 S2 | answer variables | none without `answerVariable`; legacy never | Default keys (name, email, phone...) or nodeId everywhere |
| AN14 S2 | record shapes | `user-ask-phone-number-response`, `user-ask-custom-question-response`, `user-selected-check-options` | `user-ask-phone-response`, `user-ask-custom-response`, `user-check-options-response` (`AskQuestionNodeHandlers.kt:178,382`) |
| AN15 S2 | ask-name greeting | a bubble with the first name, capitalised, after 2000 ms; default text | Transcript only, full name, no default, 500 ms (`AskQuestionNodeHandlers.kt:65-72`) |
| AN16 S2 | phone / number / url validation | 6-15 digits normalised; "1,200"; bounds; bare host -> https | `^[+]?[0-9]{7,15}$` on raw input; `toDouble`; no bounds; URI with a scheme required (`NodeHandler.kt:511-520`) |
| AN17 S2 | ask-file | `allowedFileTypes`, `maxFileSizeMB`, optional Skip | `allowedTypes`/`acceptedFileTypes`, `maxSize`, no Skip (`AskQuestionNodeHandlers.kt:408,593`) |
| AN18 S2 | ask-multiple-questions-node | each answer under its `answerVariable` | `<nodeId>_q<i>` keys (`AskQuestionNodeHandlers.kt:664,737`) |
| AN19 S2 | calendar-node | `calendarPrompt`, `timeZone`, `weeklyHours` | `questionText`, `botTimeZone`/`timezone` (`AskQuestionNodeHandlers.kt:773`) |
| AN20 S2 | math-operation-node | saved to `answerVariable`; ÷0 gives "" | `resultVariable`; ÷0 gives 0 (`LogicNodeHandlers.kt:212`) |
| AN21 S2 | jump-to-node | `nodeId` first; a missing target ends | `targetNodeId` first; a missing target proceeds to the next node (`LogicNodeHandlers.kt:334-341`) |
| AN22 S2 | human-handover `maxWaitTime` | default 2 | default 5 (`SpecialNodeHandlers.kt:115`) |
| AN23 S3 | delay / message | nothing shown; blank skipped | Shows typing during the delay. Skips a message equal to the last choice |

## iOS

The engine is in `Sources/Conferbot/Core/NodeFlowEngine.swift` (NFE). The handlers are in `Core/Nodes/Handlers/*.swift`.

| # | Node / area | Web | iOS today |
|---|---|---|---|
| IO1 S1 | message / image / video / audio / file / html / redirect | auto-advance | Each returns `.displayUI(...)` and nothing advances it, so **the flow stalls after the first message** ✓ (`DisplayNodeHandlers.swift:104-107`; NFE `:244-256`) |
| IO2 S1 | "end" check | only the end of a path ends the chat | `nodeType.lowercased().contains("end")` ends the flow, which catches **`calendar-node`** and `google-calendar-node` ✓ (NFE `:715-718`) |
| IO3 S1 | n-choices-node | `choices[].choiceText` | Reads `buttons`/`options`/`actions` with `label`/`text`, so real n-choices nodes error and halt (`DisplayNodeHandlers.swift:753,763`) |
| IO4 S1 | condition-node | flat `leftValue`/`rightValue`...; `source-0`/`source-1` | Needs `data.conditions[]`, else an error. Ports are `"true"`/`"false"`, which never match, so it falls back to any edge (`LogicNodeHandlers.swift:189,205`) |
| IO5 S1 | boolean-logic / business-hours | `source-0`/`source-1` from the flow edges | Look in `node["edges"]`, which flow nodes never carry, so they mostly take the false/closed path (`MissingNodeHandlers.swift:588,780`) |
| IO6 S1 | rating / opinion | value ports | An Int input uses no port, so the default list picks `source-1` (NFE `:727`) |
| IO7 S1 | two-choices-node | choice 2 -> `source-2` | ids "0"/"1", so choice 2 matches `source-1`, which is choice 1's branch |
| IO8 S1 | port matching | exact | `sourceHandle.contains(port)`: "1" matches "source-10"; then a default edge, then any edge (NFE `:550,573-592`) |
| IO9 S1 | random-flow-node | `branches` | Reads `variants`/`options`, so it errors (`LogicNodeHandlers.swift:381`) |
| IO10 S1 | html-node / navigate-node | `data.html`; `navigateOptions` | Reads `embedUrl`/`url`, so both error (`DisplayNodeHandlers.swift:1060`, `MissingNodeHandlers.swift:501`) |
| IO11 S2 | answer variables | by `data.answerVariable` | Never read; answers are stored by nodeId, so `{name}` never resolves (`ChatState.swift:133`) |
| IO12 S2 | prompts | `questionText`, `choicePrompt`, `selectPrompt`, `checkOptionsPrompt`, `calendarPrompt` | None read; uses `message`/`text` |
| IO13 S2 | rating / opinion keys | `ratingType`; `from`/`to`/`fromLabel`/`toLabel` | `maxRating`/`style`; `min`/`max`/`minLabel` (`DisplayNodeHandlers.swift:914-968`) |
| IO14 S2 | ask-multiple-questions-node | every question in turn | Only `questions[0]` (`MissingNodeHandlers.swift:304`) |
| IO15 S2 | calendar-node | weekly hours, slots, zone | Reads only `mode` (`NodeHandlerRegistry.swift:417`) |
| IO16 S2 | jump-to-node | `nodeId`/`targetNodeId`/`jumpTo` | Never reads `jumpTo`; a missing target stalls with an error (`MissingNodeHandlers.swift:662`) |
| IO17 S2 | human-handover-node | pre-chat questions, `fallbackMessage` | Not read (`IntegrationNodeHandlers.swift:2146-2177`) |
| IO18 S2 | validation | as web | Loose phone check ("1" passes); URL needs a scheme; no number bounds; no custom error texts; no name greeting (`NodeHandler.swift:132-156`) |
| IO19 S2 | UI | every node type | ChatView draws only choice pills, the handover card and text (`ChatView.swift:381-418`); `NodeRenderer` is unused |
| IO20 S2 | handler outputs | n/a | Generic variables (`result`, `withinBusinessHours`...) overwrite user variables (NFE `:281-286`) |

## Flutter

The engine is in `lib/src/core/node_flow_engine.dart`. The handlers are in `lib/src/core/nodes/handlers/**`. The renderer is in `lib/src/ui/widgets/node_widgets.dart`.

| # | Node / area | Web | Flutter today |
|---|---|---|---|
| FL1 S1 | node type lookup | `node.type` | Reads `data['type']` first ✓ (`node_flow_engine.dart:232`), so `user-input-node` with `data.type:"email"` finds no handler. The answer path reads only `data['type']` (`:593`), but saved nodes keep `type` on the node, so **no answer handler runs on builder data**. Test fixtures put `type` inside `data` and hide this (`test/fixtures/test_fixtures.dart:211`) |
| FL2 S1 | start | first `welcome-node` | `_steps[0]` (`:183`) |
| FL3 S1 | missing handle, target or unknown | ends | The next node in array order (`:741-753,270-279`); also matches without the `source-` prefix (`:782`) |
| FL4 S1 | cycle guard | none | 100 distinct nodes stop the flow (`:41,218`), which cuts off big bots |
| FL5 S1 | condition-node | bare variable names looked up | Compared as literal text; `customLeftValue`/`customRightValue` ignored; operators missing as on Android (`logic_handlers.dart:21`) |
| FL6 S1 | stripe / payment | payment-node is a gate | stripe takes the first edge with no paid check. The composer stays visible, so typed text gets past the payment (`other_handlers.dart:181-192`, `conferbot_provider.dart:1585`) |
| FL7 S1 | typed text on choice nodes | ignored by choices | Sends `source-<typed>`, which falls back to the next node in array order |
| FL8 S1 | redirect / navigate / n-select / image-choice / rating / opinion UI | drawn | Legacy UI states the renderer doesn't handle: nothing is drawn (`node_widgets.dart:117-140`). Redirect and navigate stall |
| FL9 S1 | quiz-node | "optionN" | Parsed as an int (`legacy_handlers.dart:562`) |
| FL10 S1 | random-flow-node | `source-<branch.id>` | `source-<index>`, no wiring check (`logic_handlers.dart:246`) |
| FL11 S2 | math-operation-node | saved by name | `setAnswerVariable(nodeId)` finds no entry, so the result is lost (`logic_handlers.dart:181`) |
| FL12 S2 | two/three-choices, prompts | `choiceText1..3`; `questionText`/`selectPrompt`/`checkOptionsPrompt` | `choice1..3`; prompts not read |
| FL13 S2 | yes-or-no ids / rating type / opinion `from` | "1"/"2"; 1..10; 0 | yes/no; only smiley or 10; 1 |
| FL14 S2 | ask-* validation and storage | as web | Default variable keys; phone 7-15 digits, not normalised; `double.tryParse`; URL needs a scheme; name greeting 500 ms, transcript only (`ask_question_handlers.dart:43-257`) |
| FL15 S2 | ask-multiple-questions / calendar / ask-file | as web | `<nodeId>_q<i>` keys, no `data.message`; `questionText`/`botTimeZone`; `maxSize` (`ask_question_handlers.dart:365-616`) |
| FL16 S2 | jump-to-node | `jumpTo` read; a missing target ends | `jumpTo` not read; a missing target moves to the next node (`logic_handlers.dart:301-304`) |
| FL17 S3 | business-hours zones | IANA with DST | A fixed offset table with no DST (`logic_handlers.dart:433`) |
| FL18 S3 | pacing | `paceFor` | 800 ms after every auto-advance node (`:433`) |

## Suggested order of work (per SDK)

1. **Engine** (A3, A4 and each SDK's start/next items): exact ports, first edge, end on missing, unknown-node passing.
2. **Gates:** `payment-node`, `otp-node`, `consent-node`, `kb-answer`/`ai-route`, `condition-node` and `boolean-logic-node`.
3. **Field keys of the common steps:** n-choices, ask-*, yes-or-no, rating, opinion, image-choice, media, two/three-choices.
4. **Variables:** `answerVariable` registration, interpolation (A5), masking (A6).
5. Then the rest of the rich steps, loops/sub-flows and pacing.

Each item has fixtures (see the `fixtures` list of each node in `nodes.spec.json`). Wire up the driver described in README.md first, then fix in that order.
