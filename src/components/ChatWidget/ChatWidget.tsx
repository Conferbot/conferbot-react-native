import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Modal, StyleSheet, KeyboardAvoidingView, Platform, View } from 'react-native';
import { useTheme } from '../../theme';
import { useConferBot } from '../../context/ConferBotContext';
import { ChatHeader } from '../ChatHeader';
import { MessageList } from '../MessageList';
import { ChatInput } from '../ChatInput';
import { NodeRenderer } from '../NodeComponents';
import { NodeFlowEngine, ChatState } from '../../core';
import { NodeUIState } from '../../core/nodes/NodeHandler';
import type { ConferBotTheme } from '../../theme/types';
import type { SocketEvents, BotResponsePayload, RecordItem } from '../../types';

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
 * @property {boolean} [debug=false] - Enable debug logging for flow engine
 * @property {number} [typingDelay=500] - Typing delay in ms before showing bot messages
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
  debug?: boolean;
  typingDelay?: number;
}

/**
 * ChatWidget Component
 *
 * Complete drop-in chat widget with all features including node flow engine support.
 *
 * Features:
 * - Full-screen modal chat interface
 * - Header with agent info and close button
 * - Scrollable message list with virtualization
 * - Interactive node rendering at the bottom
 * - Input with send button
 * - Optional file attachments
 * - Typing indicators
 * - Connection status
 * - Auto-opens on first mount
 * - Keyboard-aware layout
 * - Accessibility support
 * - Node flow engine integration for interactive chatbot flows
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
  debug = false,
  typingDelay = 500,
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
    chatSessionId,
    chatbotConfig,
    on,
  } = useConferBot();

  // Use controlled visible if provided, otherwise use context isOpen
  const isVisible = controlledVisible !== undefined ? controlledVisible : isOpen;

  // Track agent typing
  const [isAgentTyping, setIsAgentTyping] = useState(false);

  // Node flow engine state
  const [currentUIState, setCurrentUIState] = useState<NodeUIState | null>(null);
  const [isNodeLoading, setIsNodeLoading] = useState(false);
  const [isFlowComplete, setIsFlowComplete] = useState(false);

  // Flow engine and chat state refs
  const flowEngine = useRef<NodeFlowEngine | null>(null);
  const chatState = useRef<ChatState | null>(null);

  // Track if engine has been initialized for this session
  const engineInitialized = useRef(false);

  /**
   * Initialize the flow engine when chat opens
   */
  const initializeFlowEngine = useCallback(() => {
    if (!chatSessionId || !chatbotConfig?.id) {
      if (debug) {
        console.log('[ChatWidget] Cannot initialize flow engine - missing session or bot ID');
      }
      return;
    }

    // Create new chat state
    chatState.current = new ChatState(chatSessionId, chatbotConfig.id);

    // Restore existing record to chat state
    if (record && record.length > 0) {
      for (const entry of record) {
        chatState.current.addRecord(entry as any);
      }
    }

    // Create flow engine with callbacks
    flowEngine.current = new NodeFlowEngine(chatState.current, undefined, {
      typingDelay,
      debug,
      onUIStateChange: (uiState) => {
        if (debug) {
          console.log('[ChatWidget] UI state changed:', uiState?.type);
        }
        setCurrentUIState(uiState);
        setIsNodeLoading(uiState?.type === 'loading');
      },
      onWaitingForInput: (nodeId, uiState) => {
        if (debug) {
          console.log('[ChatWidget] Waiting for input on node:', nodeId);
        }
        setCurrentUIState(uiState);
        setIsNodeLoading(false);
      },
      onFlowComplete: (reason) => {
        if (debug) {
          console.log('[ChatWidget] Flow complete:', reason);
        }
        setCurrentUIState(null);
        setIsFlowComplete(true);
        setIsNodeLoading(false);
      },
      onError: (error, nodeId) => {
        console.error('[ChatWidget] Flow engine error:', error.message, { nodeId });
        setIsNodeLoading(false);
      },
    });

    engineInitialized.current = true;

    if (debug) {
      console.log('[ChatWidget] Flow engine initialized');
    }
  }, [chatSessionId, chatbotConfig?.id, record, typingDelay, debug]);

  /**
   * Handle bot response events from the socket
   */
  const handleBotResponse = useCallback(
    (payload: BotResponsePayload) => {
      if (debug) {
        console.log('[ChatWidget] Received bot-response:', payload);
      }

      // Ensure flow engine is initialized
      if (!flowEngine.current || !chatState.current) {
        if (debug) {
          console.log('[ChatWidget] Flow engine not initialized, attempting initialization');
        }
        initializeFlowEngine();
      }

      // If we still don't have an engine, skip processing
      if (!flowEngine.current || !chatState.current) {
        if (debug) {
          console.log('[ChatWidget] Flow engine still not available, skipping');
        }
        return;
      }

      // Process the bot response
      // The payload typically contains flow data and node information
      if (payload.record && payload.record.length > 0) {
        const latestRecord = payload.record[payload.record.length - 1] as any;

        // Add record entries to chat state
        for (const entry of payload.record) {
          chatState.current.addRecord(entry as any);
        }

        // Check if this is a flow-based response with node data
        if (latestRecord.nodeData || latestRecord.flowData) {
          const flowData = latestRecord.flowData || { nodes: [], edges: [] };
          const currentNodeId = latestRecord.nodeData?.currentNodeId || latestRecord.currentNodeId;

          // Load flow if available
          if (flowData.nodes && flowData.nodes.length > 0) {
            flowEngine.current.loadFlow({
              nodes: flowData.nodes,
              edges: flowData.edges || [],
              startNodeId: currentNodeId,
            });
          }

          // Process the current node
          if (currentNodeId) {
            setIsNodeLoading(true);
            flowEngine.current.resumeFrom(currentNodeId).catch((error) => {
              console.error('[ChatWidget] Error resuming flow:', error);
              setIsNodeLoading(false);
            });
          }
        }
      }

      // Update answer variables if provided
      if (payload.answerVariables && chatState.current) {
        for (const av of payload.answerVariables) {
          if (av.variableName && av.value !== undefined) {
            chatState.current.setAnswer(
              av.questionId || av.variableName,
              av.variableName,
              av.value
            );
          }
        }
      }
    },
    [debug, initializeFlowEngine]
  );

  /**
   * Handle user response submission from NodeRenderer
   */
  const handleNodeResponse = useCallback(
    async (response: any, portName?: string) => {
      if (debug) {
        console.log('[ChatWidget] Node response submitted:', { response, portName });
      }

      if (!flowEngine.current) {
        console.warn('[ChatWidget] Flow engine not available for response');
        return;
      }

      setIsNodeLoading(true);

      try {
        await flowEngine.current.submitResponse(response, portName);
      } catch (error) {
        console.error('[ChatWidget] Error submitting response:', error);
        setIsNodeLoading(false);
      }
    },
    [debug]
  );

  // Listen for agent typing status
  useEffect(() => {
    const unsubscribe = on('agent-typing-status' as SocketEvents, (data: any) => {
      setIsAgentTyping(data.isTyping || false);
    });

    return unsubscribe;
  }, [on]);

  // Listen for bot-response events to trigger flow engine
  useEffect(() => {
    const unsubscribe = on('bot-response' as SocketEvents, handleBotResponse);

    return unsubscribe;
  }, [on, handleBotResponse]);

  // Initialize flow engine when chat opens
  useEffect(() => {
    if (isVisible && !engineInitialized.current) {
      initializeFlowEngine();
    }
  }, [isVisible, initializeFlowEngine]);

  // Reset engine state when chat closes
  useEffect(() => {
    if (!isVisible && engineInitialized.current) {
      // Reset state but keep engine for potential reconnection
      setCurrentUIState(null);
      setIsNodeLoading(false);
      setIsFlowComplete(false);
    }
  }, [isVisible]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      flowEngine.current = null;
      chatState.current = null;
      engineInitialized.current = false;
    };
  }, []);

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
    // Add user message to chat state if available
    if (chatState.current) {
      chatState.current.addUserMessage(text);
    }

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

  /**
   * Determine if the chat input should be shown
   * Input is hidden when:
   * - An interactive node is active and waiting for input
   * - The node is loading
   */
  const shouldShowInput = (): boolean => {
    // Always show input if no node UI is active
    if (!currentUIState) {
      return true;
    }

    // Show input if flow is complete
    if (isFlowComplete) {
      return true;
    }

    // Hide input during loading
    if (isNodeLoading || currentUIState.type === 'loading') {
      return false;
    }

    // Non-interactive node types that allow free text input
    const nonInteractiveTypes = ['message', 'image', 'video', 'audio', 'file', 'html', 'gptResponse'];

    // Hide input for interactive node types
    return nonInteractiveTypes.includes(currentUIState.type);
  };

  /**
   * Determine if the node renderer should be shown
   */
  const shouldShowNodeRenderer = (): boolean => {
    // Don't show if no UI state
    if (!currentUIState) {
      return false;
    }

    // Always show loading state
    if (currentUIState.type === 'loading') {
      return true;
    }

    // Non-interactive display types are shown inline in messages, not as input UI
    const displayOnlyTypes = ['message', 'image', 'video', 'audio', 'file', 'html', 'gptResponse'];

    // Show node renderer for interactive types
    return !displayOnlyTypes.includes(currentUIState.type);
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
          showTypingIndicator={isAgentTyping || isNodeLoading}
          showTimestamps={showTimestamps}
          testID={`${testID}-messages`}
        />

        {/* Node Renderer for interactive nodes */}
        {shouldShowNodeRenderer() && currentUIState && (
          <View style={styles.nodeRendererContainer}>
            <NodeRenderer
              uiState={currentUIState}
              onSubmit={handleNodeResponse}
              isLoading={isNodeLoading}
              isBot={true}
            />
          </View>
        )}

        {/* Input - shown when no interactive node is active */}
        {shouldShowInput() && (
          <ChatInput
            onSend={handleSendMessage}
            placeholder={placeholder}
            disabled={!isConnected}
            enableAttachments={enableAttachments}
            onAttachmentPress={handleAttachmentPress}
            testID={`${testID}-input`}
          />
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
};

const createStyles = (theme: ConferBotTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    nodeRendererContainer: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
    },
  });
