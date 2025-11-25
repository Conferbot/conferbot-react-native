# Component Architecture Plan

## Vision
Build the **best and easiest chatbot SDK in the world** with:
- **Headless core** - Full control for advanced users
- **Beautiful UI components** - Drop-in solution for quick integration
- **World-class DX** - Best developer experience possible

## Design Principles

### 1. Headless First
- Core functionality (context, socket, API) works without UI
- UI components are optional enhancement
- Zero dependencies between core and UI

### 2. Composable Architecture
- Each component works independently
- Can mix headless + pre-built components
- Easy to replace/customize individual pieces

### 3. Themeable
- Complete theme customization
- Dark mode support
- Brand colors, fonts, spacing
- Platform-specific styling (iOS/Android)

### 4. Accessible
- Screen reader support (AccessibilityInfo)
- Proper labels and hints
- Keyboard navigation
- High contrast support

### 5. Performant
- Virtual lists for long message history
- Memoization to prevent re-renders
- Lazy loading for images
- Optimized animations (native driver)

### 6. Mobile-First
- Native iOS and Android feel
- Platform-specific components
- Gesture support (swipe, long press)
- Haptic feedback

## Component Structure

```
src/
├── components/                    # Pre-built UI components
│   ├── ChatWidget/
│   │   ├── ChatWidget.tsx        # Main modal/overlay widget
│   │   ├── ChatWidget.styles.ts
│   │   └── index.ts
│   ├── ChatScreen/
│   │   ├── ChatScreen.tsx        # Full-screen chat
│   │   ├── ChatScreen.styles.ts
│   │   └── index.ts
│   ├── ChatHeader/
│   │   ├── ChatHeader.tsx        # Header with status/agent
│   │   ├── ChatHeader.styles.ts
│   │   └── index.ts
│   ├── MessageList/
│   │   ├── MessageList.tsx       # Virtualized message list
│   │   ├── MessageList.styles.ts
│   │   └── index.ts
│   ├── MessageBubble/
│   │   ├── MessageBubble.tsx     # Individual message
│   │   ├── BotMessage.tsx
│   │   ├── UserMessage.tsx
│   │   ├── AgentMessage.tsx
│   │   ├── SystemMessage.tsx
│   │   ├── MessageBubble.styles.ts
│   │   └── index.ts
│   ├── ChatInput/
│   │   ├── ChatInput.tsx         # Input with attachments
│   │   ├── ChatInput.styles.ts
│   │   └── index.ts
│   ├── AgentCard/
│   │   ├── AgentCard.tsx         # Agent profile display
│   │   ├── AgentCard.styles.ts
│   │   └── index.ts
│   ├── TypingIndicator/
│   │   ├── TypingIndicator.tsx   # Animated typing dots
│   │   ├── TypingIndicator.styles.ts
│   │   └── index.ts
│   ├── ConnectionStatus/
│   │   ├── ConnectionStatus.tsx  # Online/offline badge
│   │   ├── ConnectionStatus.styles.ts
│   │   └── index.ts
│   ├── FilePreview/
│   │   ├── FilePreview.tsx       # File/image preview
│   │   ├── ImagePreview.tsx
│   │   ├── FilePreview.styles.ts
│   │   └── index.ts
│   ├── QuickReplies/
│   │   ├── QuickReplies.tsx      # Quick reply buttons
│   │   ├── QuickReplies.styles.ts
│   │   └── index.ts
│   ├── Avatar/
│   │   ├── Avatar.tsx            # User/agent avatar
│   │   ├── Avatar.styles.ts
│   │   └── index.ts
│   ├── EmptyState/
│   │   ├── EmptyState.tsx        # Empty chat state
│   │   ├── EmptyState.styles.ts
│   │   └── index.ts
│   └── index.ts                   # Export all components
├── theme/
│   ├── ThemeProvider.tsx          # Theme context
│   ├── defaultTheme.ts            # Default light theme
│   ├── darkTheme.ts               # Default dark theme
│   ├── types.ts                   # Theme types
│   └── index.ts
├── hooks/
│   ├── useTheme.ts                # Theme hook
│   ├── useMessages.ts             # Message utilities
│   ├── useAnimations.ts           # Animation helpers
│   └── index.ts
└── utils/
    ├── animations.ts              # Animation configs
    ├── formatters.ts              # Date/time formatting
    ├── colors.ts                  # Color utilities
    └── index.ts
```

## Component Hierarchy

