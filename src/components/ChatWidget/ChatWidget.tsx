import React, { useEffect } from 'react';
import { Modal, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useTheme } from '../../theme';
import { useConferBot } from '../../context/ConferBotContext';
import { ChatHeader } from '../ChatHeader';
import { MessageList } from '../MessageList';
import { ChatInput } from '../ChatInput';
import type { ConferBotTheme } from '../../theme/types';
import { SocketEvents } from '../../types';

/**
 * ChatWidget Props
 *
 * @interface ChatWidgetProps
 * @property {boolean} [visible] - Whether the widget is visible (controlled mode)
 * @property {() => void} [onClose] - Callback when widget is closed
 * @property {string} [title='Chat'] - Header title
 * @property {string} [placeholder='Type a message...'] - Input placeholder
 * @property {boolean} [enableAttachments=false] - Enable file attachments
 * @property {boolean} [showTimestamps=false] - Show message timestamps
 * @property {boolean} [closeOnBackdrop=true] - Close when backdrop is pressed
 * @property {string} [testID] - Test identifier
 *
 * @example
 * ```tsx
 * // Uncontrolled (uses internal isOpen state)
 * <ChatWidget
 *   title="Customer Support"
 *   enableAttachments={true}
 * />
 *
 * // Controlled
 * <ChatWidget
 *   visible={isVisible}
 *   onClose={() => setIsVisible(false)}
 * />
 * ```
 */
export interface ChatWidgetProps {
  visible?: boolean;
  onClose?: () => void;
  title?: string;
  placeholder?: string;
  enableAttachments?: boolean;
  showTimestamps?: boolean;
  closeOnBackdrop?: boolean;
  testID?: string;
}

/**
 * ChatWidget Component
 *
 * Complete drop-in chat widget with all features.
 *
 * Features:
 * - Full-screen modal chat interface
 * - Header with agent info and close button
 * - Scrollable message list with virtualization
 * - Input with send button
 * - Optional file attachments
 * - Typing indicators
 * - Connection status
 * - Auto-opens on first mount
 * - Keyboard-aware layout
 * - Accessibility support
 *
 * This is the easiest way to add chat to your app:
 * Just wrap your app with ConferBotProvider and add <ChatWidget />.
 *
 * @component
 */
export const ChatWidget: React.FC<ChatWidgetProps> = ({
  visible: controlledVisible,
  onClose,
  title = 'Chat',
  placeholder = 'Type a message...',
  enableAttachments = false,
  showTimestamps = false,
  closeOnBackdrop: _closeOnBackdrop = true,
  testID,
}) => {
  const theme = useTheme();
  const styles = createStyles(theme);

  const {
    isOpen,
    openChat,
    closeChat,
    sendMessage,
    record,
    currentAgent,
    isConnected,
    on,
  } = useConferBot();

  // Use controlled visible if provided, otherwise use context isOpen
  const isVisible = controlledVisible !== undefined ? controlledVisible : isOpen;

  // Track agent typing
  const [isAgentTyping, setIsAgentTyping] = React.useState(false);

  // Listen for agent typing status
  useEffect(() => {
    const unsubscribe = on(SocketEvents.AGENT_TYPING_STATUS, (data: any) => {
      setIsAgentTyping(data.isTyping || false);
    });

    return unsubscribe;
  }, [on]);

  // Auto-open chat on mount if not controlled
  useEffect(() => {
    if (controlledVisible === undefined && !isOpen) {
      openChat();
    }
  }, [controlledVisible, isOpen, openChat]);

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      closeChat();
    }
  };

  const handleSendMessage = async (text: string) => {
    await sendMessage(text);
  };

  const handleAttachmentPress = () => {
    // TODO: Implement file picker
    console.log('[ChatWidget] Attachment button pressed');
  };

  // Determine subtitle based on connection and agent
  const getSubtitle = (): string | undefined => {
    if (currentAgent) {
      return currentAgent.email || 'Live Agent';
    }
    if (!isConnected) {
      return 'Reconnecting...';
    }
    return undefined;
  };

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      transparent={false}
      onRequestClose={handleClose}
      statusBarTranslucent={false}
      accessible={true}
      accessibilityLabel="Chat modal"
      testID={testID}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        {/* Header */}
        <ChatHeader
          title={title}
          subtitle={getSubtitle()}
          agent={currentAgent}
          onClose={handleClose}
          showConnectionStatus={true}
          testID={`${testID}-header`}
        />

        {/* Message List */}
        <MessageList
          messages={record}
          showTypingIndicator={isAgentTyping}
          showTimestamps={showTimestamps}
          testID={`${testID}-messages`}
        />

        {/* Input */}
        <ChatInput
          onSend={handleSendMessage}
          placeholder={placeholder}
          disabled={!isConnected}
          enableAttachments={enableAttachments}
          onAttachmentPress={handleAttachmentPress}
          testID={`${testID}-input`}
        />
      </KeyboardAvoidingView>
    </Modal>
  );
};

const createStyles = (_theme: ConferBotTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
  });
