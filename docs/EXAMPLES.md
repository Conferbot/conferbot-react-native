# Usage Examples

Common usage patterns and examples for the Conferbot React Native SDK.

## Table of Contents

- [Basic Setup](#basic-setup)
- [Simple Chat Screen](#simple-chat-screen)
- [Chat with Message History](#chat-with-message-history)
- [Live Agent Handover](#live-agent-handover)
- [Push Notifications](#push-notifications)
- [File Attachments](#file-attachments)
- [Custom Event Handling](#custom-event-handling)
- [Typing Indicators](#typing-indicators)
- [Offline Support](#offline-support)
- [Error Handling](#error-handling)

---

## Basic Setup

Minimal setup to get started:

```tsx
// App.tsx
import React from 'react';
import { ConferBotProvider } from '@conferbot/react-native';
import HomeScreen from './screens/HomeScreen';

export default function App() {
  return (
    <ConferBotProvider
      apiKey="conf_sk_your_api_key"
      botId="your_bot_id"
    >
      <HomeScreen />
    </ConferBotProvider>
  );
}
```

---

## Simple Chat Screen

Basic chat interface:

```tsx
// screens/ChatScreen.tsx
import React from 'react';
import { View, Button, Text, StyleSheet } from 'react-native';
import { useConferBot } from '@conferbot/react-native';

export default function ChatScreen() {
  const { openChat, isConnected, unreadCount } = useConferBot();

  return (
    <View style={styles.container}>
      <Text style={styles.status}>
        Status: {isConnected ? '🟢 Connected' : '🔴 Offline'}
      </Text>

      {unreadCount > 0 && (
        <Text style={styles.badge}>{unreadCount} new messages</Text>
      )}

      <Button
        title="Open Support Chat"
        onPress={openChat}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  status: {
    fontSize: 16,
    marginBottom: 10,
  },
  badge: {
    backgroundColor: 'red',
    color: 'white',
    padding: 5,
    borderRadius: 10,
    marginBottom: 10,
  },
});
```

---

## Chat with Message History

Display full chat history:

```tsx
import React from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useConferBot } from '@conferbot/react-native';

export default function FullChatScreen() {
  const { record, sendMessage, isConnected } = useConferBot();
  const [inputText, setInputText] = React.useState('');

  const handleSend = async () => {
    if (inputText.trim()) {
      await sendMessage(inputText);
      setInputText('');
    }
  };

  const renderMessage = (item, index) => {
    const isUser = item.type === 'user-input-response';
    const isBot = item.type === 'bot-message';
    const isAgent = item.type === 'agent-message';

    return (
      <View
        key={index}
        style={[
          styles.messageBubble,
          isUser ? styles.userBubble : styles.botBubble,
        ]}
      >
        {isAgent && (
          <Text style={styles.agentName}>{item.agent?.name}</Text>
        )}
        <Text style={styles.messageText}>{item.text}</Text>
        <Text style={styles.messageTime}>
          {new Date(item.time).toLocaleTimeString()}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Status Bar */}
      <View style={styles.header}>
        <Text style={styles.headerText}>
          {isConnected ? '🟢 Connected' : '🔴 Reconnecting...'}
        </Text>
      </View>

      {/* Messages */}
      <ScrollView style={styles.messagesContainer}>
        {record.map(renderMessage)}
      </ScrollView>

      {/* Input */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Type a message..."
          multiline
        />
        <TouchableOpacity
          style={styles.sendButton}
          onPress={handleSend}
          disabled={!isConnected || !inputText.trim()}
        >
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 15,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  headerText: {
    fontSize: 16,
    fontWeight: '600',
  },
  messagesContainer: {
    flex: 1,
    padding: 10,
  },
  messageBubble: {
    padding: 12,
    marginVertical: 5,
    borderRadius: 15,
    maxWidth: '80%',
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#007AFF',
  },
  botBubble: {
    alignSelf: 'flex-start',
    backgroundColor: 'white',
  },
  messageText: {
    fontSize: 16,
  },
  messageTime: {
    fontSize: 11,
    opacity: 0.6,
    marginTop: 5,
  },
  agentName: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#007AFF',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 8,
    marginRight: 10,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: '#007AFF',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  sendButtonText: {
    color: 'white',
    fontWeight: '600',
  },
});
```

---

## Live Agent Handover

Handle live agent connections:

```tsx
import React, { useEffect } from 'react';
import { View, Text, Alert } from 'react-native';
import { useConferBot, SocketEvents } from '@conferbot/react-native';

export default function AgentChat() {
  const { currentAgent, on, record } = useConferBot();

  useEffect(() => {
    // Agent joined
    const unsubscribeAccepted = on(SocketEvents.AGENT_ACCEPTED, (data) => {
      Alert.alert(
        'Agent Connected',
        `${data.agent.name} has joined the chat`
      );
    });

    // Agent left
    const unsubscribeLeft = on(SocketEvents.AGENT_LEFT, () => {
      Alert.alert(
        'Agent Left',
        'The agent has left the chat. You are now chatting with the bot.'
      );
    });

    return () => {
      unsubscribeAccepted();
      unsubscribeLeft();
    };
  }, []);

  return (
    <View>
      {currentAgent ? (
        <View style={styles.agentInfo}>
          <Text style={styles.agentName}>
            Chatting with {currentAgent.name}
          </Text>
          {currentAgent.avatar && (
            <Image
              source={{ uri: currentAgent.avatar }}
              style={styles.agentAvatar}
            />
          )}
        </View>
      ) : (
        <Text style={styles.botMode}>Chatting with AI Bot</Text>
      )}
    </View>
  );
}
```

---

## Push Notifications

Setup push notifications (Firebase):

```tsx
// App.tsx
import React, { useEffect } from 'react';
import messaging from '@react-native-firebase/messaging';
import { ConferBotProvider, useConferBot } from '@conferbot/react-native';

function PushNotificationSetup() {
  const { registerPushToken } = useConferBot();

  useEffect(() => {
    // Request permission (iOS)
    async function requestPermission() {
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (enabled) {
        console.log('Push notification permission granted');
      }
    }

    // Get FCM token
    async function getFCMToken() {
      const token = await messaging().getToken();
      console.log('FCM Token:', token);

      // Register with Conferbot
      await registerPushToken(token);
    }

    requestPermission();
    getFCMToken();

    // Listen for token refresh
    const unsubscribe = messaging().onTokenRefresh((token) => {
      registerPushToken(token);
    });

    return unsubscribe;
  }, []);

  return null;
}

export default function App() {
  return (
    <ConferBotProvider apiKey="..." botId="...">
      <PushNotificationSetup />
      <YourApp />
    </ConferBotProvider>
  );
}
```

---

## File Attachments

Send images and files:

```tsx
import React from 'react';
import { Button, Platform } from 'react-native';
import ImagePicker from 'react-native-image-picker';
import { useConferBot } from '@conferbot/react-native';

export default function FileUploadExample() {
  const { sendMessage } = useConferBot();

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibrary({
      mediaType: 'photo',
      quality: 0.8,
    });

    if (!result.didCancel && result.assets?.[0]) {
      const image = result.assets[0];

      await sendMessage('Here is the image:', [
        {
          type: 'image',
          uri: image.uri,
          name: image.fileName || 'image.jpg',
          size: image.fileSize,
          mimeType: image.type,
        },
      ]);
    }
  };

  return <Button title="Send Image" onPress={pickImage} />;
}
```

---

## Custom Event Handling

Listen to specific events:

```tsx
import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { useConferBot, SocketEvents } from '@conferbot/react-native';

export default function CustomEventHandler() {
  const { on } = useConferBot();
  const [isAgentTyping, setIsAgentTyping] = useState(false);

  useEffect(() => {
    // Agent typing indicator
    const unsubscribe = on(SocketEvents.AGENT_TYPING_STATUS, (data) => {
      setIsAgentTyping(data.isTyping);
    });

    return unsubscribe;
  }, []);

  return (
    <View>
      {isAgentTyping && (
        <Text style={styles.typing}>Agent is typing...</Text>
      )}
    </View>
  );
}
```

---

## Typing Indicators

Show when user is typing:

```tsx
import React, { useState, useEffect, useRef } from 'react';
import { TextInput } from 'react-native';
import { useConferBot } from '@conferbot/react-native';

export default function ChatInput() {
  const { chatSessionId } = useConferBot();
  const [text, setText] = useState('');
  const socketClient = useRef(/* get socket client somehow */);
  const typingTimeout = useRef(null);

  const handleTextChange = (newText) => {
    setText(newText);

    // Clear previous timeout
    if (typingTimeout.current) {
      clearTimeout(typingTimeout.current);
    }

    // Send typing started
    if (newText.length > 0 && chatSessionId) {
      socketClient.current?.sendVisitorTyping(chatSessionId, true);

      // Auto-stop typing after 3 seconds
      typingTimeout.current = setTimeout(() => {
        socketClient.current?.sendVisitorTyping(chatSessionId, false);
      }, 3000);
    }
  };

  return (
    <TextInput
      value={text}
      onChangeText={handleTextChange}
      placeholder="Type a message..."
    />
  );
}
```

---

## Offline Support

Handle offline state gracefully:

```tsx
import React, { useEffect, useState } from 'react';
import { View, Text, Alert } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useConferBot } from '@conferbot/react-native';

export default function OfflineHandler() {
  const { isConnected, sendMessage } = useConferBot();
  const [isOnline, setIsOnline] = useState(true);
  const [pendingMessages, setPendingMessages] = useState([]);

  useEffect(() => {
    // Monitor network status
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(state.isConnected);

      // Send pending messages when back online
      if (state.isConnected && pendingMessages.length > 0) {
        pendingMessages.forEach(msg => sendMessage(msg));
        setPendingMessages([]);
      }
    });

    return () => unsubscribe();
  }, [pendingMessages]);

  const handleSendMessage = async (text) => {
    if (!isOnline) {
      // Queue message for later
      setPendingMessages([...pendingMessages, text]);
      Alert.alert('Offline', 'Message will be sent when connection is restored');
    } else {
      await sendMessage(text);
    }
  };

  return (
    <View>
      {!isOnline && (
        <Text style={styles.offlineWarning}>
          ⚠️ You are offline. Messages will be sent when connection is restored.
        </Text>
      )}
      {!isConnected && isOnline && (
        <Text style={styles.reconnecting}>
          🔄 Reconnecting to chat server...
        </Text>
      )}
    </View>
  );
}
```

---

## Error Handling

Robust error handling:

```tsx
import React, { useState } from 'react';
import { Alert } from 'react-native';
import { useConferBot } from '@conferbot/react-native';

export default function ErrorHandlingExample() {
  const { sendMessage } = useConferBot();
  const [isSending, setIsSending] = useState(false);

  const handleSendWithRetry = async (text, retries = 3) => {
    setIsSending(true);

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await sendMessage(text);
        setIsSending(false);
        return; // Success
      } catch (error) {
        console.error(`Send attempt ${attempt} failed:`, error);

        if (attempt === retries) {
          // Final attempt failed
          setIsSending(false);
          Alert.alert(
            'Error',
            'Failed to send message. Please try again later.',
            [
              { text: 'Retry', onPress: () => handleSendWithRetry(text) },
              { text: 'Cancel', style: 'cancel' },
            ]
          );
        } else {
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }
  };

  return null; // Your UI here
}
```

---

## Complete Chat Application

Putting it all together:

```tsx
// App.tsx
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { ConferBotProvider } from '@conferbot/react-native';

import HomeScreen from './screens/HomeScreen';
import ChatScreen from './screens/ChatScreen';

const Stack = createStackNavigator();

export default function App() {
  return (
    <ConferBotProvider
      apiKey={process.env.CONFERBOT_API_KEY}
      botId={process.env.CONFERBOT_BOT_ID}
      config={{
        autoConnect: true,
        enableNotifications: true,
      }}
      user={{
        id: 'user_12345',
        name: 'John Doe',
        email: 'john@example.com',
      }}
    >
      <NavigationContainer>
        <Stack.Navigator>
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="Chat" component={ChatScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </ConferBotProvider>
  );
}
```

For more examples, check the `/examples` directory in the repository.
