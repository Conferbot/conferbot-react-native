/**
 * The conversation's human touches, wired (core/delight.ts; web
 * ts/chat/delight/index.ts, which watches the transcript):
 *
 *   - the bot reacts to an answer that deserves it, 550 ms after it lands;
 *   - bookings, payments and perfect scores celebrate (unless the visitor
 *     asks for less motion);
 *   - a question that waits a long while gets a gentle nudge;
 *   - the latest answer can be changed with one tap ("Edit"), which takes
 *     the conversation back to that question (NodeFlowEngine.rewindTo).
 *
 * An answer is a conversation row the flow hook stamps with `answerOf`
 * ({ nodeId, type, text }). Each touch follows the owner's setting
 * (botReactions, celebrations, stallNudges, allowChangeAnswer; all on
 * unless false).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, AppState } from 'react-native';
import {
  QUIET_BEFORE_CHANGE_MS,
  REACT_AFTER_MS,
  createStallWatch,
  nudgesWhileWaiting,
  showChangeFor,
  touchOn,
  touchesFor,
} from '../../core/delight';

export interface AnswerTouch {
  reaction?: string | null;
  /** Set when the answer bursts (a new value restarts it). */
  celebrate?: number;
}

interface Params {
  customizations: any;
  record: any[];
  setRecord: (fn: (prev: any[]) => any[]) => void;
  flowEngine: { current: any };
  currentUIState: any;
  isNodeProcessing: boolean;
  /** The chat is on screen: open, on the conversation. */
  chatVisible: boolean;
  /** A person or the AI agent is in the conversation, or it is over: no going back. */
  locked: boolean;
}

const rowId = (r: any): string => String(r?._id ?? r?.id ?? '');

/**
 * Where "Edit" cuts the conversation: the question's own rows just above
 * the answer (its bubble, its frozen choices), else the answer itself.
 */
export const cutIndexFor = (record: any[], answerIndex: number, nodeId: string): number => {
  let cut = answerIndex;
  for (let i = answerIndex - 1; i >= 0; i--) {
    const r = record[i];
    const own = r?.nodeId === nodeId || r?.choiceUI?.nodeId === nodeId;
    if (!own) break;
    cut = i;
  }
  return cut;
};

