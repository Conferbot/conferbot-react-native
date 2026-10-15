/**
 * The handover lifecycle (src/core/handoverState.ts), the same cases as the
 * web widget's tests/handoverLifecycle.test.js, plus the socket readings
 * (agent-left reasons, agent-accepted, queue-self-resolve, live-chat-state).
 */
import {
  HANDOVER_TEXT,
  HANDED_OVER_NOTE,
  acceptedPlan,
  agentLeftKind,
  agentLeftText,
  annotateRestoredHandovers,
  handoverLineText,
  handoverOutcomeAt,
  handoverPhase,
  hasPendingHandoverLine,
  isRepeatJoin,
  joinedText,
  queueLeaveNeedsState,
  queueLeaveResult,
  queueSelfResolvePayload,
  restoreNeedsLiveChatState,
  restoredLiveChat,
  restoreStep,
  settleHandoverEntries,
  talkToPersonAllowed,
} from '../../src/core/handoverState';

const aiJoin = { type: 'agent-joined-message', agentId: 'ai-agent-1', name: 'Ava' };
const escalated = { type: 'agent-left-chat', name: 'Ava', handover: true };
const human = { type: 'agent-joined-message', agentId: 'u1', name: 'admin' };
const humanLeft = { type: 'agent-left-chat', name: 'admin' };
const ended = { type: 'agent-chat-ended' };
const reply = { shape: 'agent-message', text: 'hi' };

describe('handoverState (web handoverState.ts)', () => {
  it('phase: bot, connecting, a person joined, left, ended', () => {
    expect(handoverPhase([])).toBe('none');
    expect(handoverPhase(undefined)).toBe('none');
    expect(handoverPhase([reply])).toBe('none');
    expect(handoverPhase([aiJoin, reply])).toBe('none');
    expect(handoverPhase([aiJoin, reply, escalated])).toBe('connecting');
    expect(handoverPhase([escalated, { ...aiJoin, ai: true }, reply])).toBe('connecting');
    expect(handoverPhase([escalated, human, reply])).toBe('joined');
    expect(handoverPhase([escalated, human, humanLeft])).toBe('none');
    expect(handoverPhase([escalated, human, ended])).toBe('none');
    expect(handoverPhase([escalated, { type: 'agent-declined-message' }])).toBe('none');
    expect(handoverPhase([escalated, { type: 'queue-self-resolved' }])).toBe('none');
    expect(handoverPhase([{ type: 'agent-joined-message', agentId: 'u2', takeover: true }])).toBe('joined');
  });

  it('Talk to a person is offered only when nobody is coming or here', () => {
    expect(talkToPersonAllowed([aiJoin, reply])).toBe(true);
    expect(talkToPersonAllowed([aiJoin, escalated])).toBe(false);
    expect(talkToPersonAllowed([escalated, human])).toBe(false);
    expect(talkToPersonAllowed([escalated, human, humanLeft, reply])).toBe(true);
  });

  it('the same agent joining again is a repeat; another agent (a transfer) is news', () => {
    expect(isRepeatJoin([escalated, human], 'u1')).toBe(true);
    expect(isRepeatJoin([escalated, human, reply], 'u1')).toBe(true);
    expect(isRepeatJoin([escalated, human], 'u2')).toBe(false);
    expect(isRepeatJoin([escalated, human, humanLeft], 'u1')).toBe(false);
    expect(isRepeatJoin([escalated], 'u1')).toBe(false);
    expect(isRepeatJoin([escalated, human], undefined)).toBe(false);
  });

  it('outcome of a handover line, from what came after it', () => {
    expect(handoverOutcomeAt([escalated], 0)).toBeNull();
    expect(handoverOutcomeAt([escalated, reply], 0)).toBeNull();
    expect(handoverOutcomeAt([escalated, human], 0)).toBe('joined');
    expect(handoverOutcomeAt([escalated, { type: 'agent-joined-message', agentId: 'u2', takeover: true }], 0)).toBe('joined');
    expect(handoverOutcomeAt([escalated, aiJoin], 0)).toBe('unavailable');
    expect(handoverOutcomeAt([escalated, { type: 'agent-declined-message' }], 0)).toBe('unavailable');
    expect(handoverOutcomeAt([escalated, { type: 'queue-self-resolved' }], 0)).toBe('cancelled');
    expect(handoverOutcomeAt([escalated, ended], 0)).toBe('ended');
    expect(handoverOutcomeAt([escalated, { type: 'ai-agent-inactive-close' }], 0)).toBe('ended');
    expect(handoverOutcomeAt([escalated, reply, { ...escalated }], 0)).toBe('unavailable');
    expect(handoverOutcomeAt([{ ...escalated, settled: 'unavailable' }, human], 0)).toBe('unavailable');
  });

  it('a restored record: finished waits settle, a join after an AI handover keeps its note', () => {
    const rec = [aiJoin, { ...escalated, text: HANDOVER_TEXT.pending }, { ...human }, reply, { ...humanLeft }];
    const { record: out, changed } = annotateRestoredHandovers(rec);
    expect(changed).toBe(2);
    expect((out[1] as any).settled).toBe('joined');
    expect((out[1] as any).text).toBe('Connected with the team');
    expect((out[2] as any).afterAI).toBe(true);
    expect((out[2] as any).note).toBe(HANDED_OVER_NOTE);
    expect((out[0] as any).afterAI).toBeUndefined();
    // The input is left alone.
    expect((rec[1] as any).settled).toBeUndefined();

    const waiting = [aiJoin, { ...escalated }, reply];
    const w = annotateRestoredHandovers(waiting);
    expect(w.changed).toBe(0);
    expect(w.record).toBe(waiting);

    const later = [{ ...escalated }, { type: 'agent-chat-ended' }, { type: 'agent-joined-message', agentId: 'u3' }];
    const l = annotateRestoredHandovers(later).record as any[];
    expect(l[0].settled).toBe('ended');
    expect(l[2].afterAI).toBeUndefined();
  });

  it('settling touches only pending handover entries', () => {
    const rec = [{ ...escalated, settled: 'unavailable' }, { ...escalated, text: 'x' }, { ...humanLeft }];
    const a = settleHandoverEntries(rec, 'joined');
    expect(a.settled).toBe(1);
    expect((a.record[0] as any).settled).toBe('unavailable');
    expect((a.record[1] as any).settled).toBe('joined');
    expect((a.record[1] as any).text).toBe('Connected with the team');
    expect((a.record[2] as any).settled).toBeUndefined();
    expect(settleHandoverEntries(a.record, 'joined').settled).toBe(0);
    expect(settleHandoverEntries(a.record, 'joined').record).toBe(a.record);
    expect(settleHandoverEntries(rec, 'bogus' as any).settled).toBe(0);
    expect(hasPendingHandoverLine(rec)).toBe(true);
    expect(hasPendingHandoverLine(a.record)).toBe(false);
  });

  it('the line: pending words, then each of the four outcomes', () => {
    expect(handoverLineText(null)).toBe('Connecting you with the team…');
    expect(handoverLineText('joined')).toBe('Connected with the team');
    expect(handoverLineText('unavailable')).toBe("The team couldn't join just now");
    expect(handoverLineText('cancelled')).toBe('You left the queue');
    expect(handoverLineText('ended')).toBe('Chat ended before the team joined');
    expect(agentLeftText('Ava', true)).toBe('Connecting you with the team…');
    expect(agentLeftText('Sam', false)).toBe('Sam left the chat');
    expect(agentLeftText('', false)).toBe('The agent left the chat');
    expect(joinedText('Sam')).toBe('Sam joined the chat');
    expect(joinedText(undefined)).toBe('An agent joined the chat');
  });
});

