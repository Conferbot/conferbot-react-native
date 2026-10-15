# Flow-node conformance spec

This folder is the reference for how a bot flow runs. All four SDKs (React Native, Android, iOS, Flutter) test their flow engine against it.

- **The truth is the web widget.** It is `conferbot-widget/src`, run as is.
- **Node data is what the builder saves.** That means `chatbot.elements[0].nodes` and `.edges`, with real examples taken from a database.

| File | What it is |
|---|---|
| `nodes.spec.json` | Every node type the widget runs (82 of them). For each one: the keys it reads, in the widget's order, with defaults and fallbacks; what it shows; the input it accepts and how it validates; the handle each outcome leaves by; what it stores; timing; and the behaviour on a missing edge. Every rule cites `file:line`. The `engine` section covers the rules all nodes share: start, next edge, ports, unknown nodes, ending, answer variables, interpolation, typing pace and masking. |
| `fixtures/*.json` | 156 conformance cases. Each one is a small flow in the saved shape, plus what the visitor does and what the widget did. `fixtures/index.json` lists them. |
| `gaps.md` | Where each SDK differs from the spec today, with file:line evidence. |
| `samples/` (**local only, git-ignored**) | `real-nodes.json`: for every node type in the database, how many nodes, which data keys and how often, which handles, and one example. `bot-*.json`: whole flows of our QA bots. `export.js` writes them on your machine; they are never committed. |
| `anon.js` | Turns real node data from other people's bots into same-shape stand-ins (see "Customer data"). |
| `spec.src.js`, `cases.src.js` | The sources `gen.js` builds from. |
| `gen.js`, `export.js`, `web/` | The generators and the harness that runs the widget (see "How it was made"). |

## How it was made

1. **`export.js` reads real data.** It only runs `find()` against MongoDB; it never writes. It reads `chatbots` and `flowversions` and writes the local `samples/`. Secrets, credential ids and e-mail addresses are scrubbed, and every node from a bot that is not one of our own QA bots is anonymised (`anon.js`, below). The cases reuse that real node shape, and our own QA bots run whole: "QA - All Nodes", the legacy quiz bot "testing", "all nodes test", "Condition Node Test" and "Answer Vars Test".
2. **`spec.src.js` was written by reading the widget, the builder and the server.**
   - Widget: `index.ts`, `ts/chat/displayStep.ts`, `ts/chat/handlers/*`, `ts/chat/richNodes*.ts`, `ts/chat/flowControl*.ts` and `ts/chat/nodeLogic.ts`/`nodeKit.ts`.
   - Builder: `store/dndNodes.ts`, `utils/richNodes.ts`.
   - Server: `embed-server/src/utils/widgetFlow.js`.

   A citation is written as `{ f, a }`, a file and a piece of text on the line. `gen.js` finds the line again on every run. If the text has moved or gone, it fails, so `file:line` never goes stale silently.
3. **Every fixture's `expect` comes from running the widget, not from reading it.** `gen.js` starts each case in a fresh Node process (`web/runOne.js`):
   - **Run unchanged:** the widget's own TypeScript, transpiled with the widget's `typescript`:
     - `ts/chat/displayStep.ts`, which draws every step;
     - every handler in `ts/chat/handlers/` (answers, validation, ports, conditions, math, business hours, integrations, handover);
     - `richNodesView.ts` and `richNodes.ts` (all rich steps);
     - `flowControlRun.ts` and `flowControl.ts` (loops and sub-flows);
     - `nodeLogic.ts` and `nodeKit.ts` (interpolation, pacing, validators), privacy masking and `i18n` (English).
   - **Replaced:**
     - **`src/index.ts`, the engine module with sockets and storage.** It is replaced by `web/runtime.js`, a function-by-function copy with line citations. It covers `_findAndDisplayNode`, `_findAndDisplayNodeWithPort`, `_passUnknownStep`, `_handleJumpToNode`, `_nodeCategorizeHelper`, `_setAnswerVariable`, `_pushDataToRecord` and the start/end logic. This is the only part that was read and copied rather than run. Its routing decisions are small and are cited in `nodes.spec.json` → `engine`.
     - **The socket** (`web/fakeSocket.js`). It records emits and answers `execute-integration` and `initiate-handover` from the case's `server` script.
     - **Supporting stand-ins:**
       - The DOM is jsdom, and visitor actions are real clicks on the controls the widget drew (`web/driver.js`).
       - `fetch` returns the responses scripted in the case's `server.http`.
       - The clock is virtual, so every delay is measured exactly.
       - The canvas is stubbed so the signature step can export a PNG.
   - So `provenance: "executed"` means the widget's code produced the outcome. All 156 cases are executed. `"read"` is supported for cases the harness can't drive (`expect` is then hand-written); none are needed yet.

   Running the code changed the spec in places where reading had suggested otherwise:
   - The native integrations (gmail, hubspot, sheets...) do **not** wait for the server.
   - A jump to a missing node **ends** the chat; it does not stall.
   - The email-node sends **nothing** when it is reached by a jump.

