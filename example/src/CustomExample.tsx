import React from 'react';
import { View, StyleSheet } from 'react-native';
import {
  useConferBot,
  MessageList,
  ChatInput,
  ChatHeader,
} from '@conferbot/react-native';

/**
 * Mix & Match Example
 *
 * This shows how to use pre-built components with your own custom pieces.
 * Use our components where convenient, build custom where needed.
 */
export function CustomExample() {
  const {
    record,
    sendMessage,
    currentAgent,
    closeChat,
  } = useConferBot();

  return (
    <View style={styles.container}>
      {/* Use pre-built ChatHeader */}
      <ChatHeader
        title="Support"
        subtitle="We typically reply in minutes"
        agent={currentAgent}
        onClose={closeChat}
        showConnectionStatus={true}
      />

      {/* Use pre-built MessageList with custom styling */}
      <View style={styles.messagesWrapper}>
        <MessageList
          messages={record}
          showTimestamps={true}
          showAvatars={true}
        />
      </View>

      {/* Use pre-built ChatInput */}
      <ChatInput
        onSend={sendMessage}
        placeholder="Ask us anything..."
        maxLength={1000}
      />

      {/* You could also add your own custom components here */}
      {/* <MyCustomQuickReplies /> */}
      {/* <MyCustomFileUploader /> */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  messagesWrapper: {
    flex: 1,
    // Add any custom styling you want
  },
});
