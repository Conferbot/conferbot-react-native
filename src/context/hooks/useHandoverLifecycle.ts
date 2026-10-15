// @ts-nocheck
/**
 * The handover's lifecycle on screen: the "Connecting you with the team…"
 * line and how it settles, the 20s waiting signal, leaving the queue, and
 * picking a live chat back up after the app restarts. The logic is in
 * core/handoverState.ts and core/handoverWaiting.ts (ported from the web
 * widget's handoverState.ts, handoverWaiting.ts, special.ts and index.ts);
 * this hook only applies it to the record and the socket.
 */
import { useCallback, useEffect, useRef } from 'react';
import type ConferBotSocket from '../../services/socket';
import type { ChatState, NodeFlowEngine, NodeUIState } from '../../core';
import type { Agent, RecordItem } from '../../types';
import { deduplicateMessages, trimMessages } from '../types';
import {
  HANDOVER_TEXT,
  acceptedPlan,
  agentLeftKind,
  agentLeftText,
  annotateRestoredHandovers,
  hasPendingHandoverLine,
  joinedText,
  queueLeaveNeedsState,
  queueLeaveResult,
  queueSelfResolvePayload,
  restoreNeedsLiveChatState,
  restoreStep,
  restoredLiveChat,
  settleHandoverEntries,
  type HandoverOutcome,
  type RestoreStep,
} from '../../core/handoverState';
import {
  HUMAN_JOINED_EVENT,
  WAITING_FOR_HUMAN_EVENT,
  WAIT_OVER_EVENT,
  createConnectingSignal,
  createSignalBus,
  waitingDetail,
  type WaitOverDetail,
  type WidgetSignalDetail,
  type WidgetSignalName,
} from '../../core/handoverWaiting';

interface Params {
  socketClient: React.MutableRefObject<ConferBotSocket | null>;
  chatStateRef: React.MutableRefObject<ChatState | null>;
  flowEngine: React.MutableRefObject<NodeFlowEngine | null>;
  record: RecordItem[];
  setRecord: React.Dispatch<React.SetStateAction<RecordItem[]>>;
  isOpen: boolean;
  setIsLiveChatMode: (on: boolean) => void;
  setCurrentAgent: (agent: Agent | undefined) => void;
  setCurrentUIState: (s: NodeUIState | null) => void;
  setIsNodeProcessing: (on: boolean) => void;
  /** A flow's handover step is waiting for a person (no AI takes it first). */
  waitingForPerson: boolean;
}

