# Conferbot React Native SDK - Example App

This example app demonstrates how to integrate and use the Conferbot React Native SDK in a real application.

## What's Included

### Three Usage Patterns

1. **Drop-in Widget** (`App.tsx`)
   - Full-featured chat modal
   - Easiest integration (4 lines of code)
   - Perfect for getting started quickly

2. **Headless SDK** (`src/HeadlessExample.tsx`)
   - Use SDK context to build custom UI
   - Full control over design and behavior
   - Best for unique UX requirements

3. **Mix & Match** (`src/CustomExample.tsx`)
   - Combine pre-built components with custom UI
   - Use our components where convenient
   - Build custom pieces where needed

## Prerequisites

Before running the example, make sure you have:

- **Node.js** >= 18
- **React Native CLI** installed globally
- **Xcode** (for iOS development)
- **Android Studio** (for Android development)
- **Conferbot API Key** and **Bot ID**

## Setup Instructions

### 1. Install Dependencies

```bash
# From the example directory
cd example
npm install

# Install iOS pods (iOS only)
cd ios && pod install && cd ..
```

### 2. Configure Your API Credentials

Open `App.tsx` and replace the placeholder values:

```typescript
const API_KEY = 'conf_sk_your_api_key_here';  // Your actual API key
const BOT_ID = 'your_bot_id_here';            // Your actual bot ID
```

You can get these from your Conferbot dashboard.

### 3. Link the SDK (Development Mode)

The example app is configured to use the SDK from the parent directory via Metro bundler. This allows you to test changes to the SDK immediately.

If you encounter module resolution issues:

```bash
# From the SDK root directory (parent of example/)
npm run build

# Clean the example app
cd example
rm -rf node_modules
npm install
```

## Running the App

### iOS

```bash
npm run ios

# Or specify a simulator
npm run ios -- --simulator="iPhone 15 Pro"
```

### Android

```bash
# Start Metro bundler
npm start

# In another terminal, run Android
npm run android
```

## Testing the Integration

### 1. Test Drop-in Widget

1. Launch the app
2. Tap "Open Chat Widget"
3. The full chat modal should open
4. Try sending messages
5. Check connection status indicator

### 2. Test Headless SDK

1. Modify `App.tsx` to render `<HeadlessExample />`
2. Reload the app
3. You'll see a custom UI built with SDK context
4. All chat functionality works the same

### 3. Test Mix & Match

1. Modify `App.tsx` to render `<CustomExample />`
2. Reload the app
3. You'll see pre-built components with custom layout
4. Demonstrates component composition

## Troubleshooting

### Module Not Found: @conferbot/react-native

This means the SDK isn't linked properly. Fix it:

```bash
# From SDK root directory
npm run build

# From example directory
rm -rf node_modules
npm install
```

### Socket Connection Failed

1. Make sure your API key and bot ID are correct
2. Check that the embed server is running (if using local)
3. Check network connectivity
4. Look for connection errors in console logs

### Build Errors (iOS)

```bash
cd ios
pod deintegrate
pod install
cd ..
npm run ios
```

### Build Errors (Android)

```bash
cd android
./gradlew clean
cd ..
npm run android
```

### Metro Bundler Cache Issues

```bash
npm start -- --reset-cache
```

## Project Structure

```
example/
├── App.tsx                      # Main app with drop-in widget
├── src/
│   ├── HeadlessExample.tsx     # Custom UI with SDK context
│   └── CustomExample.tsx       # Mix pre-built + custom components
├── package.json                # Dependencies
├── metro.config.js             # Metro bundler config (SDK linking)
├── tsconfig.json               # TypeScript config
└── README.md                   # This file
```

## Key Features Demonstrated

### ✅ Real-time Messaging
- Send and receive messages instantly
- Socket.IO connection management
- Automatic reconnection

### ✅ Live Agent Handover
- Bot-to-human escalation
- Agent presence indicators
- Typing status

### ✅ UI Customization
- Theme customization
- Custom components
- Flexible layouts

### ✅ Offline Support
- Message queueing when disconnected
- Automatic retry on reconnection
- Connection status indicators

### ✅ TypeScript Support
- Full type safety
- IntelliSense support
- Type definitions for all APIs

## Next Steps

1. **Customize the Theme**
   ```typescript
   import { ThemeProvider, defaultTheme } from '@conferbot/react-native';

   const myTheme = {
     ...defaultTheme,
     colors: {
       ...defaultTheme.colors,
       primary: '#FF6B6B',
       userBubble: '#FF6B6B',
     }
   };

   <ThemeProvider theme={myTheme}>
     <ChatWidget />
   </ThemeProvider>
   ```

2. **Add Event Listeners**
   ```typescript
   import { SocketEvents } from '@conferbot/react-native';

   useEffect(() => {
     const unsubscribe = on(SocketEvents.AGENT_ACCEPTED, (data) => {
       Alert.alert('Agent joined!', data.agent.name);
     });
     return unsubscribe;
   }, []);
   ```

3. **Build Your Own UI**
   - Use `HeadlessExample.tsx` as a starting point
   - Access all SDK features via `useConferBot()` hook
   - Design chat UI that matches your app

## Documentation

- **SDK Documentation**: `../docs/`
- **Component Guide**: `../docs/COMPONENTS.md`
- **API Reference**: `../docs/API.md`
- **Architecture**: `../docs/ARCHITECTURE.md`

## Support

- **GitHub Issues**: https://github.com/conferbot/react-native-sdk/issues
- **Email**: support@conferbot.com
- **Docs**: https://docs.conferbot.com

## License

MIT
