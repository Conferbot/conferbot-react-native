// @ts-nocheck
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
import { useTheme, ThemeProvider } from '../../theme';
import { useConferBot } from '../../context/ConferBotContext';
import { ChatHeader } from '../ChatHeader';
import { HeaderMenu } from '../ChatHeader/HeaderMenu';
import type { HeaderMenuItem } from '../ChatHeader/HeaderMenu';
import { MessageList } from '../MessageList';
import { ChatInput } from '../ChatInput';
import { ChatBottomBar } from '../ChatBottomBar/ChatBottomBar';
import { NodeRenderer } from '../NodeComponents';
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
import type { SocketEvents, RecordItem } from '../../types';

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
    botName,
    botAvatarUrl,
    serverCustomizations,
    // Use the context's flow engine state
    currentUIState,
    isNodeProcessing,
    submitNodeResponse,
    chatState: contextChatState,
    serverThemeOverride,
    // Live chat state
    isLiveChatMode,
    agentTyping,
    sendVisitorTyping,
    // Actions
    resetConversation,
  } = useConferBot();

  // Use controlled visible if provided, otherwise use context isOpen
  const isVisible = controlledVisible !== undefined ? controlledVisible : isOpen;

  // Agent typing indicator — from context (live chat) or local state
  const isAgentTyping = agentTyping;

  // Track flow completion locally
  const [isFlowComplete, setIsFlowComplete] = useState(false);

  // Attachment state
  const [selectedAttachment, setSelectedAttachment] = useState<SelectedAttachment | null>(null);
  const [showAttachmentPreview, setShowAttachmentPreview] = useState(false);

  // Reference to context chat state for local operations
  const chatState = useRef<ChatState | null>(contextChatState);
  chatState.current = contextChatState;

  // Check if voice recording is available
  const voiceRecordingAvailable = enableVoiceMessage && isAudioRecorderAvailable();

  /**
   * Handle user response submission from NodeRenderer — delegates to context
   */
  const handleNodeResponse = useCallback(
    async (response: any, portName?: string) => {
      if (debug) {
        console.log('[ChatWidget] Node response submitted:', { response, portName });
      }
      submitNodeResponse(response, portName);
    },
    [debug, submitNodeResponse]
  );

  // Listen for agent typing status
  useEffect(() => {
    const unsubscribe = on('agent-typing-status' as SocketEvents, (data: any) => {
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

  // ---- Header Menu Actions ---- //
  const handleRestartChat = useCallback(() => {
    Alert.alert(
      'Restart Chat',
      'This will clear the current conversation and start fresh. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restart',
          style: 'destructive',
          onPress: () => resetConversation(),
        },
      ]
    );
  }, [resetConversation]);

  const handleDownloadTranscript = useCallback(() => {
    if (!record || record.length === 0) {
      Alert.alert('No Messages', 'There are no messages to share.');
      return;
    }

    const lines: string[] = [];
    for (const msg of record) {
      const time = msg.time ? new Date(msg.time).toLocaleTimeString() : '';
      if (msg.type === 'user-message' || msg.type === 'user-live-message') {
        lines.push(`[${time}] You: ${msg.text || ''}`);
      } else if (
        msg.type === 'bot-message' ||
        msg.type === 'agent-message'
      ) {
        const sender =
          msg.type === 'agent-message'
            ? msg.agentDetails?.name || 'Agent'
            : botName || 'Bot';
        lines.push(`[${time}] ${sender}: ${msg.text || ''}`);
      } else if (msg.type === 'agent-joined-message' || msg.type === 'agent-left-chat') {
        lines.push(`[${time}] --- ${msg.text || ''} ---`);
      }
    }

    const transcript = lines.join('\n');

    Share.share({
      message: transcript,
      title: `Chat Transcript — ${botName || 'Conferbot'}`,
    }).catch(() => {});
  }, [record, botName]);

  const headerMenuItems: HeaderMenuItem[] = [
    {
      id: 'restart',
      label: 'Restart Chat',
      icon: '↻',
      onPress: handleRestartChat,
      destructive: true,
    },
    {
      id: 'transcript',
      label: 'Share Transcript',
      icon: '↗',
      onPress: handleDownloadTranscript,
    },
  ];

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
    // During live chat, sendMessage handles everything (record + socket)
    // Don't add to chatState transcript to avoid duplicate user messages
    if (!isLiveChatMode && chatState.current) {
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
  // Always show the input bar — matches Flutter/Android SDK behavior
  const shouldShowInput = (): boolean => true;

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
      <ThemeProvider theme={serverThemeOverride || undefined}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        {/* Header */}
        <ChatHeader
          title={botName || title}
          tagline={serverCustomizations?.enableTagline ? serverCustomizations?.tagline : undefined}
          subtitle={getSubtitle()}
          agent={currentAgent}
          botAvatarUrl={botAvatarUrl || undefined}
          onClose={handleClose}
          showConnectionStatus={true}
          rightActions={<HeaderMenu items={headerMenuItems} testID={`${testID}-header-menu`} />}
          testID={`${testID}-header`}
        />

        {/* Message List — interactive node renders inline at the end */}
        <MessageList
          messages={record}
          showTypingIndicator={isAgentTyping || isNodeProcessing}
          showTimestamps={showTimestamps}
          testID={`${testID}-messages`}
          activeNodeUI={shouldShowNodeRenderer() && currentUIState ? currentUIState : null}
          onNodeSubmit={handleNodeResponse}
          isNodeLoading={isNodeProcessing}
        />

        {/* Unified input + footer — one seamless bottom bar */}
        {shouldShowInput() && (
          <ChatBottomBar
            onSend={handleSendMessage}
            onTyping={sendVisitorTyping}
            placeholder={placeholder}
            disabled={!isConnected}
            testID={`${testID}-input`}
          />
        )}

        {/* Attachment Preview Modal */}
        {renderAttachmentPreview()}
      </KeyboardAvoidingView>
      </ThemeProvider>
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