### ChatWidget (Modal/Overlay)
```
<ChatWidget visible={isOpen} onClose={closeChat}>
  <ChatHeader
    title="Support Chat"
    subtitle={connectionStatus}
    onClose={closeChat}
    agent={currentAgent}
  />

  <MessageList
    messages={record}
    loading={!isInitialized}
    onScroll={handleScroll}
  >
    <MessageBubble />
    <TypingIndicator visible={isAgentTyping} />
  </MessageList>

  <ChatInput
    onSend={sendMessage}
    onFileSelect={handleFileSelect}
    placeholder="Type a message..."
  />
</ChatWidget>
```

### ChatScreen (Full-screen)
```
<ChatScreen>
  # Same components, different layout/navigation
</ChatScreen>
```

## Theme System

### Theme Structure
```typescript
interface ConferBotTheme {
  mode: 'light' | 'dark';

  colors: {
    // Primary brand colors
    primary: string;
    primaryLight: string;
    primaryDark: string;

    // Secondary colors
    secondary: string;
    secondaryLight: string;
    secondaryDark: string;

    // Background colors
    background: string;
    surface: string;
    overlay: string;

    // Message bubble colors
    userBubble: string;
    userBubbleText: string;
    botBubble: string;
    botBubbleText: string;
    agentBubble: string;
    agentBubbleText: string;
    systemBubble: string;
    systemBubbleText: string;

    // Status colors
    success: string;
    warning: string;
    error: string;
    info: string;

    // Text colors
    text: string;
    textSecondary: string;
    textDisabled: string;
    textInverse: string;

    // Border colors
    border: string;
    borderLight: string;
    divider: string;

    // Special colors
    link: string;
    typing: string;
    online: string;
    offline: string;
  };

  typography: {
    fontFamily: string;
    fontFamilyBold: string;
    fontFamilyMedium: string;

    fontSize: {
      xs: number;
      sm: number;
      md: number;
      lg: number;
      xl: number;
      xxl: number;
    };

    fontWeight: {
      light: '300';
      regular: '400';
      medium: '500';
      semibold: '600';
      bold: '700';
    };

    lineHeight: {
      tight: number;
      normal: number;
      relaxed: number;
    };
  };

  spacing: {
    xs: number;    // 4
    sm: number;    // 8
    md: number;    // 16
    lg: number;    // 24
    xl: number;    // 32
    xxl: number;   // 48
  };

  borderRadius: {
    none: number;    // 0
    sm: number;      // 4
    md: number;      // 8
    lg: number;      // 12
    xl: number;      // 16
    full: number;    // 9999
  };

  shadows: {
    none: object;
    sm: object;
    md: object;
    lg: object;
    xl: object;
  };

  animations: {
    duration: {
      fast: number;     // 150ms
      normal: number;   // 300ms
      slow: number;     // 500ms
    };
    easing: {
      ease: string;
      easeIn: string;
      easeOut: string;
      easeInOut: string;
    };
  };

  layout: {
    headerHeight: number;
    inputHeight: number;
    maxBubbleWidth: number;
    avatarSize: number;
    iconSize: number;
  };
}
```

### Theme Usage
```typescript
// Use default theme
<ChatWidget />

// Use custom theme
<ThemeProvider theme={myCustomTheme}>
  <ChatWidget />
</ThemeProvider>

// Extend default theme
const myTheme = {
  ...defaultTheme,
  colors: {
    ...defaultTheme.colors,
    primary: '#FF6B6B',
    userBubble: '#FF6B6B',
  }
};

// Use dark theme
<ThemeProvider theme={darkTheme}>
  <ChatWidget />
</ThemeProvider>
```

## Key Features

### 1. Message Types
- **User messages** - Sent by user (blue, right-aligned)
- **Bot messages** - From chatbot (gray, left-aligned)
- **Agent messages** - From live agent (with avatar, left-aligned)
- **System messages** - Notifications (centered, gray)

### 2. Rich Content
- **Text** - With markdown support (bold, italic, links)
- **Images** - With preview and lightbox
- **Files** - With icons and download
- **Quick replies** - Button suggestions
- **Cards** - Structured content

### 3. Interactions
- **Send text** - Type and send
- **Send attachments** - Images, files
- **Quick replies** - Tap to send
- **Long press** - Copy message
- **Swipe** - Delete message (user only)
- **Pull to refresh** - Load more messages

### 4. Animations
- **Slide in** - Widget appears from bottom
- **Fade** - Message fade in
- **Typing dots** - Animated ellipsis
- **Shake** - Error state
- **Pulse** - New message indicator

### 5. States
- **Loading** - Initial connection
- **Empty** - No messages yet
- **Error** - Connection failed
- **Offline** - No internet
- **Typing** - Agent is typing
- **Success** - Message sent

