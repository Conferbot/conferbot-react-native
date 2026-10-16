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
import { blockedText, endedSinceLastLive } from '../../core/liveEvents';
import type { TranscriptEmailResult } from '../../core/emailTranscript';
import { buildHandoverTimeoutPayload } from '../../core/handoverPayload';
import { waitDeadline } from '../../core/liveChat';
import type { RedirectStore } from '../../core/postChatRedirect';

export const QUEUE_POLL_MS = 20000;

/** As the web (index.ts): the post-chat rating shows 1.5 s after the flow's end. */
export const FLOW_END_RATING_MS = 1500;

/** A conversation already asked for its post-chat rating ("1"), kept across restarts. */
export const RATING_OFFERED_KEY_PREFIX = 'conferbot_rating_offered_';

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
  /** "Email me this chat": the server's transcript email (services/api.ts). */
  postTranscriptEmail?: (chatSessionId: string, email: string) => Promise<TranscriptEmailResult>;
  /** Every queue-status as the server sent it, the event or the poll's answer (its `help`: useWaitingExtras). */
  onQueueStatus?: (data: any) => void;
  /** Where a conversation's rating, once asked, is remembered (the SDK's storage; none: in memory only). */
  store?: RedirectStore | null;
}

export function useLiveChatExtras({ socketClient, chatStateRef, record, setRecord, isOpen, waitingForPerson, continueFlow, handoverWait, postTranscriptEmail, onQueueStatus, store }: Params) {
  const onQueueStatusRef = useRef(onQueueStatus);
  onQueueStatusRef.current = onQueueStatus;
  const [queue, setQueue] = useState<QueueStatus | null>(null);
  const [waiting, setWaiting] = useState<HandoverWaiting | null>(null);
  const [noAgents, setNoAgents] = useState(false);
  const [lockedBy, setLockedBy] = useState<string | null>(null);
  const [inputEnabled, setInputEnabled] = useState(true);
  const [agentLost, setAgentLost] = useState<string | null>(null);
  const [fileRequestedBy, setFileRequestedBy] = useState<string | null>(null);
  // When the handover's max wait runs out (the wait card's countdown), while
  // a flow's handover waits for a person.
  const [waitEndsAt, setWaitEndsAt] = useState<number | null>(null);
  // A wait picked back up after a restart: the server's seconds left.
  const restoredRemaining = useRef<number | null>(null);
  const [receiptMarks, setReceiptMarks] = useState<ReceiptMarks>({ deliveredMessageId: '', seenMessageId: '' });
  const [leadCardOpen, setLeadCardOpen] = useState(false);
  const [csatConfig, setCsatConfig] = useState<CsatConfig | null>(null);
  const [csatOpen, setCsatOpen] = useState(false);
  // What the visitor already sent from a card (kept here, not in the card,
  // so a re-render of the list does not bring the form back).
  const [leftMessageTo, setLeftMessageTo] = useState<string | null>(null);
  const [leadEmail, setLeadEmail] = useState<string | null>(null);
  const [csatSent, setCsatSent] = useState(false);
  // The workspace blocked this visitor: the closed line (core/liveEvents.ts).
  const [blocked, setBlocked] = useState<string | null>(null);
  // "Email me this chat": the card is up, and where it went once sent.
  const [mailOpen, setMailOpen] = useState(false);
  const [mailSentTo, setMailSentTo] = useState<string | null>(null);
  const reported = useRef({ delivered: '', seen: '' });
  // The flow's end asked for the rating: it shows 1.5 s later (web index.ts),
  // and the post-chat redirect already waits for it.
  const [csatDue, setCsatDue] = useState(false);
  const csatDueTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The conversation already asked for its rating (#76): never twice.
  const ratingAskedFor = useRef<string | null>(null);
  const storeRef = useRef(store);
  storeRef.current = store;
  // The latest state, for the flow's end and its timer.
  const now = useRef({ csatConfig: null as CsatConfig | null, csatOpen: false, csatSent: false, blocked: null as string | null });
  now.current = { csatConfig, csatOpen, csatSent, blocked };

  const sid = () => socketClient.current?.chatSessionId || chatStateRef.current?.sessionId || '';
  const own = (data: any) => !data?.chatSessionId || !sid() || data.chatSessionId === sid();

  /** Remembered so a restart does not ask this conversation again. */
  const rememberAsked = (id: string) => {
    ratingAskedFor.current = id;
    if (!id || !storeRef.current) return;
    Promise.resolve()
      .then(() => storeRef.current?.setItem(RATING_OFFERED_KEY_PREFIX + id, '1'))
      .catch(() => {});
  };
  const cancelCsatDue = () => {
    if (csatDueTimer.current) clearTimeout(csatDueTimer.current);
    csatDueTimer.current = null;
    setCsatDue(false);
  };

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
      if (!own(data)) return;
      setQueue(queueStatusOf(data));
      onQueueStatusRef.current?.(data);
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
    socket.on('chat-ended', (data: any) => {
      if (!own(data)) return;
      // The same end again: one survey, not two (core/liveEvents.ts).
      if (endedSinceLastLive(chatStateRef.current?.getRecord?.() || [])) return;
      setQueue(null);
      setLockedBy(null);
      setFileRequestedBy(null);
      setCsatOpen(true);
      // The flow's end that may follow asks no second time (#76).
      rememberAsked(sid());
    });
    // Blocked by the workspace, mid-chat or at the handshake (web
    // _applyVisitorBlock): the chat closes with a neutral line, whatever
    // was waiting goes, and nothing more is taken.
    socket.on('visitor-blocked', (data: any) => {
      if (!own(data)) return;
      setBlocked(blockedText(data));
      setQueue(null);
      setWaiting(null);
      setNoAgents(false);
      setLeadCardOpen(false);
      setFileRequestedBy(null);
      setCsatOpen(false);
      cancelCsatDue();
      setMailOpen(false);
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
        if (!res) return;
        setQueue(queueStatusOf(res));
        onQueueStatusRef.current?.(res);
      });
    };
    ask();
    const t = setInterval(ask, QUEUE_POLL_MS);
    return () => clearInterval(t);
  }, [waitingForPerson]);

  // The handover step's max wait: once it passes with nobody joined, the
  // server is asked to decide (handover-timeout) and answers with
  // no-agents-available. Once per wait. A restored wait goes on from the
  // server's seconds left (web special.ts _attachHandoverWait). The wait
  // card counts down to it (waitEndsAt).
  useEffect(() => {
    if (!waitingForPerson || !handoverWait) return;
    const { data, workspaceId } = handoverWait();
    const deadline = waitDeadline(data?.maxWaitTime, restoredRemaining.current);
    restoredRemaining.current = null;
    setWaitEndsAt(deadline);
    const t = setTimeout(() => {
      const id = sid();
      if (id) socketClient.current?.emitToServer('handover-timeout', buildHandoverTimeoutPayload(id, data, workspaceId));
    }, Math.max(0, deadline - Date.now()));
    return () => {
      clearTimeout(t);
      setWaitEndsAt(null);
    };
  }, [waitingForPerson]);

  /** A restored wait for a person: its seconds left, before the wait starts again (useHandoverLifecycle). */
  const resumeWaitWith = useCallback((remainingSeconds: number | null) => {
    restoredRemaining.current = typeof remainingSeconds === 'number' ? remainingSeconds : null;
  }, []);

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
    rememberAsked(sid());
  }, [csatConfig]);

  /**
   * The flow reached its end (web index.ts, the end of a path that is not a
   * sub-flow's): the post-chat rating [delayMs] later, as an agent ending the
   * chat opens it, when the bot has one on, the visitor is not blocked, none
   * is up or sent, and this conversation was not asked before (kept in the
   * SDK's storage, so a restart does not ask again) (#76).
   */
  const flowEnded = useCallback((delayMs: number = FLOW_END_RATING_MS) => {
    const can = () => {
      const c = now.current;
      return !!c.csatConfig && !c.blocked && !c.csatOpen && !c.csatSent;
    };
    const id = sid();
    if (!can() || ratingAskedFor.current === id) return;
    ratingAskedFor.current = id;
    if (csatDueTimer.current) clearTimeout(csatDueTimer.current);
    csatDueTimer.current = null;
    setCsatDue(true);
    const st = storeRef.current;
    Promise.resolve(id && st ? st.getItem(RATING_OFFERED_KEY_PREFIX + id) : null)
      .catch(() => null)
      .then((asked) => {
        // Asked before a restart, or another conversation by now: nothing.
        if (asked === '1' || ratingAskedFor.current !== id) {
          if (ratingAskedFor.current === id) setCsatDue(false);
          return;
        }
        rememberAsked(id);
        csatDueTimer.current = setTimeout(() => {
          csatDueTimer.current = null;
          setCsatDue(false);
          if (can() && ratingAskedFor.current === id) setCsatOpen(true);
        }, delayMs);
      });
  }, []);

  useEffect(() => () => {
    if (csatDueTimer.current) clearTimeout(csatDueTimer.current);
  }, []);

  /** "Email me this chat" from the menu: the card, once at a time (web mountEmailTranscript). */
  const openEmailTranscript = useCallback(() => {
    setMailSentTo(null);
    setMailOpen(true);
  }, []);
  const closeEmailTranscript = useCallback(() => setMailOpen(false), []);

  /**
   * Send the transcript to this address. Sent: the address is kept as the
   * visitor's (user metadata, the email answer) and the record goes, as the
   * web's rememberEmail does.
   */
  const emailTranscript = useCallback(
    async (email: string): Promise<TranscriptEmailResult> => {
      const id = sid();
      if (!id || !postTranscriptEmail) return { ok: false };
      const r = await postTranscriptEmail(id, email.trim());
      if (!r?.ok) return r || { ok: false };
      const state = chatStateRef.current;
      if (state) {
        state.setUserMetadata?.({ email: email.trim() });
        state.setAnswer?.('email-transcript', 'email', email.trim());
        sendRecord();
      }
      setMailSentTo(email.trim());
      return r;
    },
    [postTranscriptEmail, sendRecord]
  );

  const dismissCsat = useCallback(() => setCsatOpen(false), []);
  const dismissFileRequest = useCallback(() => setFileRequestedBy(null), []);

  const resetLiveChatExtras = useCallback(() => {
    restoredRemaining.current = null;
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
    cancelCsatDue();
    ratingAskedFor.current = null;
    setLeftMessageTo(null);
    setLeadEmail(null);
    setCsatSent(false);
    setBlocked(null);
    setMailOpen(false);
    setMailSentTo(null);
    reported.current = { delivered: '', seen: '' };
  }, []);

  return {
    queue,
    waitEndsAt,
    resumeWaitWith,
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
    csatDue,
    // The rating is up (or about to be) and not answered: the redirect waits for it.
    ratingPending: !!csatConfig && ((csatOpen && !csatSent) || csatDue),
    blocked,
    mailOpen,
    mailSentTo,
    openEmailTranscript,
    closeEmailTranscript,
    emailTranscript,
    setChatbotData,
    setupLiveChatListeners,
    flowEnded,
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
