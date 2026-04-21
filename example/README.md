# Conferbot React Native SDK - Example App

This example app demonstrates how to integrate and use the Conferbot React Native SDK. It includes three usage patterns you can switch between using the built-in tab navigation.

## What's Included

1. **Drop-in Widget** - Full-featured chat modal. Easiest integration (4 lines of code).
2. **Headless SDK** - Use the SDK context to build a completely custom chat UI.
3. **Mix & Match** - Combine pre-built SDK components with your own custom pieces.

All three examples are accessible from the app's tab bar -- no code changes needed to try each one.

## Prerequisites

- **Node.js** >= 18
- **React Native CLI** (`npm install -g react-native`)
- **Xcode** 15+ (for iOS) with CocoaPods (`gem install cocoapods`)
- **Android Studio** with Android SDK 34 (for Android)
- **Conferbot API Key** and **Bot ID** from your Conferbot dashboard

## Setup

```bash
# 1. Clone the SDK repo (if you haven't already)
git clone <repo-url>
cd conferbot-react-native

# 2. Build the SDK
npm install
npm run build

# 3. Set up the example app
cd example
chmod +x setup.sh
./setup.sh
```

The `setup.sh` script will:
- Install npm dependencies (if `node_modules/` is missing)
- Generate `android/` and `ios/` native directories using `react-native init` (if missing)
- Run `pod install` for iOS (if CocoaPods is available)

### Configure API Credentials

Open `App.tsx` and replace the placeholder values:

```typescript
const API_KEY = 'conf_sk_your_api_key_here';  // Your actual API key
const BOT_ID = 'your_bot_id_here';            // Your actual bot ID
```

## Running the App

### iOS

```bash
npx react-native run-ios

# Or target a specific simulator
npx react-native run-ios --simulator="iPhone 15 Pro"
```

### Android

```bash
# Start Metro bundler in one terminal
npx react-native start

# Run on Android in another terminal
npx react-native run-android
```

## Troubleshooting

### Module Not Found: @conferbot/react-native

The SDK is linked via `file:..` in package.json. Make sure the parent SDK is built:

```bash
cd ..
npm run build
cd example
rm -rf node_modules
npm install
```

### iOS Build Errors

```bash
cd ios
pod deintegrate
pod install
cd ..
npx react-native run-ios
```

### Android Build Errors

```bash
cd android
./gradlew clean
cd ..
npx react-native run-android
```

### Metro Bundler Cache Issues

```bash
npx react-native start --reset-cache
```

## Project Structure

```
example/
  App.tsx                       # Main app with tab navigation between examples
  src/
    HeadlessExample.tsx         # Custom UI built with SDK context
    CustomExample.tsx           # Mix of pre-built + custom components
  setup.sh                      # One-command setup script
  package.json
  metro.config.js
  tsconfig.json
```

## Documentation

- SDK Docs: `../docs/`
- Component Guide: `../docs/COMPONENTS.md`
- API Reference: `../docs/API.md`

## Support

- GitHub Issues: https://github.com/conferbot/react-native-sdk/issues
- Email: support@conferbot.com
- Docs: https://docs.conferbot.com