describe('socket readings (web agentListeners.ts / special.ts)', () => {
  it('agent-left: an AI escalating is a handover, an idle pause is nothing, a person leaves', () => {
    expect(agentLeftKind({ reason: 'escalated', agentDetails: { name: 'Ava' } })).toBe('handover');
    expect(agentLeftKind({ handover: true, agentDetails: { name: 'Ava' } })).toBe('handover');
    expect(agentLeftKind({ agentDetails: { name: 'Ava', isAIAgent: true } })).toBe('handover');
    expect(agentLeftKind({ reason: 'visitor_inactive', agentDetails: { isAIAgent: true } })).toBe('ignore');
    expect(agentLeftKind({ agentDetails: { name: 'Sam' } })).toBe('left');
    expect(agentLeftKind(undefined)).toBe('left');
  });

  it('agent-accepted: a person settles joined; the AI taking it back settles unavailable; a repeat is not announced', () => {
    const p = acceptedPlan([aiJoin, escalated], { agentDetails: { _id: 'u1', name: 'Sam' } });
    expect(p).toEqual({ ai: false, outcome: 'joined', announce: true, afterAI: true, humanJoined: true });
    const back = acceptedPlan([aiJoin, escalated], { agentDetails: { _id: 'ai-agent-1', name: 'Ava', isAIAgent: true } });
    expect(back.outcome).toBe('unavailable');
    expect(back.humanJoined).toBe(false);
    expect(back.afterAI).toBe(false);
    const again = acceptedPlan([escalated, human], { agentDetails: { _id: 'u1', name: 'admin' } });
    expect(again.announce).toBe(false);
    expect(again.humanJoined).toBe(false);
    // A flow handover with no AI before it: no note.
    expect(acceptedPlan([], { agentDetails: { _id: 'u1' } }).afterAI).toBe(false);
  });

  it('leaving the queue: queue-self-resolve, and stay only when a person already has it', () => {
    expect(queueSelfResolvePayload('s1')).toEqual({ chatSessionId: 's1' });
    expect(queueSelfResolvePayload('s1', 'a9')).toEqual({ chatSessionId: 's1', articleId: 'a9' });
    expect(queueLeaveResult({ ok: true })).toBe('leave');
    expect(queueLeaveResult({ ok: false, reason: 'not_waiting' })).toBe('leave');
    expect(queueLeaveResult(null)).toBe('leave');
    expect(queueLeaveResult({ ok: false, reason: 'agent_joined' })).toBe('stay');
    // A person accepted (ticket in progress): the server says not_waiting,
    // live-chat-state says live.
    expect(queueLeaveNeedsState({ ok: false, reason: 'not_waiting' })).toBe(true);
    expect(queueLeaveNeedsState({ ok: true })).toBe(false);
    expect(queueLeaveResult({ ok: false, reason: 'not_waiting' }, { status: 'live' })).toBe('stay');
    expect(queueLeaveResult({ ok: false, reason: 'not_waiting' }, { status: 'ended' })).toBe('leave');
  });
});

