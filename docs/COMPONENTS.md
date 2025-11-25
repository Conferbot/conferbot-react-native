# UI Components Guide

Complete guide to using Conferbot's pre-built UI components.

## Quick Start

### Option 1: Drop-in Widget (Easiest)

```tsx
import { ConferBotProvider, ChatWidget } from '@conferbot/react-native';

function App() {
  return (
    <ConferBotProvider apiKey="your-api-key" botId="your-bot-id">
      <YourApp />
      <ChatWidget />
    </ConferBotProvider>
  );
}
```

That's it! Full chat in 4 lines.

### Option 2: Build Custom UI (Headless)

```tsx
import { ConferBotProvider, useConferBot } from '@conferbot/react-native';

function CustomChat() {
  const { record, sendMessage } = useConferBot();

  return (
    <View>
      {record.map(msg => <Text>{msg.text}</Text>)}
    </View>
  );
}
```

Use context, build your own UI.

### Option 3: Mix & Match

```tsx
import { useConferBot, MessageList, ChatInput } from '@conferbot/react-native';

function CustomChat() {
  const { record, sendMessage } = useConferBot();

  return (
    <View>
      <MessageList messages={record} />
      <MyCustomInput onSend={sendMessage} />
    </View>
  );
}
```

Use our components where you want, custom where you need.

---

## Components

### ChatWidget

Complete chat interface in a modal.

```tsx
<ChatWidget
  title="Support"
  placeholder="Type a message..."
/>
```

**Props:**
- `title` - Header title
- `placeholder` - Input placeholder
- `showTimestamps` - Show message times
- `onClose` - Close callback

### MessageList

Scrollable list of messages.

```tsx
<MessageList
  messages={record}
  showTimestamps={true}
/>
```

**Props:**
- `messages` - Array of messages
- `showTypingIndicator` - Show "typing..."
- `showTimestamps` - Show times
- `showAvatars` - Show avatars

### MessageBubble

Individual message display.

```tsx
<MessageBubble
  message={msg}
  showAvatar={true}
  onLongPress={() => copyMessage(msg)}
/>
```

**Props:**
- `message` - Message object
- `showAvatar` - Show avatar
- `showTimestamp` - Show time
- `onPress` - Tap handler
- `onLongPress` - Long press handler

### ChatInput

Message input with send button.

```tsx
<ChatInput
  onSend={(text) => sendMessage(text)}
  placeholder="Type..."
/>
```

**Props:**
- `onSend` - Send callback
- `placeholder` - Placeholder text
- `disabled` - Disable input
- `maxLength` - Max characters

### ChatHeader

Header with title and close button.

```tsx
<ChatHeader
  title="Support Chat"
  subtitle="Online"
  agent={currentAgent}
  onClose={closeChat}
/>
```

**Props:**
- `title` - Header title
- `subtitle` - Subtitle text
- `agent` - Current agent
- `onClose` - Close callback
- `showConnectionStatus` - Show online/offline

### Avatar

User/agent avatar with initials fallback.

```tsx
<Avatar
  source={agent.avatar}
  name={agent.name}
  size={40}
/>
```

**Props:**
- `source` - Image URL
- `name` - Name for initials
- `size` - Size in pixels
- `shape` - 'circle' | 'square' | 'rounded'

### TypingIndicator

Animated typing dots.

```tsx
<TypingIndicator visible={isAgentTyping} />
```

**Props:**
- `visible` - Show/hide
- `dotColor` - Dot color
- `dotSize` - Dot size

### ConnectionStatus

Online/offline indicator.

```tsx
<ConnectionStatus
  variant="badge"
  showWhenOnline={false}
/>
```

**Props:**
- `variant` - 'dot' | 'badge' | 'text'
- `onlineLabel` - Online text
- `offlineLabel` - Offline text
- `showWhenOnline` - Show when connected

### EmptyState

Empty chat placeholder.

```tsx
<EmptyState
  title="No messages yet"
  message="Start a conversation"
/>
```

**Props:**
- `title` - Title text
- `message` - Subtitle text
- `icon` - Custom icon
- `action` - Custom action button

---

## Theming

### Use Default Themes

```tsx
import { ThemeProvider, darkTheme } from '@conferbot/react-native';

<ThemeProvider theme={darkTheme}>
  <ChatWidget />
</ThemeProvider>
```

### Custom Theme

```tsx
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

### Theme Properties

```typescript
{
  colors: {
    primary, secondary, background, surface,
    userBubble, botBubble, agentBubble, systemBubble,
    text, textSecondary, textDisabled,
    border, divider,
    success, error, warning, info,
    online, offline
  },
  typography: {
    fontSize: { xs, sm, md, lg, xl, xxl },
    fontWeight: { light, regular, medium, semibold, bold }
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 },
  borderRadius: { none, sm, md, lg, xl, full },
  shadows: { none, sm, md, lg, xl }
}
```

---

## Common Patterns

### Basic Chat Screen

```tsx
import { useConferBot, ChatHeader, MessageList, ChatInput } from '@conferbot/react-native';

function ChatScreen() {
  const { record, sendMessage, currentAgent, closeChat } = useConferBot();

  return (
    <View style={{ flex: 1 }}>
      <ChatHeader
        title="Support"
        agent={currentAgent}
        onClose={closeChat}
      />
      <MessageList messages={record} />
      <ChatInput onSend={sendMessage} />
    </View>
  );
}
```

### With Typing Indicator

```tsx
import { SocketEvents } from '@conferbot/react-native';

function ChatScreen() {
  const { record, on } = useConferBot();
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    return on(SocketEvents.AGENT_TYPING_STATUS, (data) => {
      setTyping(data.isTyping);
    });
  }, []);

  return (
    <MessageList
      messages={record}
      showTypingIndicator={typing}
    />
  );
}
```

### With Custom Empty State

```tsx
<MessageList
  messages={record}
  emptyComponent={
    <EmptyState
      title="Welcome!"
      message="How can we help you today?"
      action={
        <Button title="Quick Help" onPress={showQuickHelp} />
      }
    />
  }
/>
```

### Handle Message Actions

```tsx
<MessageBubble
  message={msg}
  onLongPress={() => {
    Alert.alert('Message Actions', '', [
      { text: 'Copy', onPress: () => Clipboard.setString(msg.text) },
      { text: 'Delete', onPress: () => deleteMessage(msg) },
      { text: 'Cancel', style: 'cancel' }
    ]);
  }}
/>
```

---

## TypeScript Support

All components are fully typed:

```tsx
import type {
  ChatWidgetProps,
  MessageBubbleProps,
  ChatInputProps,
  ConferBotTheme
} from '@conferbot/react-native';
```

---

## Performance Tips

### MessageList Optimization

- Uses FlatList virtualization
- Only renders visible messages
- Auto-scrolls to new messages
- Handles thousands of messages efficiently

### Best Practices

```tsx
// ✅ Good - Let MessageList handle rendering
<MessageList messages={record} />

// ❌ Bad - Manual loop kills performance
{record.map(msg => <MessageBubble message={msg} />)}
```

---

## Accessibility

All components have built-in accessibility:

- Screen reader labels
- Keyboard navigation
- High contrast support
- Focus management

Test with:
```bash
# iOS
Settings > Accessibility > VoiceOver

# Android
Settings > Accessibility > TalkBack
```

---

## Need Help?

- **Documentation**: [docs.conferbot.com](https://docs.conferbot.com)
- **Examples**: See `/docs/EXAMPLES.md`
- **Issues**: [GitHub Issues](https://github.com/conferbot/react-native-sdk/issues)
- **Email**: support@conferbot.com
