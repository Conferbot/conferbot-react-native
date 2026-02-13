import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Modal,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  View,
  Alert,
  Image,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../../theme';
import { useConferBot } from '../../context/ConferBotContext';
import { ChatHeader } from '../ChatHeader';
import { MessageList } from '../MessageList';
import { ChatInput } from '../ChatInput';
import { NodeRenderer } from '../NodeComponents';
import { NodeFlowEngine, ChatState } from '../../core';
import { NodeUIState } from '../../core/nodes/NodeHandler';
import {
  FilePicker,
  FilePickerResult,
  FilePickerError,
  formatFileSize,
  isFilePickerAvailable,
  isImagePickerAvailable,
} from '../../utils/FilePicker';
import { isAudioRecorderAvailable } from '../../utils/AudioRecorder';
import type { VoiceRecordingResult } from '../VoiceRecorder';
import type { ConferBotTheme } from '../../theme/types';
import type { SocketEvents, BotResponsePayload, RecordItem } from '../../types';

// Maximum file size for attachments (5MB)
const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024;

/**
 * Selected file for attachment preview
 */
interface SelectedAttachment {
  file: FilePickerResult;
  isUploading: boolean;
  uploadProgress: number;
  uploadedUrl?: string;
  error?: string;
}

/**
 * ChatWidget Props
 *
 * @interface ChatWidgetProps
 * @property {boolean} [visible] - Whether the widget is visible (controlled mode)
 * @property {() => void} [onClose] - Callback when widget is closed
 * @property {string} [title='Chat'] - Header title
 * @property {string} [placeholder='Type a message...'] - Input placeholder
 * @property {boolean} [enableAttachments=false] - Enable file attachments
 * @property {boolean} [enableVoiceMessage=false] - Enable voice message recording
 * @property {boolean} [showTimestamps=false] - Show message timestamps
 * @property {boolean} [closeOnBackdrop=true] - Close when backdrop is pressed
 * @property {string} [testID] - Test identifier
 * @property {boolean} [debug=false] - Enable debug logging for flow engine
 * @property {number} [typingDelay=500] - Typing delay in ms before showing bot messages
 * @property {number} [voiceMaxDuration=300000] - Maximum voice recording duration (ms)
 * @property {number} [voiceMinDuration=1000] - Minimum voice recording duration (ms)
 *
 * @example
 * ```tsx
 * // Uncontrolled (uses internal isOpen state)
 * <ChatWidget
 *   title="Customer Support"
 *   enableAttachments={true}
 *   enableVoiceMessage={true}
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
  enableVoiceMessage?: boolean;
  showTimestamps?: boolean;
  closeOnBackdrop?: boolean;
  testID?: string;
  debug?: boolean;
  typingDelay?: number;
  voiceMaxDuration?: number;
  voiceMinDuration?: number;
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
 * - File attachments with camera, gallery, and document picker
 * - Voice message recording
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

// ========================================
// ERROR BOUNDARY
// ========================================

interface ConferBotErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ConferBotErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ConferBotErrorBoundary extends React.Component<
  ConferBotErrorBoundaryProps,
  ConferBotErrorBoundaryState
> {
  state: ConferBotErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ConferBot] Widget error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || null;
    }
    return this.props.children;
  }
}

const ChatWidgetInner: React.FC<ChatWidgetProps> = ({
  visible: controlledVisible,
  onClose,
  title = 'Chat',
  placeholder = 'Type a message...',
  enableAttachments = false,
  enableVoiceMessage = false,
  showTimestamps = false,
  closeOnBackdrop: _closeOnBackdrop = true,
  testID,
  debug = false,
  typingDelay = 500,
  voiceMaxDuration = 300000, // 5 minutes
  voiceMinDuration = 1000, // 1 second
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

  // Attachment state
  const [selectedAttachment, setSelectedAttachment] = useState<SelectedAttachment | null>(null);
  const [showAttachmentPreview, setShowAttachmentPreview] = useState(false);

  // Flow engine and chat state refs
  const flowEngine = useRef<NodeFlowEngine | null>(null);
  const chatState = useRef<ChatState | null>(null);

  // Track if engine has been initialized for this session
  const engineInitialized = useRef(false);

  // Check if voice recording is available
  const voiceRecordingAvailable = enableVoiceMessage && isAudioRecorderAvailable();

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
    // Clear any selected attachment
    setSelectedAttachment(null);
    setShowAttachmentPreview(false);

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

  /**
   * Upload file to server
   */
  const uploadFileToServer = useCallback(async (file: { uri: string; type: string; name: string }): Promise<string> => {
    if (!chatbotConfig?.id) {
      throw new Error('Bot ID is required for file upload');
    }

    const formData = new FormData();
    formData.append('file', {
      uri: file.uri,
      type: file.type,
      name: file.name,
    } as any);

    const response = await fetch(
      `https://embed.conferbot.com/api/v1/bot/${chatbotConfig.id}/media`,
      {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Upload failed with status ${response.status}`);
    }

    const data = await response.json();
    return data.url;
  }, [chatbotConfig?.id]);

  /**
   * Handle voice message send
   */
  const handleVoiceSend = useCallback(async (recording: VoiceRecordingResult) => {
    if (debug) {
      console.log('[ChatWidget] Sending voice message:', recording);
    }

    try {
      // Upload the audio file to server
      const uploadedUrl = await uploadFileToServer({
        uri: recording.uri,
        type: recording.mimeType,
        name: `voice_${Date.now()}.m4a`,
      });


      // Add voice message to chat state
      if (chatState.current) {
        chatState.current.addRecord({
          id: `voice_${Date.now()}`,
          type: 'user-message',
          shape: 'user-voice-message',
          url: uploadedUrl,
          duration: recording.duration,
          waveform: recording.waveform,
          mimeType: recording.mimeType,
          time: new Date(),
        } as any);
      }

      // Send as a message with the audio URL
      await sendMessage(`[Voice Message: ${Math.ceil(recording.duration / 1000)}s] ${uploadedUrl}`);

      if (debug) {
        console.log('[ChatWidget] Voice message sent successfully:', uploadedUrl);
      }
    } catch (error: any) {
      console.error('[ChatWidget] Failed to send voice message:', error);
      Alert.alert('Send Failed', error.message || 'Failed to send voice message. Please try again.');
      throw error;
    }
  }, [debug, uploadFileToServer, sendMessage]);

  /**
   * Handle file selection from picker
   */
  const handleFileSelected = useCallback(async (file: FilePickerResult) => {
    // Validate file size
    if (file.size > MAX_ATTACHMENT_SIZE) {
      Alert.alert(
        'File Too Large',
        `Maximum file size is ${formatFileSize(MAX_ATTACHMENT_SIZE)}. Your file is ${formatFileSize(file.size)}.`,
        [{ text: 'OK' }]
      );
      return;
    }

    // Set selected attachment and show preview
    setSelectedAttachment({
      file,
      isUploading: false,
      uploadProgress: 0,
    });

    setShowAttachmentPreview(true);
  }, []);

  /**
   * Handle attachment picker press
   */
  const handleAttachmentPress = useCallback(async () => {
    if (debug) {
      console.log('[ChatWidget] Attachment button pressed');
    }

    // Check if any picker is available
    const hasFilePicker = isFilePickerAvailable();
    const hasImagePicker = isImagePickerAvailable();

    if (!hasFilePicker && !hasImagePicker) {
      Alert.alert(
        'File Picker Not Available',
        'Please install one of the following packages to enable file attachments:\n\n' +
        '- react-native-document-picker\n' +
        '- expo-document-picker\n' +
        '- react-native-image-picker\n' +
        '- expo-image-picker',
        [{ text: 'OK' }]
      );
      return;
    }

    // Build action sheet options
    const buttons: Array<{ text: string; onPress: () => void; style?: 'cancel' | 'destructive' }> = [];

    if (hasImagePicker) {
      buttons.push({
        text: 'Take Photo',
        onPress: async () => {
          try {
            const result = await FilePicker.takePhoto({
              maxSize: MAX_ATTACHMENT_SIZE,
              quality: 0.8,
            });

            if (result) {
              handleFileSelected(result);
            }
          } catch (error) {
            if (error instanceof FilePickerError && error.code !== 'NOT_AVAILABLE') {
              Alert.alert('Error', error.message);
            }
          }
        },
      });


      buttons.push({
        text: 'Choose from Gallery',
        onPress: async () => {
          try {
            const results = await FilePicker.pickImages({
              multiple: false,
              maxSize: MAX_ATTACHMENT_SIZE,
              quality: 0.8,
            });

            if (results.length > 0) {
              handleFileSelected(results[0]);
            }
          } catch (error) {
            if (error instanceof FilePickerError && error.code !== 'NOT_AVAILABLE') {
              Alert.alert('Error', error.message);
            }
          }
        },
      });

    }

    if (hasFilePicker) {
      buttons.push({
        text: 'Choose Document',
        onPress: async () => {
          try {
            const results = await FilePicker.pickDocuments({
              multiple: false,
              maxSize: MAX_ATTACHMENT_SIZE,
            });

            if (results.length > 0) {
              handleFileSelected(results[0]);
            }
          } catch (error) {
            if (error instanceof FilePickerError && error.code !== 'NOT_AVAILABLE') {
              Alert.alert('Error', error.message);
            }
          }
        },
      });

    }

    buttons.push({
      text: 'Cancel',
      style: 'cancel',
      onPress: () => {},
    });


    Alert.alert('Attach File', 'Choose how you want to add a file', buttons);
  }, [debug, handleFileSelected]);

  /**
   * Cancel attachment
   */
  const handleCancelAttachment = useCallback(() => {
    setSelectedAttachment(null);
    setShowAttachmentPreview(false);
  }, []);

  /**
   * Send attachment
   */
  const handleSendAttachment = useCallback(async () => {
    if (!selectedAttachment) return;

    const { file } = selectedAttachment;

    // Start upload
    setSelectedAttachment(prev => prev ? { ...prev, isUploading: true, uploadProgress: 0 } : null);

    // Simulate progress
    const progressInterval = setInterval(() => {
      setSelectedAttachment(prev => {
        if (!prev || prev.uploadProgress >= 90) {
          clearInterval(progressInterval);
          return prev;
        }
        return { ...prev, uploadProgress: prev.uploadProgress + 10 };
      });

    }, 200);

    try {
      // Upload the file
      const uploadedUrl = await uploadFileToServer(file);

      clearInterval(progressInterval);
      setSelectedAttachment(prev => prev ? { ...prev, uploadProgress: 100, uploadedUrl } : null);

      // Add the file message to the record
      if (chatState.current) {
        chatState.current.addRecord({
          id: `file_${Date.now()}`,
          type: 'user-message',
          shape: 'user-file-upload',
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          url: uploadedUrl,
          time: new Date(),
        } as any);
      }

      // Send as a message with the file URL
      await sendMessage(`[File: ${file.name}] ${uploadedUrl}`);

      // Clear the attachment
      setSelectedAttachment(null);
      setShowAttachmentPreview(false);

      if (debug) {
        console.log('[ChatWidget] Attachment sent successfully:', uploadedUrl);
      }
    } catch (error: any) {
      clearInterval(progressInterval);
      console.error('[ChatWidget] Failed to upload attachment:', error);

      setSelectedAttachment(prev => prev ? {
        ...prev,
        isUploading: false,
        error: error.message || 'Failed to upload file',
      } : null);

      Alert.alert('Upload Failed', error.message || 'Failed to upload file. Please try again.');
    }
  }, [selectedAttachment, uploadFileToServer, sendMessage, debug]);

  /**
   * Check if file is an image
   */
  const isImageFile = (file: FilePickerResult): boolean => {
    return file.type.startsWith('image/') ||
      ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'].includes(file.extension.toLowerCase());
  };

  /**
   * Get file icon
   */
  const getFileIcon = (file: FilePickerResult): string => {
    if (isImageFile(file)) return '\uD83D\uDDBC'; // Picture frame
    if (file.type.startsWith('video/')) return '\uD83C\uDFA5'; // Movie camera
    if (file.type.startsWith('audio/')) return '\uD83C\uDFB5'; // Musical note
    if (file.type === 'application/pdf') return '\uD83D\uDCC4'; // Page
    if (file.type.includes('word') || file.type.includes('document')) return '\uD83D\uDCDD'; // Memo
    if (file.type.includes('excel') || file.type.includes('spreadsheet')) return '\uD83D\uDCCA'; // Chart
    return '\uD83D\uDCC1'; // Folder
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

  /**
   * Render attachment preview modal
   */
  const renderAttachmentPreview = () => {
    if (!selectedAttachment) return null;

    const { file, isUploading, uploadProgress, error } = selectedAttachment;

    return (
      <Modal
        visible={showAttachmentPreview}
        transparent
        animationType="fade"
        onRequestClose={handleCancelAttachment}
      >
        <View style={styles.attachmentOverlay}>
          <View style={[styles.attachmentPreviewContainer, { backgroundColor: theme.colors.surface }]}>
            {/* Header */}
            <View style={styles.attachmentPreviewHeader}>
              <Text style={[styles.attachmentPreviewTitle, { color: theme.colors.text }]}>
                Attachment Preview
              </Text>
              <TouchableOpacity
                onPress={handleCancelAttachment}
                disabled={isUploading}
                style={styles.attachmentCloseButton}
              >
                <Text style={[styles.attachmentCloseIcon, { color: theme.colors.textSecondary }]}>
                  {'\u2715'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Preview */}
            <View style={styles.attachmentPreviewContent}>
              {isImageFile(file) ? (
                <Image
                  source={{ uri: file.uri }}
                  style={styles.attachmentImagePreview}
                  resizeMode="contain"
                />
              ) : (
                <View style={[styles.attachmentFilePreview, { backgroundColor: theme.colors.background }]}>
                  <Text style={styles.attachmentFileIcon}>{getFileIcon(file)}</Text>
                  <Text style={[styles.attachmentFileName, { color: theme.colors.text }]} numberOfLines={2}>
                    {file.name}
                  </Text>
                  <Text style={[styles.attachmentFileSize, { color: theme.colors.textSecondary }]}>
                    {formatFileSize(file.size)}
                  </Text>
                </View>
              )}
            </View>

            {/* Progress bar */}
            {isUploading && (
              <View style={styles.attachmentProgressContainer}>
                <View style={[styles.attachmentProgressBar, { backgroundColor: theme.colors.border }]}>
                  <View
                    style={[
                      styles.attachmentProgressFill,
                      {
                        backgroundColor: theme.colors.primary,
                        width: `${uploadProgress}%`,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.attachmentProgressText, { color: theme.colors.textSecondary }]}>
                  Uploading... {uploadProgress}%
                </Text>
              </View>
            )}

            {/* Error message */}
            {error && (
              <Text style={[styles.attachmentErrorText, { color: theme.colors.error }]}>
                {error}
              </Text>
            )}

            {/* Actions */}
            <View style={styles.attachmentActions}>
              <TouchableOpacity
                style={[
                  styles.attachmentCancelButton,
                  { borderColor: theme.colors.border },
                ]}
                onPress={handleCancelAttachment}
                disabled={isUploading}
              >
                <Text style={[styles.attachmentCancelText, { color: theme.colors.text }]}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.attachmentSendButton,
                  {
                    backgroundColor: isUploading ? theme.colors.border : theme.colors.primary,
                  },
                ]}
                onPress={handleSendAttachment}
                disabled={isUploading}
              >
                {isUploading ? (
                  <ActivityIndicator size="small" color={theme.colors.textInverse} />
                ) : (
                  <Text style={[styles.attachmentSendText, { color: theme.colors.textInverse }]}>
                    Send
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
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
            enableVoiceMessage={voiceRecordingAvailable}
            onVoiceSend={handleVoiceSend}
            voiceMaxDuration={voiceMaxDuration}
            voiceMinDuration={voiceMinDuration}
            testID={`${testID}-input`}
          />
        )}

        {/* Attachment Preview Modal */}
        {renderAttachmentPreview()}
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
    // Attachment preview styles
    attachmentOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: theme.spacing.lg,
    },
    attachmentPreviewContainer: {
      width: '100%',
      maxWidth: 400,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.md,
      ...theme.shadows.md,
    },
    attachmentPreviewHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing.md,
    },
    attachmentPreviewTitle: {
      fontSize: theme.typography.fontSize.lg,
      fontWeight: theme.typography.fontWeight.semibold,
    },
    attachmentCloseButton: {
      padding: theme.spacing.xs,
    },
    attachmentCloseIcon: {
      fontSize: 20,
      fontWeight: 'bold',
    },
    attachmentPreviewContent: {
      alignItems: 'center',
      marginBottom: theme.spacing.md,
    },
    attachmentImagePreview: {
      width: '100%',
      height: 200,
      borderRadius: theme.borderRadius.md,
    },
    attachmentFilePreview: {
      width: '100%',
      padding: theme.spacing.lg,
      borderRadius: theme.borderRadius.md,
      alignItems: 'center',
    },
    attachmentFileIcon: {
      fontSize: 48,
      marginBottom: theme.spacing.sm,
    },
    attachmentFileName: {
      fontSize: theme.typography.fontSize.md,
      fontWeight: theme.typography.fontWeight.medium,
      textAlign: 'center',
    },
    attachmentFileSize: {
      fontSize: theme.typography.fontSize.sm,
      marginTop: theme.spacing.xs,
    },
    attachmentProgressContainer: {
      marginBottom: theme.spacing.md,
    },
    attachmentProgressBar: {
      height: 4,
      borderRadius: 2,
      overflow: 'hidden',
    },
    attachmentProgressFill: {
      height: '100%',
      borderRadius: 2,
    },
    attachmentProgressText: {
      fontSize: theme.typography.fontSize.sm,
      textAlign: 'center',
      marginTop: theme.spacing.xs,
    },
    attachmentErrorText: {
      fontSize: theme.typography.fontSize.sm,
      textAlign: 'center',
      marginBottom: theme.spacing.md,
    },
    attachmentActions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: theme.spacing.md,
    },
    attachmentCancelButton: {
      flex: 1,
      height: 48,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    attachmentCancelText: {
      fontSize: theme.typography.fontSize.md,
      fontWeight: theme.typography.fontWeight.medium,
    },
    attachmentSendButton: {
      flex: 1,
      height: 48,
      borderRadius: theme.borderRadius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    attachmentSendText: {
      fontSize: theme.typography.fontSize.md,
      fontWeight: theme.typography.fontWeight.semibold,
    },
  });

/**
 * ChatWidget wrapped with error boundary protection
 */
export const ChatWidget: React.FC<ChatWidgetProps & { errorFallback?: React.ReactNode }> = ({
  errorFallback,
  ...props
}) => {
  return (
    <ConferBotErrorBoundary fallback={errorFallback}>
      <ChatWidgetInner {...props} />
    </ConferBotErrorBoundary>
  );
};