describe('restore (web index.ts live-chat-state)', () => {
  it('asks the server only for a chat in a live episode or at its handover', () => {
    expect(restoreNeedsLiveChatState([])).toBe(false);
    expect(restoreNeedsLiveChatState([{ type: 'bot-message' }])).toBe(false);
    expect(restoreNeedsLiveChatState([{ type: 'bot-message' }], true)).toBe(true);
    expect(restoreNeedsLiveChatState([human, { type: 'agent-message' }])).toBe(true);
    expect(restoreNeedsLiveChatState([aiJoin, escalated])).toBe(true);
    // The episode ended: over.
    expect(restoreNeedsLiveChatState([human, { type: 'agent-message' }, ended])).toBe(false);
    expect(restoreNeedsLiveChatState([human, ended], true)).toBe(false);
    // A new episode after an ended one.
    expect(restoreNeedsLiveChatState([human, ended, { type: 'user-message', shape: 'user-live-message' }])).toBe(true);
  });

  it('live: the person, the join line it missed, the line settled', () => {
    const r = restoredLiveChat({ status: 'live', agentDetails: { _id: 'u1', name: 'Sam', email: 's@x.io' } }, [aiJoin, escalated]);
    expect(r).toEqual({
      status: 'live',
      agent: { id: 'u1', name: 'Sam', email: 's@x.io' },
      settle: 'joined',
      drawJoin: true,
      afterAI: true,
      remainingSeconds: null,
    });
    // Already drawn before the restart: not again.
    expect(restoredLiveChat({ status: 'live', agentDetails: { _id: 'u1', name: 'Sam' } }, [escalated, human]).drawJoin).toBe(false);
    // The AI on the chat is not a person.
    expect(restoredLiveChat({ status: 'live', agentDetails: { _id: 'ai-agent-1', isAIAgent: true } }, [escalated]).status).toBe('none');
  });

  it('waiting keeps the line pending with the time left; ended and fallback settle it', () => {
    const now = 1_000_000;
    const w = restoredLiveChat({ status: 'waiting', waitEndsAt: now + 61_000 }, [escalated], now);
    expect(w.status).toBe('waiting');
    expect(w.settle).toBeNull();
    expect(w.remainingSeconds).toBe(61);
    expect(restoredLiveChat({ status: 'waiting', waitEndsAt: now - 5000 }, [], now).remainingSeconds).toBe(5);
    expect(restoredLiveChat({ status: 'ended' }, [escalated]).settle).toBe('ended');
    expect(restoredLiveChat({ status: 'fallback' }, [escalated]).status).toBe('fallback');
    expect(restoredLiveChat({ status: 'fallback' }, [escalated]).settle).toBe('unavailable');
    expect(restoredLiveChat({ status: 'none' }, [reply]).settle).toBeNull();
    expect(restoredLiveChat(null, []).status).toBe('none');
  });

  it('what a restored chat does next', () => {
    const at = (status: string, extra: any = {}) => restoredLiveChat({ status, ...extra }, []);
    const live = restoredLiveChat({ status: 'live', agentDetails: { _id: 'u1', name: 'Sam' } }, []);
    expect(restoreStep(live, true)).toBe('live');
    expect(restoreStep(live, false)).toBe('live');
    expect(restoreStep(at('waiting'), true)).toBe('wait');
    // Waiting after an AI escalation: the AI keeps the chat meanwhile.
    expect(restoreStep(at('waiting'), false)).toBe('live');
    expect(restoreStep(at('ended'), true, [human])).toBe('continue');
    expect(restoreStep(at('fallback'), true, [])).toBe('continue');
    expect(restoreStep(at('none'), true, [{ type: 'bot-message' }])).toBe('ask');
    expect(restoreStep(at('none'), true, [human, reply])).toBe('continue');
    expect(restoreStep(at('ended'), false)).toBe('start');
    expect(restoreStep(at('none'), false)).toBe('start');
  });
});
