// @ts-nocheck
/**
 * Live chat beyond the messages, as the web widget has it: the visitor's
 * place in the queue, what happens when nobody can join (an email for the
 * reply, leave a message), read receipts both ways, a conversation locked
 * or its composer turned off by the agent, an agent's dropped connection,
 * an agent asking for a file, the AI's follow-up email card, and the
 * post-chat rating. See core/liveChat.ts for the shapes.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type ConferBotSocket from '../../services/socket';
import type { ChatState } from '../../core';
import type { RecordItem } from '../../types';
import {
  csatConfigOf,
  handoverWaitingOf,
  latestAgentMessageId,
  queueStatusOf,
  ratingPayload,
  receiptMarksOf,
  type CsatConfig,
  type HandoverWaiting,
  type QueueStatus,
  type ReceiptMarks,
} from '../../core/liveChat';
import { deduplicateMessages, trimMessages } from '../types';
import { buildHandoverTimeoutPayload, waitMinutesOf } from '../../core/handoverPayload';

export const QUEUE_POLL_MS = 20000;

interface Params {
  socketClient: React.MutableRefObject<ConferBotSocket | null>;
  chatStateRef: React.MutableRefObject<ChatState | null>;
  record: RecordItem[];
  setRecord: React.Dispatch<React.SetStateAction<RecordItem[]>>;
  isOpen: boolean;
  /** A handover to the team is waiting for a person (queue polling runs). */
  waitingForPerson: boolean;
  /** The flow carries on from the handover (a message was left, or skipped). */
  continueFlow?: () => void;
  /** The waiting handover step's data and the bot's workspace, for its max wait. */
  handoverWait?: () => { data: Record<string, any> | undefined; workspaceId: string };
}