## Fixture format

```jsonc
{
  "id": "n-choices.port-is-choice-id",
  "title": "...what the case shows...",
  "covers": ["n-choices-node"],            // node types it exercises
  "provenance": "executed",                 // or "read"
  "source": "QA bot \"all nodes test\"",   // or "real node shape (anonymised)", or absent: synthetic
  "customizations": { "redactSensitive": false },   // optional
  "server": {                               // optional scripted backend
    "http": { "otp/send": { "status": 200, "body": {...} }, "ai/route": [ {...first call}, {...second} ], "media": {...}, "gpt": {...} },
    "integration": { "<nodeId or nodeType>": { "success": true, "answerVariable": "x", "answerValue": 1 } | "none" },
    "handover": "no-agents"
  },
  "random": [0.8],                          // Math.random() sequence (random-flow)
  "visitorTimeZone": "UTC",                 // default UTC
  "flow": { "nodes": [...], "edges": [...] },   // exactly the saved shape
  "inputs": [ { "at": "c", "do": "choose", "id": "e923..." } ],
  "expect": { ... }                         // written by gen.js
}
```

Fixed context for every case:
- The clock is **2026-10-15 10:00:00 UTC**, a Thursday.
- The visitor's time zone is UTC and their language is `en-US`.
- The page is `https://shop.example/pricing?utm_source=newsletter&utm_campaign=fall` and the referrer is `https://www.google.com/`; hidden-fields cases read these.
- The bot id is `qa-bot` and the session is `qa-session`.

### `inputs[].do`: visitor actions

`at` is the step that must be waiting when the action is played. The SDK test driver maps each action to its own UI or engine API.

| do | fields | meaning |
|---|---|---|
| `text` | `value` | type and send in the composer (trimmed; blank is ignored) |
| `choose` | `id` / `index` / `value` / `buttonId` | `id` for n-choices, n-select, image-choice and yes-or-no. `index` (0-based) for two/three-choices, select-option, quiz and dynamic-choices. `value` for rating-choice, opinion-scale and user-rating. `buttonId` for carousel and product-card; no `buttonId` means Continue. |
| `check` | `ids` | n-check-options: tick these, then Done |
| `file` | `name`, `size`, `type` | pick a file (uploaded to `server.http.media`) |
| `skip` | | ask-file Skip |
| `navigateLink` / `navigateDone` | `index` | navigate-node |
| `date` | `value` | legacy date box `YYYY-MM-DD` |
| `calendar` | `date`, `slot?` | calendar day and slot start (`09:30`) |
| `consent` | `agreed` | tick (or not), then Continue |
| `slider` / `datetime` | `value` | set the value, then submit (`datetime`: ISO `2026-10-19`, `14:30`, `2026-10-19T14:30`) |
| `rankingMove` / `rankingSubmit` | `id`, `dir` (-1 up, 1 down) | ranking |
| `matrix` | `cells: {rowId: colId \| [colIds]}`, `submit?` | tick cells, then Submit |
| `otpEmail` / `otpCode` / `otpSkip` | `email` / `code` | OTP; six digits verify by themselves |
| `addressManual` | `line1`, `city`, `region`, `postal`, `country` | manual address |
| `addressSearch` / `addressPick` | `q` / `index` | search, then pick and confirm |
| `signTyped` / `signEmpty` | `name`, `fullName?` | typed signature / Sign with nothing |
| `payOpen` / `payCancel` | | payment: open Checkout / cancel |
| `wait` | `waitMs` | let time run (intervals included), e.g. for the payment timeout |
| `serverEvent` | `event`, `payload` | a socket event from the server |