export function useDelight({ customizations, record, setRecord, flowEngine, currentUIState, isNodeProcessing, chatVisible, locked }: Params) {
  const [touches, setTouches] = useState<Record<string, AnswerTouch>>({});
  const [changeRowId, setChangeRowId] = useState<string | null>(null);
  const [stallHint, setStallHint] = useState<string | null>(null);
  const cz = useRef(customizations);
  cz.current = customizations;

  // Reduced motion: no confetti.
  const reduced = useRef(false);
  useEffect(() => {
    const a11y: any = AccessibilityInfo;
    Promise.resolve(a11y?.isReduceMotionEnabled?.())
      .then((on) => (reduced.current = !!on))
      .catch(() => undefined);
    const sub = a11y?.addEventListener?.('reduceMotionChanged', (on: boolean) => (reduced.current = !!on));
    return () => sub?.remove?.();
  }, []);

  // ---- The nudge ----
  const composer = useRef('');
  const visible = useRef(chatVisible);
  visible.current = chatVisible;
  const appActive = useRef(true);
  useEffect(() => {
    const sub: any = AppState.addEventListener?.('change', (s) => (appActive.current = s === 'active'));
    return () => sub?.remove?.();
  }, []);
  const stall = useRef(
    createStallWatch({
      isVisible: () => visible.current && appActive.current,
      composerValue: () => composer.current,
      show: (hint) => setStallHint(hint),
      hide: () => setStallHint(null),
    })
  ).current;
  useEffect(() => () => stall.disarm(), []);

  // A question on screen arms it (each new question restarts the wait).
  const armedFor = useRef<string | null>(null);
  useEffect(() => {
    const ui = currentUIState;
    const type = ui?.stepType || '';
    const key = ui && ui.type !== 'loading' && ui.nodeId ? `${ui.nodeId}:${type}` : null;
    if (key === armedFor.current) return;
    if (ui?.type === 'loading') return; // the typing dots before the next step: keep what is up
    armedFor.current = key;
    stall.disarm();
    if (key && touchOn(cz.current, 'stallNudges') && nudgesWhileWaiting(type)) stall.arm(type);
  }, [currentUIState]);

  // ---- Reactions and celebrations ----
  const seen = useRef<Set<string>>(new Set());
  const first = useRef(true);
  useEffect(() => {
    const ids = new Set(record.map(rowId));
    // What was on screen when the chat opened (restored) gets nothing.
    if (first.current) {
      first.current = false;
      seen.current = ids;
      return;
    }
    // Only answers given just now: a conversation put back on screen (restored) is not news.
    const now = Date.now();
    const fresh = record.filter(
      (r) => r?.answerOf && !seen.current.has(rowId(r)) && !(r.time && now - new Date(r.time).getTime() > 30_000)
    );
    seen.current = ids;
    for (const row of fresh) {
      stall.disarm();
      const id = rowId(row);
      const { type, text } = row.answerOf;
      setTimeout(() => {
        const touch = touchesFor(cz.current, type, String(text || row.text || ''), reduced.current);
        if (!touch.reaction && !touch.celebrate) return;
        setTouches((prev) => ({ ...prev, [id]: { reaction: touch.reaction, celebrate: touch.celebrate ? Date.now() : undefined } }));
      }, REACT_AFTER_MS);
    }
  }, [record]);

  // ---- "Edit" on the latest answer, once the bot has finished replying ----
  useEffect(() => {
    setChangeRowId(null);
    const timer = setTimeout(() => {
      const engine = flowEngine.current;
      if (!engine?.questionPoints) return;
      const users = record.filter((r) => r?.type === 'user-message' || r?.type === 'user-input-response');
      const last = users[users.length - 1];
      if (!last?.answerOf) return;
      const points = engine.questionPoints();
      const point = [...points].reverse().find((p: any) => p.nodeId === last.answerOf.nodeId);
      if (!point) return;
      const show = showChangeFor({
        customizations: cz.current,
        locked: locked || engine.getChatState?.()?.isFlowComplete === true,
        botBusy: isNodeProcessing,
        isLatestAnswer: true,
        questionType: point.type,
        typesSince: engine.typesSince(point),
      });
      if (show) setChangeRowId(rowId(last));
    }, QUIET_BEFORE_CHANGE_MS);
    return () => clearTimeout(timer);
  }, [record, isNodeProcessing, locked, currentUIState]);

  const changeAnswer = useCallback(() => {
    const engine = flowEngine.current;
    if (!engine?.rewindTo) return;
    const index = record.findIndex((r) => rowId(r) === changeRowId);
    const row = record[index];
    if (!row?.answerOf) return;
    const point = [...engine.questionPoints()].reverse().find((p: any) => p.nodeId === row.answerOf.nodeId);
    if (!point) return;
    const cut = cutIndexFor(record, index, row.answerOf.nodeId);
    setChangeRowId(null);
    stall.disarm();
    setRecord((prev) => prev.slice(0, Math.min(cut, prev.length)));
    engine.rewindTo(point.id);
  }, [record, changeRowId]);

  return {
    touches,
    changeRowId,
    changeAnswer,
    stallHint,
    /** The visitor touched, scrolled or typed in the chat. */
    noteActivity: () => stall.touch(),
    /** What is in the composer (a nudge waits while something is typed). */
    setComposerValue: (v: string) => {
      composer.current = v || '';
      stall.touch();
    },
    clearTouch: (id: string) =>
      setTouches((prev) => (prev[id]?.celebrate ? { ...prev, [id]: { ...prev[id], celebrate: undefined } } : prev)),
  };
}