export function useLiveChatExtras({ socketClient, chatStateRef, record, setRecord, isOpen, waitingForPerson, continueFlow, handoverWait }: Params) {
  const [queue, setQueue] = useState<QueueStatus | null>(null);
  const [waiting, setWaiting] = useState<HandoverWaiting | null>(null);
  const [noAgents, setNoAgents] = useState(false);
  const [lockedBy, setLockedBy] = useState<string | null>(null);
  const [inputEnabled, setInputEnabled] = useState(true);
  const [agentLost, setAgentLost] = useState<string | null>(null);
  const [fileRequestedBy, setFileRequestedBy] = useState<string | null>(null);
  const [receiptMarks, setReceiptMarks] = useState<ReceiptMarks>({ deliveredMessageId: '', seenMessageId: '' });
  const [leadCardOpen, setLeadCardOpen] = useState(false);
  const [csatConfig, setCsatConfig] = useState<CsatConfig | null>(null);
  const [csatOpen, setCsatOpen] = useState(false);
  // What the visitor already sent from a card (kept here, not in the card,
  // so a re-render of the list does not bring the form back).
  const [leftMessageTo, setLeftMessageTo] = useState<string | null>(null);
  const [leadEmail, setLeadEmail] = useState<string | null>(null);
  const [csatSent, setCsatSent] = useState(false);
  const reported = useRef({ delivered: '', seen: '' });

  const sid = () => socketClient.current?.chatSessionId || chatStateRef.current?.sessionId || '';
  const own = (data: any) => !data?.chatSessionId || !sid() || data.chatSessionId === sid();

  const addRecord = useCallback(
    (ui: any, server?: any) => {
      setRecord((prev) => deduplicateMessages(trimMessages([...prev, ui])));
      if (server) chatStateRef.current?.addRecord(server);
    },
    [setRecord]
  );

  const sendRecord = useCallback(() => {
    const state = chatStateRef.current;
    if (state && socketClient.current?.isConnected()) socketClient.current.sendResponseRecord(state.buildResponseData());
  }, []);

  /** fetched-chatbot-data: the bot's post-chat rating settings. */
  const setChatbotData = useCallback((chatbotData: any) => {
    setCsatConfig(csatConfigOf(chatbotData?.csatConfig));
  }, []);

  const setupLiveChatListeners = useCallback(() => {
    const socket = socketClient.current;
    if (!socket) return;

    socket.on('queue-status', (data: any) => {
      if (own(data)) setQueue(queueStatusOf(data));
    });
    socket.on('handover-waiting', (data: any) => {
      if (!own(data)) return;
      setQueue(null);
      setWaiting(handoverWaitingOf(data));
    });
    socket.on('no-agents-available', () => {
      setQueue(null);
      setNoAgents(true);
    });
    socket.on('agent-accepted', (data: any) => {
      // A person (or the AI taking it back) answered: the wait is over.
      setQueue(null);
      setNoAgents(false);
      if (data?.agentDetails && !data.agentDetails.isAIAgent) setWaiting(null);
    });
    socket.on('conversation-locked', (data: any) => {
      if (own(data)) setLockedBy(String(data?.lockedByName || '') || 'the team');
    });
    socket.on('conversation-unlocked', (data: any) => {
      if (own(data)) setLockedBy(null);
    });
    socket.on('visitor-input-toggled', (data: any) => {
      if (own(data)) setInputEnabled(data?.isInputEnabled !== false);
    });
    socket.on('agent-connection-lost', (data: any) => {
      if (own(data)) setAgentLost(String(data?.agentName || '') || 'The agent');
    });
    socket.on('agent-connection-restored', (data: any) => {
      if (own(data)) setAgentLost(null);
    });
    socket.on('file-upload-requested', (data: any) => {
      if (!own(data)) return;
      const who = String(data?.agentName || '').trim() || 'The team';
      setFileRequestedBy(who);
      chatStateRef.current?.addRecord({ id: `file-request-${Date.now()}`, shape: 'agent-file-request', type: 'agent-file-request', agentName: who, time: new Date().toISOString() } as any);
    });
    socket.on('agent-read-status', (data: any) => {
      if (own(data)) setReceiptMarks(receiptMarksOf(data));
    });
    socket.on('chat-ended', () => {
      setQueue(null);
      setLockedBy(null);
      setFileRequestedBy(null);
      setCsatOpen(true);
    });
    socket.on('agent-message', (data: any) => {
      // Buying intent and no email yet: the one-field follow-up card.
      if (data?.agentDetails?.isAIAgent && data?.leadCard === true) setLeadCardOpen(true);
    });
  }, []);

  // Where the visitor stands: asked every 20s while a handover waits for a person.
  useEffect(() => {
    if (!waitingForPerson) return;
    const ask = () => {
      const id = sid();
      if (!id) return;
      socketClient.current?.emitWithAck('queue-status', { chatSessionId: id }, 10000).then((res) => {
        if (res) setQueue(queueStatusOf(res));
      });
    };
    ask();
    const t = setInterval(ask, QUEUE_POLL_MS);
    return () => clearInterval(t);
  }, [waitingForPerson]);

  // The handover step's max wait: once it passes with nobody joined, the
  // server is asked to decide (handover-timeout) and answers with
  // no-agents-available. Once per wait.
  useEffect(() => {
    if (!waitingForPerson || !handoverWait) return;
    const { data, workspaceId } = handoverWait();
    const t = setTimeout(() => {
      const id = sid();
      if (id) socketClient.current?.emitToServer('handover-timeout', buildHandoverTimeoutPayload(id, data, workspaceId));
    }, waitMinutesOf(data?.maxWaitTime) * 60000);
    return () => clearTimeout(t);
  }, [waitingForPerson]);

  // The visitor's receipts for the agent's newest message: delivered when it
  // arrives, seen while the chat is on screen.
  useEffect(() => {
    const latest = latestAgentMessageId(record);
    const id = sid();
    if (!latest || !id || !socketClient.current?.isConnected()) return;
    if (reported.current.delivered !== latest) {
      reported.current.delivered = latest;
      socketClient.current.emitToServer('visitor-read-receipt', { chatSessionId: id, messageId: latest, state: 'delivered' });
    }
    if (isOpen && reported.current.seen !== latest) {
      reported.current.seen = latest;
      socketClient.current.emitToServer('visitor-read-receipt', { chatSessionId: id, messageId: latest, state: 'seen' });
    }
  }, [record, isOpen]);

  /** "Leave a message" when nobody is available: by email. */
  const leaveMessage = useCallback(async (email: string, message: string): Promise<boolean> => {
    const id = sid();
    const entryId = `leave-message-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const visitorId = chatStateRef.current?.getVariable?.('_visitorId');
    const res = await socketClient.current?.emitWithAck('leave-message', { chatSessionId: id, email, message, entryId, visitorId });
    if (!res?.ok) return false;
    const entry = { id: entryId, _id: entryId, shape: 'user-message', type: 'user-message', via: 'email', text: message, time: new Date().toISOString(), data: { leftMessage: true, email } };
    addRecord({ ...entry, text: message }, entry);
    chatStateRef.current?.setUserMetadata?.({ email });
    setLeftMessageTo(email);
    setNoAgents(false);
    continueFlow?.();
    return true;
  }, [addRecord, continueFlow]);

  /** "Not now" on leave a message: the flow carries on. */
  const skipLeaveMessage = useCallback(() => {
    setNoAgents(false);
    continueFlow?.();
  }, [continueFlow]);

  /** The email the team replies to when nobody could join (handover-waiting). */
  const shareEmailForReply = useCallback(async (email: string): Promise<boolean> => {
    const id = sid();
    const entryId = `handover-email-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const visitorId = chatStateRef.current?.getVariable?.('_visitorId');
    const res = await socketClient.current?.emitWithAck('handover-email', { chatSessionId: id, email, entryId, visitorId });
    if (!res?.ok) return false;
    chatStateRef.current?.addRecord({ id: entryId, shape: 'user-message', type: 'user-message', via: 'email', text: email, time: new Date().toISOString(), data: { handoverEmail: true, email } } as any);
    setWaiting((w) => (w ? { ...w, askEmail: false, email } : w));
    return true;
  }, []);

  /** The AI's follow-up card: the email kept as the visitor's, the record sent. */
  const captureLeadEmail = useCallback((email: string) => {
    const state = chatStateRef.current;
    if (!state) return;
    state.setUserMetadata({ email });
    state.setAnswer('lead-card', 'email', email);
    sendRecord();
    setLeadEmail(email);
    setLeadCardOpen(false);
  }, [sendRecord]);

  /** The visitor's file in a live chat, uploaded already: recorded as the web widget does. */
  const sendLiveFile = useCallback((url: string, file?: { name?: string; type?: string; size?: number }) => {
    const id = `user-file-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const time = new Date().toISOString();
    addRecord(
      { _id: id, type: 'user-message', shape: 'user-live-message-file', url, fileName: file?.name, fileType: file?.type, fileSize: file?.size, time },
      { id, shape: 'user-live-message-file', time, url }
    );
    sendRecord();
    setFileRequestedBy(null);
  }, [addRecord, sendRecord]);

  /** The post-chat rating. */
  const submitRating = useCallback((value: number | boolean, feedback?: string) => {
    if (!csatConfig) return;
    socketClient.current?.emitToServer('submit-chat-rating', ratingPayload(sid(), csatConfig.ratingType, value, feedback));
    setCsatSent(true);
  }, [csatConfig]);

  const dismissCsat = useCallback(() => setCsatOpen(false), []);
  const dismissFileRequest = useCallback(() => setFileRequestedBy(null), []);

  const resetLiveChatExtras = useCallback(() => {
    setQueue(null);
    setWaiting(null);
    setNoAgents(false);
    setLockedBy(null);
    setInputEnabled(true);
    setAgentLost(null);
    setFileRequestedBy(null);
    setReceiptMarks({ deliveredMessageId: '', seenMessageId: '' });
    setLeadCardOpen(false);
    setCsatOpen(false);
    setLeftMessageTo(null);
    setLeadEmail(null);
    setCsatSent(false);
    reported.current = { delivered: '', seen: '' };
  }, []);

  return {
    queue,
    waiting,
    noAgents,
    lockedBy,
    inputEnabled,
    agentLost,
    fileRequestedBy,
    receiptMarks,
    leadCardOpen,
    csatConfig,
    csatOpen,
    leftMessageTo,
    leadEmail,
    csatSent,
    setChatbotData,
    setupLiveChatListeners,
    leaveMessage,
    shareEmailForReply,
    captureLeadEmail,
    submitRating,
    sendLiveFile,
    skipLeaveMessage,
    dismissCsat,
    dismissFileRequest,
    resetLiveChatExtras,
  };
}