### `expect`: what the widget did

| key | content | SDK tests should |
|---|---|---|
| `path` | Each node entered, in order: `{node, type, via, t}`. `via` is `start`, `edge:<handle>` (first edge), `port:<handle>` (exact handle) or `jump`. | **match exactly** (node order and `via`) |
| `ports` | Each exact-handle lookup: `{node, handle, wired}`. `wired:false` means the chat ended there. | **match exactly** |
| `variables` | The answer-variable list in order, `{key, value, nodeId}`. Placeholders still `null` are included. | **match key and value** (value types matter: numbers stay numbers). `nodeId` is advisory. |
| `end` | `{ended:true, t}`, or `{ended:false, waitingAt, type}`, or `{crashed:true, at}` | **match** `ended` / `waitingAt` |
| `errors` | Validation messages, in order: `{node, message}` | **match the count and the node**; the wording is English i18n, so match it only if the SDK uses the same strings |
| `answers` | The visitor's record entries, minus times and copies of the node data: `{id, shape, ...values}` | match `shape` and the value fields (`selectedChoice`, `value`, `text`...) |
| `rendered` | Each node's own text with variables filled in, as `html` and `plain` | match `plain` (interpolation, gap tidying) |
| `drawn` | Every text the step drew: prompt, option labels, card text | `drawn.text` should contain the SDK's prompt and option labels. Labels and helper copy are informative. |
| `shown` | Virtual ms at which each step's content appeared (after the typing dots) | match the delay between steps within ±50 ms, or skip if the SDK paces differently on purpose |
| `transcript` | `[{by, message}]`: raw prompts, typed answers | informative |
| `http` | Each server call `{path, body}` (path after `/api/v1/bot/:botId/`) | match `path` and the body keys for OTP, AI, KB, payment, address and GPT |
| `emits` | Socket events, except `response-record` | match the event names |
| `unsupported` | Unknown node types passed | match |
| `flowVariables` | The widget's separate `variables` map (only the legacy quiz score uses it) | match if the SDK supports quiz scoring |

## Using the fixtures in an SDK

Each SDK needs a small headless test driver around its own flow engine. The driver:

1. Loads the case's `flow`, then starts the engine. Use a virtual clock (fake timers) and the case's `customizations`.
2. Answers network calls from `server.http`, keyed by the path after `/api/v1/bot/:botId/`. When a key holds a list, call *n* gets item *n*, and the last item repeats. Missing `media` returns `{url: "https://api.test/media/qa-file"}`; anything else missing is a network error. It also answers socket events from `server.integration` and `server.handover`, and returns `random` from the engine's random source.
3. For each input, runs timers until the engine waits for the visitor, checks the waiting step is `at`, and then plays `do` through the engine's input API. That means a choice id, typed text, a file result, or a rich-step submit.
4. Records the same things as `expect`, then compares the keys marked **match** above.

Where to put them. Copy `fixtures/` into the SDK, the same way the icon and theme data is synced: commit the copy, and note in the SDK's PARITY.md which RN revision it came from.

- **React Native (jest):** done - `__tests__/parity/flows.test.ts` reads the fixtures in place, with its driver in `__tests__/parity/flowDriver.ts`: a virtual clock like `web/env.js` (it skips intervals when settling, which jest's fake timers can't), a scripted `fetch` and a fake socket. 156 of 156 pass. Use it as the model for the other three.
- **Android (JUnit):** put them in `conferbot/src/test/resources/flows/` and load each with `javaClass.classLoader.getResource("flows/$file")`. Use a JUnit 5 `@TestFactory` / `DynamicTest` per case, or `@ParameterizedTest @MethodSource`. Drive coroutines with `kotlinx-coroutines-test` (`runTest`, `advanceUntilIdle`) and mock HTTP with OkHttp `MockWebServer` or a fake API client.
- **iOS (XCTest):** put them in `Tests/ConferbotTests/Resources/flows/` (`resources: [.copy("Resources/flows")]` in Package.swift) and load from `Bundle.module`. Loop over `index.json` inside one test, using `XCTContext.runActivity(named: id)` per case. Inject a fake clock or scheduler and a `URLProtocol` stub.
- **Flutter (flutter_test):** put them in `test/fixtures/flows/` and load with `File('test/fixtures/flows/$file').readAsStringSync()`. Create one `test()` per case in a loop. Use `fakeAsync` (package:fake_async) with `async.elapse`, and a `MockClient` from `package:http/testing.dart`.

