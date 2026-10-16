# Conferbot React Native SDK: example app

A small app that shows the three ways to use the SDK, one per tab, with the floating launcher on top:

| Tab | Pattern | File |
|---|---|---|
| **Widget** | The drop-in chat behind the floating launcher (`ConferBotWidget`) | `App.tsx` |
| **Headless** | Your own UI on `useConferBot()` | `src/HeadlessExample.tsx` |
| **Custom** | The SDK's `MessageList`, `ChatInput` and `ChatHeader` in your own layout | `src/CustomExample.tsx` |

Out of the box it talks to Conferbot's cloud (`https://wdt.conferbot.com`) with the public demo bot `691c970890527a0468f9b2c9`, so it runs without an account.

## Prerequisites

- Node.js 18 or later
- For Android: Android Studio with the Android 14 SDK (API 34) and an emulator or a device
- For iOS (macOS only): Xcode 15 or later and CocoaPods (`gem install cocoapods`)

The app uses React Native 0.73. It installs the SDK from the parent folder (`"@conferbot/react-native": "file:.."`), with `@react-native-async-storage/async-storage` and `react-native-svg`.

## Set up

```bash
# From the SDK repo's root: build the SDK the example installs
npm install
npm run build

# Then the example
cd example
./setup.sh
```

`setup.sh` does three things:

1. Runs `npm install` if `node_modules/` is missing.
2. Creates the missing native folders. `android/` is in the repo; `ios/` is generated with `react-native init` (React Native 0.73.0).
3. Runs `pod install` when CocoaPods is available.

## Run it against Conferbot's cloud

This is the default: nothing to configure.

```bash
npx react-native start          # Metro, in one terminal

npx react-native run-android    # in another
# or
npx react-native run-ios
```

### Use your own bot

1. In the [Conferbot dashboard](https://app.conferbot.com), open **Chatbots**. On your bot's card, open the **⋯** menu and choose **Install on your site**. Under **Mobile apps**, pick **React Native**: the snippet shows your bot ID.
2. In `App.tsx`, set `BOT_ID` to it. `API_KEY` can stay as it is: the mobile API doesn't check it.
3. Publish the bot in the dashboard. Metro reloads the app.

## Run it against a local server

This is for Conferbot developers working on the embed-server.

1. Start the embed-server (the `embed-server` repo) with `npm run dev`. It listens on the port in its `.env`: `PORT=8001` locally.
2. In `App.tsx`, set `BOT_ID` to a bot in that server's database.
3. In `App.tsx`, uncomment the `ConferBotEndpoints.configure(...)` block at the top. Point it at the server as your device reaches it:

   | Running on | `socketUrl` | `apiBaseUrl` |
   |---|---|---|
   | Android emulator | `http://10.0.2.2:8001` | `http://10.0.2.2:8001/api/v1/mobile` |
   | Android emulator or device, with `adb reverse tcp:8001 tcp:8001` | `http://localhost:8001` | `http://localhost:8001/api/v1/mobile` |
   | iOS simulator | `http://localhost:8001` | `http://localhost:8001/api/v1/mobile` |
   | A physical device on your Wi-Fi | `http://<your machine's LAN IP>:8001` | `http://<LAN IP>:8001/api/v1/mobile` |

4. Reload the app.

```ts
ConferBotEndpoints.configure({
  socketUrl: 'http://10.0.2.2:8001',
  apiBaseUrl: 'http://10.0.2.2:8001/api/v1/mobile',
});
```

The configure call must run before the provider renders, which is why it sits at the top of `App.tsx`.

**Plain HTTP.**

- **Android**: the example's manifests already allow cleartext traffic (`android:usesCleartextTraffic="true"`).
- **iOS**: the generated `Info.plist` allows `localhost` (`NSAllowsLocalNetworking`). A LAN IP needs an exception. Add it under `NSAppTransportSecurity` > `NSExceptionDomains` with `NSExceptionAllowsInsecureHTTPLoads`, or use `NSAllowsArbitraryLoads` in a debug build only.

**Metro on a device.** Run `adb reverse tcp:8081 tcp:8081` so the app reaches Metro.

**Before you commit.** Put `App.tsx` back (the `configure` block commented out, the demo `BOT_ID`), so the example keeps running against the cloud.

## Troubleshooting

**`Module not found: @conferbot/react-native`.** The example installs the built SDK from `..`. Build it, then reinstall:

```bash
cd .. && npm run build && cd example
rm -rf node_modules && npm install
```

**The chat stays empty.**
- Check `BOT_ID`, and that the bot is published.
- Against a local server, check both URLs and the port. `10.0.2.2` works only from the Android emulator.

**An SDK change doesn't show.** Run `npm run build` in the repo root again, then restart Metro with `npx react-native start --reset-cache`.

**iOS build errors.**

```bash
cd ios && pod deintegrate && pod install && cd ..
npx react-native run-ios
```

**Android build errors.**

```bash
cd android && ./gradlew clean && cd ..
npx react-native run-android
```

## Project structure

```
example/
  App.tsx                 # Tabs, the provider, the floating launcher, BOT_ID and the endpoints block
  src/
    HeadlessExample.tsx   # Your own UI on useConferBot()
    CustomExample.tsx     # SDK components in your own layout
  android/                # Android project (in the repo)
  ios/                    # Generated by setup.sh
  setup.sh                # One-command setup
  package.json
  metro.config.js
  tsconfig.json
```

## More

- The SDK's guide: [../README.md](../README.md)
- What changed: [../CHANGELOG.md](../CHANGELOG.md)
- Issues: https://github.com/Conferbot/conferbot-react-native/issues
