# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- The post-chat rating is asked unless the owner switched Post-chat feedback off, as on the web; bots that never set it get the stock stars and wording instead of no rating (#94).

## [2.0.2] - 2026-10-18

### Fixed

- The coin entrance's glint waits off the button's left edge through its delay instead of showing as a white streak at its left side before the sweep (#91).
- An idle call's mascot (psst, wave, knock, tap) keeps facing the screen on a left-side launcher; the slide's scale dropped its mirror, so it faced the edge (#91).

### Removed

- The unused internal REST `sendMessage` helper in `src/services/api.ts`. It posted `{ message, metadata }`, but the mobile route `POST /session/:id/message` takes `{ record, answerVariables }` and only stores the record (it never runs the bot). Messages go over the socket, as before; nothing public changes (#92).

## [2.0.1] - 2026-10-17

### Fixed

- The app no longer crashes at `ConferBotProvider` in a release build when an optional peer (NetInfo, expo-av, expo-font, expo-file-system, a file picker, the audio recorder, react-native-svg, AsyncStorage) is not installed. Metro 0.80 (React Native 0.73 to 0.75) moved a module's later dependencies down by one past a missing optional require; each optional peer is now required, once, from its own module in `src/optional` (#85).
- The home screen's brand band runs down behind the middle of "Talk to us" again; it stopped under the header, leaving the greeting white on the page colour (#86).
- After a choice step (n-choices, image choice, yes or no, opinion scale, select or check options) the conversation goes on: the answer kept the step's data with the live socket in it, and socket.io overflowed the stack on every record sent after it, so a handover that followed never started and messages failed (#87).
- An answered choice step's picked pill is drawn in the visitor's bubble colours. It used the bot bubble colour on the theme's page colour, which can be the same colour, so the picked answer could not be seen (#89).

## [2.0.0] - 2026-10-16

Everything since 1.1.0. The SDK now matches the web widget: the same flows, live chat, customisation, launcher, languages and help, checked against the widget's own code (see [docs/PARITY.md](docs/PARITY.md)).

### Breaking changes & migration

**Removed exports.** These handler classes are no longer exported from the package root:

| Removed | Why | What to use |
|---|---|---|
| `AskDateHandler` (`ask-date-node`) | The flow builder never saves this step type | `DateTimeNodeHandler` (`datetime-node`) |
| `AskAddressHandler` (`ask-address-node`) | Same | `AddressNodeHandler` (`address-node`) |
| `CardsHandler` (`cards-node`) | Same | `ProductCardHandler` (`product-card-node`), or the carousel step |
| `WhatsAppHandler`, `TelegramHandler`, `GoogleAnalyticsHandler` | Same: there are no such steps in a flow | Nothing to replace |

These only matter if you registered or subclassed handlers yourself. `registerAllHandlers()` registers the current set.

**Deprecated.** `registerPushToken(token)` still works but is deprecated: it is now `setPushToken(token)`. Use `setPushToken(token, 'fcm' | 'apns')`. A token is now registered with the current conversation (`chatSessionId`, `tokenType`), not on its own, so nothing is registered until the visitor has a conversation. The 1.1.0 call sent a body the server rejects (#77).

**Deprecated.** `config.enableNotifications` has no effect, and a development warning says so (#81). Push is switched on by `setPushToken(token)` and off by `unregisterPush()`.

**Behaviour that changed by default.** No code change is needed unless you want the old behaviour.

- **The conversation is kept across restarts when `@react-native-async-storage/async-storage` is installed** (#12). Before, it was kept only if you passed `config.asyncStorage`. To opt out, pass `config={{ enablePersistence: false }}`.
- **The chat follows the owner's dashboard settings.** That covers the theme (27 themes; light, dark or follow the phone), colours, launcher, greeting card, fonts and sounds (#18-#25, #27, #53, #72). An app that ran on 1.1.0's fixed look will now look like the web widget. Inside the drop-in chat, dashboard values still win over a local `ThemeProvider`.
- **The SDK's own words appear in the visitor's language** (#70): English, Dutch, French, German or Spanish. The language comes from the owner's `widgetLanguage`, or else the phone's languages. To keep English everywhere, pass `config={{ widgetLanguage: 'en' }}`.
- **The chat opens on the home screen when the owner turns it on** (Customize > Welcome, `enableInitialPage`) (#68). The header's back button and Android's back button return to it.
- **The owner's post-chat redirect is followed** (#74). After the conversation ends, the visitor sees a 10-second countdown with Cancel, then the URL opens in the browser. To turn it off, use `config.disablePostChatRedirect: true`. To handle the URL yourself, use `config.onPostChatRedirect`.
- **The post-chat rating is offered 1.5 s after a flow ends** (#76), not only when an agent ends the chat, when the owner has post-chat feedback on. It is offered once per conversation.
- **The floating widget follows the provider's open state** (#79). `openChat()`, `closeChat()` and a push tap (`handlePushNotification`) now open and close `ConferBotWidget`'s chat. If you mounted a `ChatWidget visible={isOpen}` next to the launcher to get this, remove it: both would open.
- **A message sent while offline waits and is sent on reconnect** (#80), as the web widget does, instead of being dropped. The queue is kept on the device when AsyncStorage is installed. To turn it off, pass `config={{ enableOfflineMode: false }}`.
- **The floating widget opens itself when the owner turns auto-open on** (`botAutoOpen`, #55). This happens once per launch, only before a first conversation.
- **While a person is in the chat, the agent sees what the visitor is typing** (`visitorDraftPreview`, on unless the owner turns it off; #55). It is never sent from a secure field.
- **The app's `user` (with `metadata`) and the phone's language are sent with every conversation record**, as the web widget sends them (#26, #51).
- **The chat header keeps the bot's name** with "Online" and the reply time, even when a person joins (#32). The built-in widgets no longer pass `agent` to `ChatHeader`.
- **Flow pacing and limits.** Typing dots now last as long as on the web (`paceFor`) instead of a fixed 500 ms (#63). `NodeFlowEngine`'s `typingDelay` applies only when you set it, and `ChatWidget`'s `typingDelay` prop no longer has any effect. `maxNodesPerCycle` now defaults to 500 instead of 100 (#61).
- **`ChatWidgetWithKB` follows the owner's help centre switch** (#40). Its `enableKnowledgeBase` prop is now only an explicit override. It is still not exported from the package root.

**New optional packages.** Nothing breaks without them: each one is only required for the feature it enables. See the README's [Install](README.md#install) section.

- `expo-av`: the owner's sounds (#72). Voice notes already used it, or `react-native-audio-recorder-player`.
- `expo-file-system`: the synthesised sounds on iOS.
- `expo-font`: the owner's Google font and the theme's font (#53).
- `react-native-svg`: already an optional peer. It now also draws the launcher icons, gradients, effects and mascot, chat backgrounds, the signature pad, and the pencil and mascot typing styles.

### Added

- **AI agent bots (Agent Studio)**: greeting with starter questions, streamed replies, follow-up chips, sources, answer buttons, cards, action confirmation, and "Helpful?" with reasons and a vote that can change. Also markdown tables, headings, quotes, code and strikethrough, and a notice when a reply takes longer than 45 s (#1, #50, #56).
- **Flows as on the web**: all 82 step types of the shared flow-node spec, passing 156 of 156 fixtures. The 14 rich steps each have a native card: consent, OTP, address, signature, ranking, matrix, payment, slider, date/time, carousel, product, AI route/extract, KB answer and picture choices. Loops and sub-flows, conditions and math as on the web, answers filled into later messages, booked calendar slots greyed out, and `onTrace` on `NodeFlowEngine` (#34-#38, #52, #55, #60-#63).
- **Live chat extras**: queue position and the live estimate or usual wait, a max-wait countdown, leave a message, lead capture, a file request, receipts, translations with "See original", and the post-chat rating and survey questions. Also requeued and transferred lines, a blocked-visitor screen, "Start a new chat", and "Email me this chat" (#8, #13-#17, #39, #42, #43, #46-#48, #66, #67).
- **Handover lifecycle**: a "Connecting you with the team…" line and how the wait ended, leaving the queue on the server, a live chat picked back up after a restart, `leaveQueue()`, and `onWidgetSignal()` with `WAITING_FOR_HUMAN_EVENT`, `HUMAN_JOINED_EVENT` and `WAIT_OVER_EVENT` (#28-#32, #58, #59).
- **While you wait**: help articles 6 s into a wait, the server's `queue-help` pick with "That solved it", and seven waiting games (#41, #44).
- **Home screen** with "Ask anything", "Welcome back", "Your requests", "Talk to us", recent articles and logos. `useHome()`, `<HomeScreen />` and `{{first_name|there}}` personalisation (#68, #69).
- **Your requests**: the visitor's conversations with the team, with live replies. `useRequests()` and `<RequestsPortal />` (#45).
- **Help centre**: articles open in the app from AI sources and article cards (#49).
- **Launcher as on the web**: 56 icons, shapes, styles, idle motion, entrance, attention loop, idle call, and the greeting card in 11 styles with its rules and frequency. Also mascots (27 characters) on the launcher, the greeting card, typing and `<Mascot />` (#23-#25, #27, #54, #57, #71).
- **Customisation**: the dashboard's colours, bubble and avatar shapes, typing styles, chat backgrounds, 27 widget themes with dark mode, fonts and sounds (#18-#22, #53, #54, #72).
- **Human touches**: the bot's tapback on an answer, confetti, rating sparks, "No rush" nudges, and "Edit" on the latest answer (#73).
- **Languages**: `config.widgetLanguage`, `useConferBot().widgetLanguage`, and `t()` / `widgetLanguage()` exports (#70).
- **Push notifications**: `setPushToken(token, type)`, `unregisterPush()`, `handlePushNotification(data, { open })`, `parseConferbotPush`, `isConferbotPush`, `pushTokenTypeOf` and `PUSH_CHANNEL_ID` (#77).
- **Identity verification**: `user.hash` (#26).
- **Post-chat redirect**: `config.onPostChatRedirect` and `config.disablePostChatRedirect` (#74).
- **Offline state on `useConferBot()`** (#80): `isOnline` (the socket, and the device's network with `@react-native-community/netinfo`), `pendingMessageCount`, `failedMessageCount`, `retryFailedMessage(messageId)`, `retryAllFailedMessages()` and `clearFailedMessages()`. They were on the type but never filled in.
- **`SocketEvents` is exported as a value** (#82): `on(SocketEvents.BOT_RESPONSE, ...)` instead of a cast string.
- **New on `useConferBot()`**: `customizations`, `widgetTheme`, `widgetLanguage`, `agentBot`, the live chat extras, `waitEndsAt`, the while-you-wait, requests and home state, `chatFont`, `soundOn` / `toggleSound`, and `emailTranscript`. About 180 new root exports in all.

### Changed

- Server colours are normalised to six-digit hex, and agent bubbles use the bot's colours (#3).
- The floating widget tells the provider when the chat is open (#2).
- Live chat files are sent as records with a paperclip in the composer (#13).
- Typing pace and the step limit now follow the web (see Breaking changes).

### Fixed

- Agent bots no longer open on the hidden shell flow (#1).
- A reconnect no longer restarts the flow (#4).
- Restart Chat now gets a new session id (#5).
- The conversation is no longer lost on relaunch (#6, #12).
- A broken bot image no longer leaves an empty box (#7).
- The flow no longer stops after the first message (#9).
- The handover step waits for a person and shows its message as text (#10).
- Bot messages now show after a restored conversation (#11).
- Card buttons work with the keyboard up (#14).
- The flow carries on when nobody is available (#16) and when an agent ends the chat (#66).
- A handover can no longer wait forever (#17).
- Unknown steps and missing branches behave as on the web, so payment can't be skipped (#34).
- Steps read the field names the builder saves (#35).
- Conditions evaluate as on the web (#36).
- Flows no longer stop after 100 steps (#61).
- Answers and records are kept as the web keeps them (#62).
- "You left the queue" is drawn once (#65).
- Post-chat survey questions are asked (#67).
- "Published on" now appears in the visitor's language (#75).
- Push registration now matches the server (#77).
- Push taps and `openChat()` open the floating launcher's chat (#79).
- `isOnline`, `pendingMessageCount` and the retry actions are filled in; `isConnected` follows disconnects and reconnects (#80).
- `config.reconnectionAttempts` and `config.reconnectionDelay` reach the socket; `enableOfflineMode` and `offlineQueueConfig` drive the offline queue (#81).
- `import { SocketEvents }` works as a value (#82).
- After a reconnect the visitor is back in the chat's room, so agent messages sent after a network blip arrive; a waiting visitor's queue position is asked again at once (#83).

### Security

- The GPT step asks the server (`/api/v1/bot/:id/gpt`) instead of calling OpenAI from the device (#33). The owner's key never reaches the app.
- Card numbers, IBANs, ids and passwords in answers are masked before they are stored or sent (`redactSensitive`, #37).
- Identity verification: a server-made HMAC (`user.hash`) files the chat under the verified user (#26).
- The post-chat redirect follows only `http(s)` URLs with a host, at most 2048 characters and without `user:password@` (#74).
- The typing preview is never sent from a secure field (#55).

## [1.1.0] - 2026-04-23

### Added
- Initial release of the Conferbot React Native SDK
- Real-time messaging via Socket.IO
- Node flow engine with 50+ node types
- Live agent handover support
- Message reactions and read receipts
- File and image uploads
- Knowledge base integration
- Session persistence
- Push notification support
- Full theming and customization
- Offline message queuing
- Analytics and event tracking