Start with the `engine.*`, `condition.*`, `interpolation.*` and choice cases. They need no UI: a driver that calls the engine's "answer" API is enough. Rich steps need the driver to submit the step's value: OTP code, matrix cells, slider value and so on.

## Regenerating

You need Node 18+, a dev folder with `conferbot-widget` (with `node_modules`), `client` (with `node_modules`, for jsdom) and `embed-server` (for `export.js`'s mongodb driver), and this repo under `sdk/`. Set `CONFERBOT_DEV` if the layout differs.

```sh
cd scripts/parity/flows
MONGO_URL=mongodb://127.0.0.1:27017/conferbotStaging node export.js   # writes the local samples/ (read-only on the DB)
node gen.js            # runs every case through the widget, writes fixtures/ and nodes.spec.json (~2 min, 6 workers)
node gen.js --check    # rebuilds in memory; exits 1 if anything differs or a citation no longer resolves
node gen.js --only condition.   # runs matching cases and prints their outcome (writes nothing)
```

`samples/` is local only: it is in `.gitignore` and is never committed. Without it:
- `gen.js` and `gen.js --check` still work. They re-run the committed fixtures, so each case's `flow`, `inputs` and `server` are the input, and check that the widget still gives the committed `expect`.
- What needs a local export: changing `cases.src.js` (adding or editing a case) and a full rebuild of the cases. Run `export.js` against a database first.

Run `--check` after any widget change to the files above. A diff means web behaviour changed: review it, then regenerate and file the SDK work.

Transpiled widget files are cached in `$TMPDIR/conferbot-flow-parity-ts`, keyed by content, so the cache is always safe to delete.

## Customer data

This repo is public. Nothing from a customer's bot is committed:

- **Our own QA bots keep their content.** They are listed in `anon.js` `OWN_BOTS`.
- **Every other real node is rewritten by `anon.js` in `export.js`, with the same keys, types and structure:**
  - each word becomes a neutral filler word of the same length, in any script, with its case kept;
  - HTML tags, entities, `{var}` placeholders, numbers, ids, handle ids and enum values stay as they are;
  - variable names the customer chose become `var_<hash>`; the builder's own defaults (`name`, `email`, `selected_choice`...) stay;
  - URLs become `https://cdn.example.com/media/<hash>.<ext>`, and e-mail addresses become `visitor@example.com`;
  - node ids become generic, and no bot id or name is kept. `source` says "real node shape (anonymised)".
- **On every case, `gen.js` also replaces S3 object URLs with example URLs.** Those URLs carry customer folder ids. Conferbot's own `botdefaults` assets are the exception.
- **The quiz bot's node ids are renamed.** It was built from a template that customer bots also copied.

Every rewrite is a hash of the original, so regenerating gives the same bytes. Anonymising did not change any case's path, handles, variables or end state.

## Limits

- `index.ts` itself is not executed; `web/runtime.js` copies its flow functions. Everything else on the flow path is the widget's code.
- jsdom never loads media, so images and videos always advance on the 4000 ms cap. A real browser advances sooner, on load.
- The live handover (agents accepting, transfers, the queue) is out of scope; only the flow side of `human-handover-node` is covered. The google-calendar "book" slot picker is not driven.
- `webhook-node` runs from the browser in the web widget. The case records that the flow does not wait for it; it is not a model for the SDKs (see the spec's `webOnly`).
- Text in `errors` and `drawn` is the widget's English i18n.