const now = () => new Date().toISOString();
// Its own id per entry: two lines in the same millisecond must not merge.
const entryId = (kind: string) => `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export function useHandoverLifecycle({
  socketClient,
  chatStateRef,
  flowEngine,
  record,
  setRecord,
  isOpen,
  setIsLiveChatMode,
  setCurrentAgent,
  setCurrentUIState,
  setIsNodeProcessing,
  waitingForPerson,
}: Params) {
  // The listeners are set up once: they read the latest record and state here.
  const recordRef = useRef(record);
  recordRef.current = record;
  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;
  // The session restored from the device at start-up (the flow is not run
  // again until the server says where its live chat stands).
  const restoredSessionRef = useRef<string | null>(null);

  const bus = useRef(createSignalBus()).current;
  const connecting = useRef(
    createConnectingSignal(
      () => bus.emit(WAITING_FOR_HUMAN_EVENT, waitingDetail({ offline: false, reason: 'busy' })),
      () => isOpenRef.current
    )
  ).current;

  const sid = () => socketClient.current?.chatSessionId || chatStateRef.current?.sessionId || '';
  const own = (data: any) => !data?.chatSessionId || !sid() || data.chatSessionId === sid();

  /** Add an entry to the screen and (with `server`) to the conversation's record. */
  const add = useCallback(
    (ui: any, server?: any) => {
      recordRef.current = deduplicateMessages(trimMessages([...recordRef.current, ui]));
      setRecord((prev) => deduplicateMessages(trimMessages([...prev, ui])));
      if (server) chatStateRef.current?.addRecord(server);
    },
    [setRecord]
  );

  /** The Connecting line has its answer: settled on screen and in the record. */
  const settle = useCallback(
    (outcome: HandoverOutcome) => {
      recordRef.current = settleHandoverEntries(recordRef.current, outcome).record;
      setRecord((prev) => settleHandoverEntries(prev, outcome).record);
      const state = chatStateRef.current;
      if (state) {
        const next = settleHandoverEntries(state.getRecord(), outcome);
        if (next.settled) state.setRecord(next.record);
      }
    },
    [setRecord]
  );

  /** The wait ended without a person: no waiting signal, and cb:wait-over. */
  const waitOver = useCallback((reason: WaitOverDetail['reason']) => {
    connecting.end();
    bus.emit(WAIT_OVER_EVENT, { reason });
  }, []);

  const waitingRef = useRef(false);
  waitingRef.current = waitingForPerson;
  const inWait = () => waitingRef.current || connecting.pending() || hasPendingHandoverLine(recordRef.current);

  // A flow's handover waiting for a person straight away: the 20s signal
  // (web special.ts startHandover; not when an AI agent takes it first).
  useEffect(() => {
    if (!waitingForPerson) return;
    const data: any = flowEngine.current?.handoverNodeData?.();
    if (!(Array.isArray(data?.assignedAIAgents) && data.assignedAIAgents.length)) connecting.start();
  }, [waitingForPerson]);

  /**
   * agent-left (web agentListeners.ts): an AI escalating draws one
   * Connecting line and starts the wait; an idle pause draws nothing; a
   * person leaving says so. Returns the kind.
   */
  const onAgentLeft = useCallback(
    (data: any) => {
      const kind = agentLeftKind(data);
      if (kind === 'ignore') return kind;
      const name = data?.agentDetails?.name || '';
      const handover = kind === 'handover';
      if (handover) {
        connecting.start();
        // The same escalation again: one line is enough.
        if (hasPendingHandoverLine(recordRef.current)) return kind;
      }
      const id = entryId('agent-left');
      const time = now();
      add(
        { _id: id, type: 'agent-left-chat', text: agentLeftText(name, handover), name, time, ...(handover ? { handover: true } : {}) },
        { id, agentId: data?.agentDetails?._id, type: 'agent-left-chat', time, name, ...(handover ? { handover: true } : {}) }
      );
      return kind;
    },
    [add]
  );

  /**
   * agent-accepted (web special.ts _handleHandoverAccepted): the wait is
   * over - a person joined, or the AI took the chat back. Settles the line,
   * ends the waiting signal, says cb:human-joined for a person. Returns the
   * plan (announce: draw the join line).
   */
  const onAccepted = useCallback(
    (data: any) => {
      const plan = acceptedPlan(recordRef.current, data);
      connecting.end();
      settle(plan.outcome);
      if (plan.humanJoined) bus.emit(HUMAN_JOINED_EVENT, { name: data?.agentDetails?.name || null });
      return plan;
    },
    [settle]
  );

  /** The join line: "<name> joined the chat", with its note after an AI handover. */
  const addJoin = useCallback(
    (details: any, plan: { ai: boolean; afterAI: boolean }) => {
      const name = details?.name || 'Agent';
      const id = entryId('agent-joined');
      const time = now();
      const marks = { agentId: details?._id, ...(plan.afterAI ? { afterAI: true } : {}), ...(plan.ai ? { ai: true } : {}) };
      add(
        { _id: id, type: 'agent-joined-message', text: joinedText(name), name, time, ...marks },
        { id, type: 'agent-joined-message', time, name, ...marks }
      );
    },
    [add]
  );

  /** Out of the queue: the line, the record, the signal, the flow moves on. */
  const leftQueue = useCallback(() => {
    waitOver('cancelled');
    settle('cancelled');
    const id = entryId('queue-self-resolved');
    const time = now();
    add({ _id: id, type: 'queue-self-resolved', text: HANDOVER_TEXT.cancelled, time }, { id, type: 'queue-self-resolved', time, text: HANDOVER_TEXT.cancelled });
    const engine = flowEngine.current;
    if (engine?.isAtHandover()) engine.submitResponse({ action: 'cancel', queueLeft: true });
  }, [add, settle, waitOver]);

  /**
   * The visitor leaves the queue (the wait card's Cancel): queue-self-resolve,
   * as the web widget does, so the team stops seeing them waiting. False
   * when a person already picked the chat up (they stay).
   */
  const leaveQueue = useCallback(async (): Promise<boolean> => {
    const socket = socketClient.current;
    const res = await socket?.emitWithAck('queue-self-resolve', queueSelfResolvePayload(sid()), 8000);
    // not_waiting: no queued ticket - or a person just took it (in progress).
    const state = queueLeaveNeedsState(res) ? await socket?.emitWithAck('live-chat-state', { chatSessionId: sid() }, 8000) : null;
    if (queueLeaveResult(res, state) === 'stay') return false;
    leftQueue();
    return true;
  }, [leftQueue]);

  const setupHandoverListeners = useCallback(() => {
    const socket = socketClient.current;
    if (!socket) return;
    // The server's own word on the wait (an AI escalation found nobody):
    // its cb:waiting-for-human, never ours as well.
    socket.on('handover-waiting', (data: any) => {
      if (!own(data)) return;
      connecting.end();
      settle('unavailable');
      bus.emit(WAITING_FOR_HUMAN_EVENT, waitingDetail(data));
    });
    socket.on('no-agents-available', () => {
      settle('unavailable');
      waitOver('unavailable');
    });
    socket.on('chat-ended', (data: any) => {
      if (!own(data)) return;
      const waiting = inWait();
      settle('ended');
      if (waiting) waitOver('ended');
    });
    socket.on('ai-agent-inactive-close', (data: any) => {
      if (!own(data)) return;
      const waiting = inWait();
      settle('ended');
      if (waiting) waitOver('ended');
    });
    // Left the queue from another device of this chat.
    socket.on('queue-left', (data: any) => {
      if (!own(data) || data?.reason !== 'self_service') return;
      if (flowEngine.current?.isAtHandover() && waitingRef.current) leftQueue();
    });
  }, [settle, waitOver, leftQueue]);

  /**
   * A chat restored from the device: ask the server where its live chat
   * stands (live-chat-state) and pick it back up - the person and the
   * join line it missed, still in the queue, or over - instead of running
   * the flow again. Returns what was done; 'start' leaves the chat to start
   * as any restored chat. The flow must be loaded already.
   */
  const resumeRestored = useCallback(
    async (o: { sessionId: string; nodes: any[]; agentBot: boolean }): Promise<RestoreStep> => {
      const state = chatStateRef.current;
      const socket = socketClient.current;
      if (!state || !socket) return 'start';
      // Lines whose outcome the record knows are drawn settled.
      const annotated = annotateRestoredHandovers(recordRef.current);
      if (annotated.changed) {
        recordRef.current = annotated.record;
        setRecord(annotated.record);
      }
      const ownRecord = annotateRestoredHandovers(state.getRecord());
      if (ownRecord.changed) state.setRecord(ownRecord.record);

      const handoverNode = o.agentBot
        ? null
        : (o.nodes || []).find((n: any) => n?.id === state.currentNodeId && n?.type === 'human-handover-node');
      const atHandover = !!handoverNode;
      if (!restoreNeedsLiveChatState(annotated.record, atHandover)) return 'start';

      // Back in the room first: the server answers only its own session.
      socket.joinChatRoomVisitor(o.sessionId);
      const res = await socket.emitWithAck('live-chat-state', { chatSessionId: o.sessionId }, 10000);
      const r = restoredLiveChat(res || { status: 'none' }, recordRef.current);
      if (r.settle) settle(r.settle);
      const step = restoreStep(r, atHandover, recordRef.current);
      const engine = flowEngine.current;
      const waitUI = handoverNode ? ({ type: 'humanHandover', nodeId: handoverNode.id, stage: 'waiting' } as any) : null;

      if (step === 'live') {
        setIsLiveChatMode(true);
        if (r.agent) {
          setCurrentAgent({ id: r.agent.id, name: r.agent.name, email: r.agent.email, isAIAgent: false });
          if (r.drawJoin) addJoin({ _id: r.agent.id, name: r.agent.name }, { ai: false, afterAI: r.afterAI });
        }
        if (r.status === 'waiting') connecting.start();
        setCurrentUIState(null);
        setIsNodeProcessing(false);
      } else if (step === 'wait' && engine && waitUI) {
        engine.waitAt(handoverNode.id, waitUI);
        connecting.start();
      } else if (step === 'continue' && engine && waitUI) {
        // Ended while the app was closed: say so, as the live event would.
        if (r.status === 'ended') {
          const id = entryId('chat-ended');
          add({ _id: id, type: 'agent-chat-ended', text: 'Chat has ended', time: now() }, { id, type: 'agent-chat-ended', time: now() });
        }
        setIsLiveChatMode(false);
        if (engine.waitAt(handoverNode.id, waitUI)) engine.submitResponse({ action: 'continue' });
      } else if (step === 'ask' && engine && handoverNode) {
        engine.resumeFrom(handoverNode.id);
      }
      return step;
    },
    [add, addJoin, settle, setRecord]
  );

  const onWidgetSignal = useCallback(
    (name: WidgetSignalName, fn: (detail: WidgetSignalDetail) => void) => bus.on(name, fn),
    []
  );

  const resetHandover = useCallback(() => {
    connecting.end();
    restoredSessionRef.current = null;
  }, []);

  useEffect(() => () => connecting.end(), []);

  return {
    recordRef,
    restoredSessionRef,
    settle,
    onAgentLeft,
    onAccepted,
    addJoin,
    leaveQueue,
    setupHandoverListeners,
    resumeRestored,
    onWidgetSignal,
    resetHandover,
  };
}

export type HandoverLifecycle = ReturnType<typeof useHandoverLifecycle>;
