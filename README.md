# Conferbot React Native SDK

[![npm version](https://img.shields.io/npm/v/@conferbot/react-native.svg)](https://www.npmjs.com/package/@conferbot/react-native)
[![React Native](https://img.shields.io/badge/React%20Native-%3E%3D%200.70-blue.svg)](https://reactnative.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://github.com/conferbot/react-native-sdk/blob/main/LICENSE)

Native React Native SDK for embedding Conferbot chatbots into iOS and Android applications - no WebView required.

## See it in action

The complete flow recorded live on an Android emulator against production: open the floating widget with its server-configured CTA tooltip, bot loads with server theming, welcome message with GIF below the text bubble, name captured through the inline input, choice selection with the transcript kept intact (selected pill stays highlighted, the rest disabled), and follow-up nodes.

<p align="center">
  <img src="docs/demo.gif" width="300" alt="Conferbot React Native SDK - live chat demo" />
</p>

<p align="center"><a href="docs/demo.mp4">HD video (MP4)</a></p>

<p align="center">
  <img src="docs/screenshots/chat-widget.png" width="280" alt="Chat Widget" />
  <img src="docs/screenshots/choice-node.png" width="280" alt="Choice Node" />
  <img src="docs/screenshots/themed-chat.png" width="280" alt="Themed Chat" />
</p>

## Features

- **Native Components** - Built entirely with React Native views, not a WebView wrapper
- **Floating Bubble (FAB)** - The same bottom-right chat bubble as the web widget, driven by your dashboard settings
- **Real-time Messaging** - Socket.IO-based communication with automatic reconnection
- **Node Flow Engine** - Runs the flows you build in the Conferbot flow builder exactly as the web widget does: all 82 step types (questions, choices, conditions, loops and sub-flows, AI route / extract, knowledge-base answers, OTP, consent, payment and more), checked against 156 shared cases produced by running the widget's own code
- **Server-driven Theming** - Colors, bot name, and avatar configured in the dashboard apply automatically
- **Live Agent Handover** - Seamless transition between bot and human agents, as on the web widget: a "Connecting you with the team…" line that settles to how the wait ended, the queue, leaving it, agent typing indicators, and a live chat picked back up after an app restart
- **AI answers as on the web** - Tables, headings, quotes, code blocks and strikethrough in replies; "Helpful?" under each answer (a No is sent at once, then reasons, a comment, "Talk to a person", "Ask another way"; the vote can change); a notice when a reply takes longer than 45s; the device language sent so short messages are answered in it
- **Email me this chat** - From the chat menu, the visitor gets the whole conversation in their inbox (`POST /api/v1/mobile/chat/transcript-email`)
- **Offline Support** - Messages are queued locally and retried when connectivity returns
- **Session Persistence** - Conversations survive app restarts via AsyncStorage
- **Push Token Registration** - Register device tokens for background message delivery
- **Message Reactions** - Emoji reactions with real-time sync
- **Read Receipts** - Sent, delivered, and read status indicators
- **File Attachments** - Camera, gallery, and document picker support
- **Analytics** - Session, message, node, and custom event tracking
- **TypeScript** - Complete type definitions for every export

## Requirements

| Dependency     | Minimum Version |
|----------------|-----------------|
| React          | 17.0.0          |
| React Native   | 0.70.0          |
| iOS            | 12.0+           |
| Android        | API 21+         |

## Installation

```bash
npm install @conferbot/react-native
# or
yarn add @conferbot/react-native
```

### Peer Dependencies

The SDK itself is pure TypeScript - it has no native code of its own, so there is no linking step for the SDK package. Its runtime dependencies (`axios`, `socket.io-client`) are installed automatically.

Two peer dependencies are **optional** but unlock features:

```bash
# Session persistence + offline message queue
npm install @react-native-async-storage/async-storage

# Crisper vector icons in some components
npm install react-native-svg
```

Both of these are native modules, so after installing them run the usual native steps:

```bash
cd ios && pod install && cd ..
```

Without `@react-native-async-storage/async-storage`, the SDK still works - persistence and the offline queue are simply disabled.

## Getting Your API Key and Bot ID

1. **Log in** to the [Conferbot Dashboard](https://app.conferbot.com)
2. **Create or select a bot** from the dashboard
3. **Find your Bot ID**: Go to **Bot Settings** > **General** - the Bot ID is displayed at the top
4. **API Key**: any placeholder works (e.g. `conf_test_key`); the bot ID is the credential

> **No account yet?** The public demo bot `691c970890527a0468f9b2c9` works without an account - drop it in as `botId` to try the SDK immediately.

## Quick Start

### 1. Floating Bubble (recommended - like the web widget)

`ConferBotWidget` renders a floating chat bubble in the bottom-right corner of the screen, exactly like the Conferbot web widget. Tapping it opens the full chat modal. Overlay it on top of your existing screen - it positions itself absolutely.

```tsx
import React from 'react';
import { View, Text } from 'react-native';
import { ConferBotProvider, ConferBotWidget } from '@conferbot/react-native';

export default function App() {
  return (
    <ConferBotProvider apiKey="YOUR_API_KEY" botId="YOUR_BOT_ID">
      <View style={{ flex: 1 }}>
        <Text>Your app content</Text>
        <ConferBotWidget />
      </View>
    </ConferBotProvider>
  );
}
```

The bubble reads your dashboard settings automatically: FAB color (solid or gradient fallback), icon, size, position (left/right), offsets, border radius, and the CTA tooltip text shown next to the bubble. You do not need to write any styling code to match your web widget.

Every setting can also be overridden locally through `widgetConfig`. Local props win over server values:

```tsx
<ConferBotWidget
  title="Support Chat"
  placeholder="Type your message..."
  showTimestamps={true}
  widgetConfig={{
    position: 'right',
    offsetX: 16,
    offsetBottom: 24,
    size: 56,
    backgroundColor: '#1b55f3',
    iconColor: '#ffffff',
    ctaText: 'Chat with us!',
    showCta: true,
  }}
/>
```

`ConferBotWidgetProps` extends `ChatWidgetProps`, so anything the chat modal accepts (`title`, `placeholder`, `enableAttachments`, ...) can be passed straight through.

### 2. Drop-in ChatWidget

Render the full chat UI directly (it opens as a modal and auto-opens on first mount):

```tsx
import React from 'react';
import { ConferBotProvider, ChatWidget } from '@conferbot/react-native';

export default function App() {
  return (
    <ConferBotProvider apiKey="YOUR_API_KEY" botId="YOUR_BOT_ID">
      <ChatWidget />
    </ConferBotProvider>
  );
}
```

Control visibility yourself with the `visible` and `onClose` props:

```tsx
const [open, setOpen] = useState(false);

<ChatWidget visible={open} onClose={() => setOpen(false)} />
```

### 3. Headless (useConferBot Hook)

Full control over the UI - the hook exposes connection state, the message record, and all actions.

```tsx
import React from 'react';
import { View, Text, Button, FlatList } from 'react-native';
import { ConferBotProvider, useConferBot } from '@conferbot/react-native';

function ChatScreen() {
  const { sendMessage, record, isConnected } = useConferBot();

  return (
    <View style={{ flex: 1 }}>
      <Text>{isConnected ? 'Connected' : 'Connecting...'}</Text>
      <FlatList
        data={record}
        keyExtractor={(item) => String(item._id)}
        renderItem={({ item }) => <Text>{'text' in item ? item.text : item.type}</Text>}
      />
      <Button title="Send Hello" onPress={() => sendMessage('Hello!')} />
    </View>
  );
}

export default function App() {
  return (
    <ConferBotProvider apiKey="YOUR_API_KEY" botId="YOUR_BOT_ID">
      <ChatScreen />
    </ConferBotProvider>
  );
}
```

### 4. Mix and Match (Individual Components)

Compose the pre-built components inside your own layout:

```tsx
import React from 'react';
import { View } from 'react-native';
import {
  ConferBotProvider,
  useConferBot,
  MessageList,
  ChatInput,
  ChatHeader,
  ConnectionStatus,
} from '@conferbot/react-native';

function CustomChat() {
  const { record, sendMessage, currentAgent, isConnected } = useConferBot();

  return (
    <View style={{ flex: 1 }}>
      <ChatHeader title="Support" agent={currentAgent} />
      <ConnectionStatus variant="badge" />
      <MessageList messages={record} />
      <ChatInput onSend={sendMessage} disabled={!isConnected} />
    </View>
  );
}

export default function App() {
  return (
    <ConferBotProvider apiKey="YOUR_API_KEY" botId="YOUR_BOT_ID">
      <CustomChat />
    </ConferBotProvider>
  );
}
```

Other exported building blocks: `MessageBubble`, `Avatar`, `TypingIndicator`, `EmptyState`, `OfflineBanner`, `MessageStatusIndicator`, `ReactionPicker`, `MessageReactions`, `LinkPreview`, `EmojiPicker`, `NodeRenderer`.

## Configuration

### ConferBotProvider Props

```ts
interface ConferBotProviderProps {
  apiKey: string;
  botId: string;
  config?: ConferBotConfig;
  customization?: ConferBotCustomization;
  user?: ConferBotUser;
  children: React.ReactNode;
}
```

### ConferBotConfig

```tsx
import AsyncStorage from '@react-native-async-storage/async-storage';

<ConferBotProvider
  apiKey="YOUR_API_KEY"
  botId="YOUR_BOT_ID"
  config={{
    enableNotifications: true,
    enableOfflineMode: true,
    enablePersistence: true,
    asyncStorage: AsyncStorage,
    enableReadReceipts: true,
    autoConnect: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 3000,
  }}
>
  {children}
</ConferBotProvider>
```

| Option                 | Type                     | Description                                                        |
|------------------------|--------------------------|--------------------------------------------------------------------|
| `enableNotifications`  | `boolean`                | Enable push notification support                                   |
| `enableOfflineMode`    | `boolean`                | Queue outbound messages while offline                              |
| `autoConnect`          | `boolean`                | Connect the socket on mount                                        |
| `reconnectionAttempts` | `number`                 | Max socket reconnection attempts                                   |
| `reconnectionDelay`    | `number`                 | Delay between reconnection attempts (ms)                           |
| `enablePersistence`    | `boolean`                | Persist sessions across app restarts (default true when `asyncStorage` is provided) |
| `asyncStorage`         | `AsyncStorageInterface`  | AsyncStorage instance for persistence and the offline queue        |
| `persistenceConfig`    | `PersistenceConfig`      | `maxMessages`, `keyPrefix`, `enabled`, `sessionExpiryMs`           |
| `enableReadReceipts`   | `boolean`                | Read receipt tracking (default: true)                              |
| `readReceiptConfig`    | `ReadReceiptConfig`      | `enabled`, `showIndicators`, `batchDebounceMs`, `autoMarkAsRead`   |
| `offlineQueueConfig`   | `OfflineQueueConfig`     | `maxQueueSize`, `maxRetries`, retry backoff, `persistQueue`, `autoProcess` |

## Passing User Identity

Identify the visitor so conversations and answer variables are attributed to a known user:

```tsx
<ConferBotProvider
  apiKey="YOUR_API_KEY"
  botId="YOUR_BOT_ID"
  user={{
    id: 'user_123',
    name: 'Jane Doe',
    email: 'jane@example.com',
    phone: '+15551234567',
    hash: userHashFromYourServer, // identity verification (below)
    metadata: { plan: 'pro' },
  }}
>
  {children}
</ConferBotProvider>
```

`ConferBotUser` requires `id`; `name`, `email`, `phone`, `hash` and `metadata` are optional. The user (with `metadata`) is sent with every conversation record, as the web widget's `user`, so dashboard contacts and greeting rules ("signed in") see it. With persistence enabled, the identified user is stored locally (`PersistedUser`) so returning visitors resume their session.

### Identity verification

Without it, anyone could claim any id or email. Turn it on in the dashboard (Settings > Security), keep the secret on your server, and sign each user there:

```js
// Node, on your server - never ship the secret in the app
const hash = crypto.createHmac('sha256', IDENTITY_SECRET).update(String(user.id || user.email)).digest('hex');
```

Pass it as `user.hash`. A matching hash files the chat under that user (contacts link and merge); a missing or wrong one is treated as an unverified visitor, or as anonymous when the workspace requires verification.

## Theming and Flow-Builder Customizations

### Server customizations apply automatically

Everything you configure in the Conferbot dashboard (Widget Customization / flow builder) is fetched at connect time and applied to the built-in chat UI without any code:

- **Colors**: header background/text, bot bubble, user bubble, option bubble, chat background, base font size
- **Identity**: bot name in the header (server `botName` wins over the local `title` prop), avatar image, tagline
- **Floating bubble**: as the web widget draws it on a phone. Colour or left-to-right gradient (with `react-native-svg`), icon ink that stays readable on light colours, icon (SVG name or uploaded image), position, the phone size and offsets (16px from the bottom and side unless set), shape (speech bubble by default, circle, squircle, tab or peek), style (icon, the bot's avatar with an online dot, or the label pill on tablets; phones show the round button, as the web does), and the greeting text only when the greeting is turned on. All 56 dashboard launcher icons are drawn as on the web (with `react-native-svg`), and they move as on the web: an idle moment about 2s after the launcher shows and a few more after (`launcherAnimation` subtle / lively; off stops it), a reaction when a message arrives while the chat is closed, and the ripple rings. Nothing moves while the chat is open, after it was opened, or when the phone asks for reduced motion.
- **Launcher entrance, attention and idle call** (all off unless chosen in the dashboard, as on the web): an entrance the first time the launcher shows in an app session (lightning, rocket, portal, ufo, drop, confetti, coin, meteor, magic, parachute, plane, egg; the greeting waits until it has landed); a "look here" loop on the launcher or the greeting card (pulse, wobble, bounce, wave, float, shine, heartbeat, orbit; a beat then stillness, until the chat is opened); and an idle call, where the mascot slips out from behind the launcher after the chosen delay (12s by default) and calls the visitor over with a bubble that opens the chat (psst, peek, wave, knock, tap; at most twice a session, then a few days' rest). Effects and the mascot need `react-native-svg`; glows and blurs are left out. Nothing plays with reduced motion.
- **Greeting card**: the dashboard greeting beside the launcher, as on the web: shown after its delay (3s by default) when the greeting is on; the highest-priority greeting rule that fits the app (rules for every page, new or returning visitors, signed in or not, dates, visits; page-specific, traffic-source and browsing rules are web-only), else the default message; smart greetings (welcome back, quiet for signed-in customers) with their show limits; the frequency (every launch with a few minutes' rest after closing, once a session, or once in N days); a tap opens the chat, sends the message as the visitor's first, or opens the rule's link; an AI agent's suggested questions as chips. All 11 styles: card, note, phone text (default), postcard, sticky note, typewriter, glass, notification, neon, voice note and aurora, with their reveals. Uses the platform's fonts; glass and notification are translucent without a live blur.
- **Chat background**: solid, gradient (linear, radial, mesh, blur), image with its mask, or one of the 13 patterns (drawn with `react-native-svg` when installed, else the base colour)
- **Widget theme**: all 27 dashboard themes (Classic, Minimal, Glass, Neo-brutal, Midnight, Aurora and the rest). Each brings its surfaces, text colours, corner radii and bubble outline, as on the web widget. **Appearance** light, dark, or auto (follows the phone's dark mode); Midnight, Neon, Chalkboard, Cyberpunk and Space are always dark. **Colours** "Brand" keeps your colours; "Theme palette" swaps in the theme's own header, bubble, option, launcher and send-button colours. Your own bubble radius, option radius and chat background still win over the theme. Theme fonts are not loaded on mobile; the app's font is used.

### Precedence - be aware of how merging works

- **Floating bubble (`ConferBotWidget`)**: local `widgetConfig` props > server dashboard values > SDK defaults. Anything you set explicitly wins.
- **Chat UI inside `ChatWidget`**: the widget wraps its content in an internal `ThemeProvider` seeded with the server theme override, merged over the SDK's default theme. That means **server dashboard colors win over a local `ThemeProvider`** for the drop-in chat modal. If your dashboard has no customizations, the default light theme is used.
- **Components you compose yourself** (`MessageList`, `ChatHeader`, ... in a custom layout): styled by the nearest `ThemeProvider` you provide - fully under your control.
- The `customization` prop on `ConferBotProvider` (`ConferBotCustomization`) is accepted for forward compatibility but is **not applied to the built-in UI in v1.1.0**. Use dashboard customizations or `ThemeProvider` instead.

Note: a gradient launcher needs `react-native-svg`; without it the launcher uses the gradient's first colour.

### Local themes

The SDK ships `defaultTheme` (light) and `darkTheme`. Wrap your own composed components in `ThemeProvider`:

```tsx
import { ThemeProvider, darkTheme } from '@conferbot/react-native';

<ThemeProvider theme={darkTheme}>
  <CustomChat />
</ThemeProvider>
```

`ThemeProvider` deep-merges the given `ConferBotThemeOverride` over `defaultTheme`, so partial overrides are fine:

```tsx
<ThemeProvider
  theme={{
    colors: {
      primary: '#4F46E5',
      userBubble: '#4F46E5',
      botBubble: '#F3F4F6',
    },
    borderRadius: { bubble: 12 },
  }}
>
  <CustomChat />
</ThemeProvider>
```

Read the active theme in your own components with `useTheme()`. The full token set (`colors`, `typography`, `spacing`, `borderRadius`, `shadows`, `animations`, `layout`) is defined in the `ConferBotTheme` type.

## Push Notifications

Register a device push token (from Firebase, APNs, or Expo) so the visitor can receive messages while the app is backgrounded. The SDK detects the platform automatically and posts to the Conferbot mobile API:

```tsx
const { registerPushToken } = useConferBot();

// After obtaining a token from your push provider:
await registerPushToken(deviceToken);
```

Obtaining the token itself (e.g. via `@react-native-firebase/messaging`) and displaying notifications is up to your app - the SDK only registers the token with Conferbot. There is currently no public unregister method.

## Offline Support

With `enableOfflineMode` and an `asyncStorage` instance, outbound messages are queued locally, persisted, and retried with exponential backoff once connectivity returns. Queue state is surfaced on the context:

```tsx
const {
  isOnline,
  pendingMessageCount,
  failedMessageCount,
  retryFailedMessage,
  retryAllFailedMessages,
  clearFailedMessages,
} = useConferBot();
```

The `OfflineBanner` component renders a ready-made "you are offline" banner, and `MessageStatusIndicator` shows per-message queued/failed states. For lower-level control there are `useNetworkStatus()` (returns `isConnected`, `isInternetReachable`, `type`, `refresh()`) and `useOfflineQueue()` (returns `queue`, `queueSize`, `pendingCount`, `failedCount`, `queueMessage`, `retryAllFailed`, `processQueue`, and more), plus the standalone `OfflineQueueService` class.

## Message Reactions

Users can react to messages with the built-in emoji set (`REACTION_EMOJIS`: 👍 👎 ❤️ 😊 😮 😢). Reactions sync in real time over the socket.

```tsx
const { addReaction, removeReaction, getReactions } = useConferBot();

addReaction(messageId, '👍');
```

`ReactionPicker` and `MessageReactions` handle rendering; the standalone `useReactions()` hook adds `toggleReaction`, `getGroupedReactions`, and `hasUserReacted` for custom UIs.

## Read Receipts

Sent / delivered / read statuses update in real time (enabled by default; tune with `config.readReceiptConfig`).

```tsx
const { getMessageStatus, markMessageAsRead, markVisibleMessagesAsRead } = useConferBot();
```

`MessageList` accepts `messageStatuses` and `showReadReceipts` props, and `MessageStatusIndicator` renders the tick marks.

## Knowledge Base

The public API surface for knowledge base in v1.1.0 is intentionally small:

- The `KnowledgeBaseArticle` type and the `rateKBArticle(articleId, helpful, rating, feedback?)` action on `useConferBot()`, which emits the `rate-article` socket event.
- Recent articles and categories arrive with the chatbot data payload (`FetchedChatbotDataResponse.knowledgeBaseData`).

Full knowledge base browsing screens (`KnowledgeBaseScreen`, `KBButton`, `ChatWidgetWithKB`) exist in the source tree under `src/components/KnowledgeBase/` but are **not exported from the package root yet** - unlike the Flutter SDK's `KnowledgeBaseScreen`. If you need them today, they are visible in the shipped `src/` folder, but treat them as unstable until they are officially exported.

## Analytics

Wrap your app with `ConferBotWithAnalyticsProvider` to get session, message, node, and drop-off tracking with batched uploads:

```tsx
import { ConferBotWithAnalyticsProvider, useAnalyticsContext } from '@conferbot/react-native';

<ConferBotWithAnalyticsProvider
  apiKey="YOUR_API_KEY"
  botId="YOUR_BOT_ID"
  config={{ enableAnalytics: true }}
  appVersion="1.4.2"
>
  <ChatWidget />
</ConferBotWithAnalyticsProvider>
```

Track custom events with the `useAnalytics()` hook:

```tsx
const { trackEvent, trackUserAction } = useAnalytics();
trackEvent('checkout_help_opened', { screen: 'checkout' });
```

## Socket Events

Subscribe to raw real-time events for advanced use cases. `on()` returns an unsubscribe function. Event names come from the `SocketEvents` enum (values are kebab-case strings such as `'bot-response'`):

```tsx
import { useConferBot, SocketEvents } from '@conferbot/react-native';

const { on } = useConferBot();

useEffect(() => {
  const unsubscribe = on(SocketEvents.BOT_RESPONSE, (data) => {
    console.log('Bot responded:', data);
  });
  return unsubscribe;
}, [on]);
```

Key server events: `BOT_RESPONSE`, `AGENT_MESSAGE`, `AGENT_ACCEPTED`, `AGENT_LEFT`, `AGENT_TYPING_STATUS`, `CHAT_ENDED`, `CONNECTION_ERROR`.

### Waiting for a person

While a visitor waits for the team, the SDK gives the same signals as the web widget, for your own waiting experience (a game, an article, a banner). `onWidgetSignal()` returns an unsubscribe function. No detail carries personal data.

```tsx
import { useConferBot, WAITING_FOR_HUMAN_EVENT, HUMAN_JOINED_EVENT, WAIT_OVER_EVENT } from '@conferbot/react-native';

const { onWidgetSignal } = useConferBot();

useEffect(() => {
  const offs = [
    // 20s into a wait with nobody yet (only while the chat is open), or the
    // server's own word that the team is busy or offline.
    onWidgetSignal(WAITING_FOR_HUMAN_EVENT, (d) => console.log('waiting', d)), // { offline, reason, backAt, emailCaptured }
    onWidgetSignal(HUMAN_JOINED_EVENT, (d) => console.log('joined', d)),       // { name }
    onWidgetSignal(WAIT_OVER_EVENT, (d) => console.log('over', d)),            // { reason: 'unavailable' | 'cancelled' | 'ended' }
  ];
  return () => offs.forEach((off) => off());
}, [onWidgetSignal]);
```

How a handover reads in the chat:

- An AI agent passing the visitor to the team draws "Connecting you with the team…" with typing dots, never "has left the chat". The line settles to "Connected with the team", "The team couldn't join just now", "You left the queue" or "Chat ended before the team joined".
- "Talk to a person" is offered only while no handover is under way and nobody is in the chat. It goes once tapped; the owner's quick-action links stay.
- The header keeps the bot's name with "Online" and the team's reply time ("Typically replies in a few minutes", "Online · team back at 9 AM"), and goes back to "Online" when a person joins.
- Cancel on the wait card leaves the queue on the server (`queue-self-resolve`), so the team stops seeing the visitor waiting. `leaveQueue()` does the same from your own UI.
- After an app restart the SDK asks the server where the chat stands (`live-chat-state`): a person's chat comes back live with its agent, a visitor still in the queue goes back to the same wait, and a chat that ended meanwhile says so.
- When the agent leaves and the chat goes back to the queue, "Connecting you to another agent..." (or "Connecting you to Sales..." after a team transfer) is drawn, and a flow at its handover step waits again. A transfer is kept in the conversation's record.
- When the agent ends a chat that a flow's handover step started, the flow carries on from that step. If the step has post-chat survey questions switched on (`enablePostChatSurveyQuestions`), they are asked one by one first, each answer kept in the conversation's record and its answer variable; then the flow follows the step's next edge.
- The same end twice (an agent's double click) draws one "Chat ended" line and one survey. Once the chat has ended and nothing is going on, the composer turns off and "Start a new chat" starts a fresh conversation.
- A visitor the workspace blocked sees "This conversation has been closed." (mid-chat, or at connect: the visitor id goes with the socket handshake) and can't type or start a new chat.

## Bot Flows

The SDK runs a bot's flow the way the web widget does. The shared flow-node spec in `scripts/parity/flows/` is the reference, and `__tests__/parity/flows.test.ts` runs all 156 of its cases through the engine. `__tests__/components/FlowStepViews.test.tsx` plays the cases for the step cards on the cards themselves.

- **Routing:** the chat starts at the first welcome step. A step that doesn't branch follows its first edge. A branch (a choice, a condition, an AI intent) follows its own handle, and the chat ends when that handle has no edge. Unknown step types are passed along their first edge.
- **Answers:** a question with an answer variable saves into it, so `{name}` / `${name}` / `{{name}}` fill later messages. An unknown variable shows nothing.
- **Server-side steps:** the GPT, AI route / extract, knowledge-base, OTP, address and payment steps call your bot's server (`/api/v1/bot/:id/...`). No secret ever comes to the device.
- **Integrations:** Gmail, Sheets, Slack, HubSpot and the rest run on the server with the step as it was saved, `credentialId` included. The flow moves on without waiting, except Mailchimp, Segment and Salesforce, which wait and take their success or failure path.
- **Gates stay gates:** payment leaves by its paid path only when the server says paid, OTP only once a code is verified, and required consent only once agreed.
- **Privacy:** card numbers, IBANs, ids and passwords in answers are masked before they are stored or sent (`redactSensitive`, on unless the owner turns it off).
- **Pacing:** typing dots last as long as the web's (`paceFor`). Pass `typingDelay` to `NodeFlowEngine` for a fixed delay instead. Images move on once they load, after 4 s at most.
- **No page in an app:** a hidden-fields step captures nothing, unless you run `NodeFlowEngine` yourself and pass `page: { url, referrer }` (for example from a deep link).
- **Step cards:** the steps the web draws as cards have native cards under the bot's question, in the bot's option colours, corner radius and font size:
  - consent: a box to tick, the text's links open in the browser;
  - OTP: the e-mail, six digit boxes, Resend once its wait is over, Change email, Skip when allowed;
  - address: suggestions as you type, then confirm; or the fields by hand;
  - signature: a pad to sign on with a finger (drawn with `react-native-svg`, sent as an SVG image), or the name typed;
  - ranking: drag a row by its handle, or move it with the arrows;
  - matrix: each row's columns, with how many rows are answered;
  - payment: Pay now opens Stripe Checkout in the browser, then I've paid and Cancel, with the time left;
  - slider, date / time, carousel and product cards (link buttons open their page, Continue when no card has a path), picture choices.

  Without `react-native-svg` the signature step takes the typed name. Custom renderers can reuse the cards (`stepViewFor(uiState)`); each waiting state carries its step's `stepType` and `stepData`.

The engine also reports every step it enters, every handle it takes and the end, through `onTrace` (`FlowTraceEvent`).

## Custom Endpoints

By default the SDK talks to production at `https://wdt.conferbot.com` (REST base `https://wdt.conferbot.com/api/v1/mobile`). Point it elsewhere (self-hosted, staging, or a local embed-server) before rendering the provider:

```tsx
import { ConferBotEndpoints } from '@conferbot/react-native';

ConferBotEndpoints.configure({
  socketUrl: 'https://your-server.example.com',
  apiBaseUrl: 'https://your-server.example.com/api/v1/mobile',
});
// ConferBotEndpoints.reset() restores the defaults
```

## API Reference

### Components

| Export | Key props (real signatures) | Description |
|--------|------------------------------|-------------|
| `ConferBotProvider` | `apiKey: string`, `botId: string`, `config?`, `customization?`, `user?` | Root provider - manages socket, session, persistence, and state (also the default export) |
| `ConferBotWithAnalyticsProvider` | provider props + `appVersion?`, `buildNumber?`, analytics `config` | Provider variant with analytics wired in |
| `ConferBotWidget` | `widgetConfig?: WidgetConfig` + all `ChatWidgetProps` | Floating bubble (FAB) + chat modal, web-widget style |
| `ChatWidget` | `visible?`, `onClose?`, `title?`, `placeholder?`, `enableAttachments?`, `enableVoiceMessage?`, `showTimestamps?`, `closeOnBackdrop?`, `typingDelay?`, `voiceMaxDuration?`, `voiceMinDuration?`, `debug?`, `testID?` | Drop-in full-screen chat modal with node flow engine |
| `ChatHeader` | `title?`, `tagline?`, `subtitle?`, `showOnline?`, `statusText?`, `agent?: Agent`, `botAvatarUrl?`, `showConnectionStatus?`, `onClose?`, `rightActions?` | Chat header with avatar, status line ("Online" or the reply time), connection dot. The built-in widgets keep the bot in the header and never pass `agent`. |
| `MessageList` | `messages: RecordItem[]`, `showTypingIndicator?`, `showTimestamps?`, `reactions?`, `messageStatuses?`, `activeNodeUI?`, `onNodeSubmit?`, `onEndReached?` | Virtualized message list with inline node rendering |
| `MessageBubble` | see `MessageBubbleProps` | Single message bubble (user/bot/agent/system) |
| `ChatInput` | `onSend: (text: string) => void \| Promise<void>`, `placeholder?`, `disabled?`, `enableAttachments?`, `enableVoiceMessage?`, `enableEmoji?`, `maxLength?`, `onTyping?` | Text input bar with attachments, emoji, voice |
| `ConnectionStatus` | see `ConnectionStatusProps` | Connection state banner/indicator |
| `TypingIndicator`, `Avatar`, `EmptyState` | see respective `*Props` | Small building blocks |
| `OfflineBanner` | see `OfflineBannerProps` | "You are offline" banner |
| `MessageStatusIndicator` | see `MessageStatusProps` | Sent/delivered/read/queued tick marks |
| `ReactionPicker`, `MessageReactions` | see respective `*Props` | Emoji reaction picker and reaction chips |
| `LinkPreview` | see `LinkPreviewProps` | URL preview card |
| `EmojiPicker` (+ `EmojiButton`, `EmojiGrid`, ...) | see respective `*Props` | Full emoji picker with search and skin tones |
| `NodeRenderer` | internal node UI | Renders interactive flow nodes |
| `ThemeProvider` | `theme?: ConferBotThemeOverride` | Deep-merges an override over `defaultTheme` |

### Hooks

| Hook | Returns | Description |
|------|---------|-------------|
| `useConferBot()` | full context (below) | Main headless API - state + actions |
| `useTheme()` | `ConferBotTheme` | Active theme tokens |
| `useAnalytics(options?)` | `trackEvent`, `trackUserAction`, `trackNodeVisit`, `trackUserMessage`, ... | Event tracking |
| `useNetworkStatus(options?)` | `isConnected`, `isInternetReachable`, `type`, `isLoading`, `refresh()` | Connectivity state |
| `useOfflineQueue(options)` | `isOnline`, `queue`, `queueSize`, `pendingCount`, `failedCount`, `queueMessage`, `retryMessage`, `retryAllFailed`, `clearQueue`, `processQueue`, ... | Offline queue control |
| `useReactions(...)` | `reactions`, `addReaction`, `removeReaction`, `toggleReaction`, `getGroupedReactions`, `hasUserReacted` | Reaction state |
| `useReadReceipts(options)` | see `UseReadReceiptsReturn` | Read receipt tracking |
| `usePersistence()` / `useDebouncedPersistence()` | see `UsePersistenceReturn` | Storage helpers |

### useConferBot() - state and actions

State: `isInitialized`, `isConnected`, `isOpen`, `chatSessionId?`, `unreadCount`, `currentAgent?: Agent`, `record: RecordItem[]`, `chatbotConfig?`, `reactions: Map<string, Reaction[]>`, `isRestoring`, `hasPersistedSession`, `messageStatuses`, `readReceiptsEnabled`, `isOnline`, `pendingMessageCount`, `failedMessageCount`, `serverCustomizations`, `botName`, `botAvatarUrl`, `currentUIState`, `isNodeProcessing`, `isLiveChatMode`, `agentTyping`, `visitorBlocked` (the closed line when the workspace blocked this visitor, else `null`), `emailTranscriptOpen`, `emailTranscriptSentTo`.

Actions:

| Method | Signature | Description |
|--------|-----------|-------------|
| `openChat` / `closeChat` | `() => void` | Toggle the open state / reset unread count |
| `sendMessage` | `(text: string, attachments?: MessageAttachment[]) => Promise<void>` | Send a visitor message |
| `submitNodeResponse` | `(response: any, portName?: string) => void` | Answer the active interactive flow node |
| `registerPushToken` | `(token: string) => Promise<void>` | Register a device push token |
| `on` / `off` | `(event: SocketEvents, cb: (...args: any[]) => void) => () => void` | Subscribe to socket events (`on` returns unsubscribe) |
| `addReaction` / `removeReaction` | `(messageId: string, emoji: ReactionEmoji) => void` | React to a message |
| `getReactions` | `(messageId: string) => Reaction[]` | Read reactions for a message |
| `getMessageStatus` | `(messageId: string \| number) => MessageStatus \| undefined` | Read receipt status |
| `markMessageAsRead` / `markVisibleMessagesAsRead` | `(id) => void` / `(ids) => void` | Mark inbound messages read |
| `retryFailedMessage` | `(messageId: string) => Promise<boolean>` | Retry one queued message |
| `retryAllFailedMessages` / `clearFailedMessages` | `() => Promise<number>` | Bulk queue operations |
| `clearPersistedData` / `resetConversation` | `() => Promise<void>` | Wipe stored session / start fresh |
| `rateKBArticle` | `(articleId: string, helpful: boolean, rating: number, feedback?: string) => void` | Rate a knowledge base article |
| `sendVisitorTyping` | `(isTyping: boolean) => void` | Emit visitor typing status |
| `leaveQueue` | `() => Promise<boolean>` | Leave the queue for a person (`queue-self-resolve`), then the flow carries on. `false` when a person already has the chat |
| `onWidgetSignal` | `(name, (detail) => void) => () => void` | Listen to `cb:waiting-for-human`, `cb:human-joined`, `cb:wait-over` (see Waiting for a person) |
| `openEmailTranscript` / `closeEmailTranscript` | `() => void` | Show / hide the "Email me this chat" card (the chat menu has it) |
| `emailTranscript` | `(email: string) => Promise<{ ok: boolean; message?: string }>` | Email the transcript to this address; on success the address is kept as the visitor's |

### Utilities and services

| Export | Description |
|--------|-------------|
| `ConferBotEndpoints` | `configure({ apiBaseUrl?, socketUrl? })` / `reset()` - endpoint overrides |
| `StorageService` | Session/user persistence over any `AsyncStorageInterface` |
| `OfflineQueueService` | Persistent retry queue with exponential backoff |
| `LinkPreviewService` / `linkPreviewService` | URL metadata fetching with cache |
| `AnalyticsService`, `getAnalyticsService()` | Batched analytics uploads |
| `FilePicker`, `formatFileSize`, `isFilePickerAvailable`, ... | Document/image/camera picking helpers |
| `detectUrls`, `parseTextForUrls`, `extractDomain`, ... | Link detection utilities |
| `NodeFlowEngine`, `ChatState`, `NodeHandlerRegistry`, `NodeTypes`, `registerAllHandlers` | Node flow engine internals for advanced use |
| `defaultTheme`, `darkTheme` | Built-in themes |
| `SocketEvents`, `MessageStatus`, `REACTION_EMOJIS` | Enums and constants |

## Troubleshooting

**The bot does not appear / chat stays empty**
- Confirm the bot is **published** in the dashboard - unpublished bots return no flow.
- Double-check the `botId` (Bot Settings > General). A wrong ID fails silently with an empty widget.
- Verify `https://wdt.conferbot.com` is reachable from the device/emulator (corporate proxies and emulator DNS are the usual suspects).
- Try the public demo bot `691c970890527a0468f9b2c9`, which works without an account - if it loads, the problem is your bot configuration, not the SDK.

**Socket never connects against a local server**
- Android emulators reach your host machine at `10.0.2.2`, not `localhost`.
- Plain `http://` targets require `android:usesCleartextTraffic="true"` (Android) or an ATS exception (iOS) in the example/native app.

**Sessions do not persist / offline queue does nothing**
- Install `@react-native-async-storage/async-storage` and pass it as `config.asyncStorage`. Without it these features are disabled by design.

**Dashboard colors are not showing up**
- Server customizations arrive with the chatbot data on connect - if the socket is not connected, the default theme is used. Also note server values intentionally override local themes inside the drop-in `ChatWidget` (see Theming above).

**Stale build issues**
- Reset Metro: `npx react-native start --reset-cache`, and rebuild the app after adding native peer dependencies.

## Example App

A fully working example app lives in [`example/`](example/) with a tab bar demonstrating all three integration patterns (Widget, Headless, Custom) plus the floating bubble.

```bash
# 1. Clone the repo
git clone https://github.com/conferbot/react-native-sdk.git
cd react-native-sdk

# 2. Build the SDK
npm install
npm run build

# 3. Set up the example app (installs deps, generates native projects)
cd example
./setup.sh

# 4. Configure credentials - open example/App.tsx and replace:
#      const API_KEY = 'test_key';
#      const BOT_ID = '69e8503cf33718a92ea792fe';
#    with your own values (or the public demo bot 691c970890527a0468f9b2c9).

# 5. Point at production - remove the ConferBotEndpoints.configure({...}) block
#    at the top of App.tsx. It targets a local embed-server (http://10.0.2.2:8001)
#    by default; without it the SDK uses https://wdt.conferbot.com.

# 6. Run on Android
npx react-native run-android

# 7. Or on iOS
cd ios && pod install && cd ..
npx react-native run-ios
```

| Tab | Pattern | Description |
|-----|---------|-------------|
| **Widget** | Floating bubble | `ConferBotWidget` FAB in the corner opening the chat modal |
| **Headless** | Hook-based | Custom UI with `useConferBot()` for full control |
| **Custom** | Mix & match | Pre-built components (`MessageList`, `ChatInput`) in a custom layout |

## Documentation

- [docs/USAGE.md](docs/USAGE.md) - Step-by-step integration tutorial
- [docs/API.md](docs/API.md) - Full API reference
- [docs/COMPONENTS.md](docs/COMPONENTS.md) - Component catalog
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) - SDK architecture overview
- [docs/EXAMPLES.md](docs/EXAMPLES.md) - Additional code examples

## Development

```bash
npm install           # Install dependencies
npm run build         # Compile TypeScript to lib/
npm run watch         # Watch mode
npm run lint          # ESLint
npm run type-check    # tsc --noEmit
npm test              # Jest tests
npm run test:coverage # Tests with coverage report
```

## Contributing

Contributions are welcome. Please open an issue first to discuss what you would like to change, then submit a pull request.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-change`)
3. Commit your changes
4. Push to your fork and open a pull request

## License

Apache 2.0 - see [LICENSE](LICENSE) for details.

## Links

- [Full Documentation](https://docs.conferbot.com/mobile/react-native)
- [GitHub Issues](https://github.com/conferbot/react-native-sdk/issues)
- [Conferbot Website](https://www.conferbot.com)
- [Support](mailto:support@conferbot.com)
