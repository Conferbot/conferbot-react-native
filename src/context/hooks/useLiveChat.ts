// @ts-nocheck
import { useCallback, useState } from 'react';
import type { RecordItem, MessageAttachment } from '../../types';
import type ConferBotSocket from '../../services/socket';
import type { ChatState } from '../../core';
import { deduplicateMessages, trimMessages } from '../types';

interface UseLiveChatParams {
  chatSessionId: string | undefined;
  socketClient: React.MutableRefObject<ConferBotSocket | null>;
  chatStateRef: React.MutableRefObject<ChatState | null>;
  record: RecordItem[];
  setRecord: React.Dispatch<React.SetStateAction<RecordItem[]>>;
  persistMessages: (messages: RecordItem[]) => Promise<void>;
  readReceiptsEnabled: boolean;
}

export function useLiveChat({
  chatSessionId,
  socketClient,
  chatStateRef,
  record,
  setRecord,
  persistMessages,
  readReceiptsEnabled,
}: UseLiveChatParams) {
  const [isLiveChatMode, setIsLiveChatMode] = useState(false);
  const [agentTyping, setAgentTyping] = useState(false);

  // Send visitor typing status during live chat
  const sendVisitorTyping = useCallback((isTyping: boolean) => {
    if (!isLiveChatMode || !socketClient.current?.isConnected()) return;
    const sid = chatSessionId || socketClient.current?.chatSessionId || chatStateRef.current?.sessionId;
    if (!sid) return;
    socketClient.current.sendVisitorTyping(sid, isTyping);
  }, [isLiveChatMode, chatSessionId]);

  // Send message -- handles both bot flow and live chat modes
  const sendMessage = useCallback(
    async (text: string, _attachments?: MessageAttachment[]): Promise<void> => {
      // Resolve session ID: React state first, then socket's stored ID, then chatState
      const resolvedSessionId = chatSessionId
        || socketClient.current?.chatSessionId
        || chatStateRef.current?.sessionId;
      if (!resolvedSessionId) {
        console.warn('[ConferBot] Cannot send message: no active session');
        return;
      }

      try {
        const messageId = `user-live-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

        if (isLiveChatMode) {
          // *** LIVE CHAT MODE ***
          const userLiveRecord: RecordItem = {
            _id: messageId,
            type: 'user-message',
            shape: 'user-live-message',
            text,
            time: new Date().toISOString(),
          } as any;

          setRecord((prev) => deduplicateMessages(trimMessages([...prev, userLiveRecord])));

          if (chatStateRef.current) {
            chatStateRef.current.addRecord({
              id: messageId,
              shape: 'user-live-message',
              time: new Date().toISOString(),
              text,
            });

            if (socketClient.current?.isConnected()) {
              const responseData = chatStateRef.current.buildResponseData();
              socketClient.current.sendResponseRecord(responseData);
            }
          }

          // Stop visitor typing indicator
          if (socketClient.current?.isConnected()) {
            socketClient.current.sendVisitorTyping(resolvedSessionId, false);
          }

          if (__DEV__) {
            console.log('[ConferBot] Live chat message sent');
          }
        } else {
          // *** BOT FLOW MODE ***
          const userMessageRecord: RecordItem = {
            _id: messageId,
            type: 'user-message',
            text,
            time: new Date(),
          } as RecordItem;

          if (readReceiptsEnabled && chatStateRef.current) {
            chatStateRef.current.setMessageSending(messageId);
          }

          const updatedRecord = deduplicateMessages(trimMessages([...record, userMessageRecord]));
          setRecord(updatedRecord);
          await persistMessages(updatedRecord);

          // Push to chatState server record
          if (chatStateRef.current) {
            chatStateRef.current.addRecord({
              id: messageId,
              _id: messageId,
              shape: 'user-input-response',
              text,
              time: new Date().toISOString(),
            } as any);
          }

          if (socketClient.current?.isConnected() && chatStateRef.current) {
            const responseData = chatStateRef.current.buildResponseData();
            socketClient.current.sendResponseRecord(responseData);

            if (readReceiptsEnabled) {
              setTimeout(() => {
                chatStateRef.current?.setMessageSent(messageId);
              }, 100);
            }
          }
        }
      } catch (error) {
        console.error('[ConferBot] Failed to send message:', error);
        throw error;
      }
    },
    [chatSessionId, record, persistMessages, readReceiptsEnabled, isLiveChatMode]
  );

  return {
    isLiveChatMode,
    setIsLiveChatMode,
    agentTyping,
    setAgentTyping,
    sendVisitorTyping,
    sendMessage,
  };
}
