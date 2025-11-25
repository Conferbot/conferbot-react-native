import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useConferBot, SocketEvents } from '@conferbot/react-native';

/**
 * Headless SDK Example
 *
 * This shows how to use the SDK context to build your own UI from scratch.
 * You have full control over the design and behavior.
 */
export function HeadlessExample() {
  const {
    record,
    sendMessage,
    isConnected,
    currentAgent,
    on,
  } = useConferBot();

  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  // Listen for agent typing
  useEffect(() => {
    const unsubscribe = on(SocketEvents.AGENT_TYPING_STATUS, (data: any) => {
      setIsTyping(data.isTyping || false);
    });
    return unsubscribe;
  }, [on]);

  const handleSend = async () => {
    if (!inputText.trim()) return;

    await sendMessage(inputText);
    setInputText('');
  };

  return (
    <View style={styles.container}>
      {/* Custom Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {currentAgent ? `Chat with ${currentAgent.name}` : 'Support Chat'}
        </Text>
        <View style={[styles.statusDot, isConnected ? styles.online : styles.offline]} />
      </View>

      {/* Custom Message List */}
      <ScrollView style={styles.messageList}>
        {record.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No messages yet</Text>
            <Text style={styles.emptySubtext}>Start a conversation!</Text>
          </View>
        ) : (
          record.map((message, index) => {
            const isUser = message.type === 'user-message';
            return (
              <View
                key={index}
                style={[
                  styles.messageBubble,
                  isUser ? styles.userBubble : styles.botBubble,
                ]}
              >
                {'text' in message && message.text && (
                  <Text style={isUser ? styles.userText : styles.botText}>
                    {message.text}
                  </Text>
                )}
              </View>
            );
          })
        )}

        {/* Custom Typing Indicator */}
        {isTyping && (
          <View style={styles.typingContainer}>
            <Text style={styles.typingText}>Agent is typing...</Text>
          </View>
        )}
      </ScrollView>

      {/* Custom Input */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Type a message..."
          placeholderTextColor="#999"
          multiline
        />
        <TouchableOpacity
          style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!inputText.trim()}
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
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  online: {
    backgroundColor: '#4CAF50',
  },
  offline: {
    backgroundColor: '#F44336',
  },
  messageList: {
    flex: 1,
    padding: 16,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#007AFF',
  },
  botBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
  },
  userText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  botText: {
    color: '#1A1A1A',
    fontSize: 16,
  },
  typingContainer: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  typingText: {
    color: '#666',
    fontSize: 14,
    fontStyle: 'italic',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  input: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
    fontSize: 16,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: '#007AFF',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  sendButtonDisabled: {
    backgroundColor: '#CCC',
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