## Component Props

### ChatWidget
```typescript
interface ChatWidgetProps {
  // Layout
  visible?: boolean;
  position?: 'bottom-right' | 'bottom-left' | 'center';
  height?: number | string;
  width?: number | string;

  // Behavior
  autoOpen?: boolean;
  closeOnBackdrop?: boolean;
  enableSwipeDown?: boolean;

  // Content
  title?: string;
  subtitle?: string;
  welcomeMessage?: string;
  placeholder?: string;

  // Callbacks
  onOpen?: () => void;
  onClose?: () => void;
  onMessageSent?: (message: string) => void;

  // Customization
  theme?: Partial<ConferBotTheme>;
  renderHeader?: (props) => ReactNode;
  renderMessage?: (message, props) => ReactNode;
  renderInput?: (props) => ReactNode;

  // Features
  enableAttachments?: boolean;
  enableQuickReplies?: boolean;
  enableTypingIndicator?: boolean;
  enableTimestamps?: boolean;
  enableAvatars?: boolean;
  enableSounds?: boolean;

  // Accessibility
  accessibilityLabel?: string;
  testID?: string;
}
```

### MessageBubble
```typescript
interface MessageBubbleProps {
  message: RecordItem;
  showAvatar?: boolean;
  showTimestamp?: boolean;
  maxWidth?: number;
  onPress?: () => void;
  onLongPress?: () => void;
  theme?: ConferBotTheme;
}
```

## Development Phases

### Phase 1: Theme System ✓
- [ ] Create theme types
- [ ] Build ThemeProvider
- [ ] Create default light theme
- [ ] Create default dark theme
- [ ] Add theme hook

### Phase 2: Base Components
- [ ] Avatar
- [ ] ConnectionStatus
- [ ] TypingIndicator
- [ ] EmptyState

### Phase 3: Message Components
- [ ] MessageBubble
- [ ] UserMessage
- [ ] BotMessage
- [ ] AgentMessage
- [ ] SystemMessage
- [ ] FilePreview
- [ ] QuickReplies

### Phase 4: Input Components
- [ ] ChatInput
- [ ] FileUploadButton
- [ ] SendButton
- [ ] EmojiPicker (optional)

### Phase 5: Container Components
- [ ] ChatHeader
- [ ] MessageList (with virtualization)
- [ ] ChatWidget (modal)
- [ ] ChatScreen (full-screen)

### Phase 6: Animations & Polish
- [ ] Slide animations
- [ ] Fade animations
- [ ] Typing animation
- [ ] Gesture handlers
- [ ] Haptic feedback

### Phase 7: Documentation
- [ ] Component API docs
- [ ] Theme documentation
- [ ] Usage examples
- [ ] Customization guide
- [ ] Migration guide (headless → UI)

### Phase 8: Testing & Examples
- [ ] Build test app
- [ ] Test all components
- [ ] Performance testing
- [ ] Accessibility testing
- [ ] Create example apps

## Usage Examples

### Minimal Setup (Pre-built UI)
```tsx
import { ConferBotProvider, ChatWidget } from '@conferbot/react-native';

function App() {
  return (
    <ConferBotProvider apiKey="..." botId="...">
      <YourApp />
      <ChatWidget />
    </ConferBotProvider>
  );
}
```

### With Custom Theme
```tsx
<ConferBotProvider apiKey="..." botId="...">
  <ThemeProvider theme={myTheme}>
    <ChatWidget
      title="Customer Support"
      welcomeMessage="Hi! How can we help?"
    />
  </ThemeProvider>
</ConferBotProvider>
```

### Headless (Current)
```tsx
const { record, sendMessage } = useConferBot();

// Build your own UI
<View>
  {record.map(msg => (
    <Text>{msg.text}</Text>
  ))}
</View>
```

### Mixed (Headless + Components)
```tsx
const { record, sendMessage } = useConferBot();

// Use some pre-built components
<View>
  <MessageList messages={record} />
  <MyCustomInput onSend={sendMessage} />
</View>
```

## Success Criteria

- ✅ Drop-in widget works in < 5 minutes
- ✅ Full theme customization in < 10 minutes
- ✅ 60fps animations on mid-range devices
- ✅ < 100KB bundle size increase
- ✅ 100% TypeScript coverage
- ✅ Accessibility score 100%
- ✅ Works on iOS 12+ and Android API 21+
- ✅ Comprehensive documentation
- ✅ Example app for every use case

Let's build the best React Native chatbot SDK in the world! 🚀
