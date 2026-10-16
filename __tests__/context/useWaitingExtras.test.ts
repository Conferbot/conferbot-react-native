/**
 * While you wait, end to end in the provider's hooks: useHandoverLifecycle
 * says where a wait for a person begins and ends and sends the signals,
 * useWaitingExtras draws the help card (6s in), the games (2.5s after the
 * waiting signal) and the server's queue-help pick with "That solved it",
 * against a fake socket on jest's fake clock.
 */
import { renderHook, act } from '@testing-library/react-native';
import { useHandoverLifecycle } from '../../src/context/hooks/useHandoverLifecycle';
import { useWaitingExtras, isScreenOnlyEntry } from '../../src/context/hooks/useWaitingExtras';

const fakeSocket = (ack: Record<string, any> = {}) => {
  const handlers: Record<string, ((d: any) => void)[]> = {};
  return {
    chatSessionId: 's1',
    on: jest.fn((event: string, fn: any) => {
      (handlers[event] ||= []).push(fn);
    }),
    emitWithAck: jest.fn((event: string) => Promise.resolve(ack[event] ?? null)),
    joinChatRoomVisitor: jest.fn(),
    fire(event: string, data?: any) {
      (handlers[event] || []).forEach((fn) => fn(data));
    },
  };
};

const KB = {
  categories: [{ name: 'Billing', articles: [{ _id: 'a1', title: 'Downloading invoices', description: 'Find every invoice in one place.' }] }],
  recentArticles: [],
};

const setup = (o: { ack?: any; customizations?: any; fetchArticle?: any } = {}) => {
  const socket = fakeSocket(o.ack);
  const serverRecord: any[] = [];
  const state = {
    sessionId: 's1',
    currentNodeId: null,
    getRecord: () => serverRecord,
    setRecord: jest.fn(),
    addRecord: jest.fn((r: any) => serverRecord.push(r)),
  };
  let screen: any[] = [{ _id: 'u1', type: 'user-message', text: 'Where can I download my invoices?' }];
  const setRecord = jest.fn((u: any) => {
    screen = typeof u === 'function' ? u(screen) : u;
  });
  const hooks = { start: () => {}, end: () => {} } as any;
  const waitHooks = { start: () => hooks.start(), end: () => hooks.end() };
  const hook = renderHook(() => {
    const handover = useHandoverLifecycle({
      socketClient: { current: socket as any },
      chatStateRef: { current: state as any },
      flowEngine: { current: null },
      record: screen,
      setRecord,
      isOpen: true,
      setIsLiveChatMode: jest.fn(),
      setCurrentAgent: jest.fn(),
      setCurrentUIState: jest.fn(),
      setIsNodeProcessing: jest.fn(),
      waitingForPerson: false,
      waitHooks,
    } as any);
    const waiting = useWaitingExtras({
      socketClient: { current: socket as any },
      record: screen,
      setRecord,
      customizations: o.customizations ?? { enableKnowledgeBase: true },
      onWidgetSignal: handover.onWidgetSignal,
      leftQueueHelped: handover.leftQueueHelped,
      fetchArticle: o.fetchArticle,
    } as any);
    hooks.start = waiting.waitHooks.start;
    hooks.end = waiting.waitHooks.end;
    return { handover, waiting };
  });
  act(() => {
    hook.result.current.handover.setupHandoverListeners();
    hook.result.current.waiting.setupWaitingListeners();
    hook.result.current.waiting.setKnowledgeBase(KB);
  });
  const escalate = () =>
    act(() => {
      hook.result.current.handover.onAgentLeft({ reason: 'escalated', agentDetails: { name: 'Ava', isAIAgent: true } });
    });
  const tick = (ms: number) =>
    act(() => {
      jest.advanceTimersByTime(ms);
    });
  return { hook, socket, screen: () => screen, serverRecord, escalate, tick, w: () => hook.result.current.waiting };
};

describe('useWaitingExtras', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('an AI passes them on: 6s in, the articles for their question, at the end of the conversation', () => {
    const { escalate, tick, w, screen } = setup();
    escalate();
    tick(5999);
    expect(w().helpCard).toBeNull();
    tick(1);
    expect(w().helpCard).toMatchObject({ solvable: false, items: [{ id: 'a1', title: 'Downloading invoices' }] });
    expect(screen()[screen().length - 1]).toMatchObject({ _id: 'cb-wait-help-1', type: 'cb-wait-help' });
    expect(isScreenOnlyEntry(screen()[screen().length - 1])).toBe(true);
  });

  it('20s in the waiting signal, 2.5s later the games; a person joining folds the unused offer away', () => {
    const { hook, escalate, tick, w, screen } = setup();
    escalate();
    tick(20000);
    expect(w().gamesCard).toBeNull();
    tick(2500);
    expect(w().gamesCard?.getState()).toMatchObject({ view: 'menu', title: 'While you wait - fancy a quick game? 🎮' });
    expect(screen().some((r) => r.type === 'cb-games')).toBe(true);
    act(() => {
      hook.result.current.handover.onAccepted({ agentDetails: { _id: 'p1', name: 'Sam' } });
    });
    expect(w().gamesCard).toBeNull();
    expect(screen().some((r) => r.type === 'cb-games')).toBe(false);
    // The help card stays, as history.
    expect(w().helpCard).toMatchObject({ settled: true });
  });

  it('a game under way when a person joins: saved and folded away, "Finish my game"', () => {
    const { hook, escalate, tick, w } = setup();
    escalate();
    tick(22500);
    act(() => w().gamesCard!.open('ttt'));
    act(() => {
      hook.result.current.handover.onAccepted({ agentDetails: { _id: 'p1', name: 'Sam' } });
    });
    expect(w().gamesCard?.getState()).toMatchObject({ view: 'paused', title: "Sam's here!" });
  });

  it('the games off: no offer; typing "play" is sent as words', () => {
    const { escalate, tick, w } = setup({ customizations: { enableKnowledgeBase: true, waitingGames: { enabled: false } } });
    escalate();
    tick(30000);
    expect(w().gamesCard).toBeNull();
    expect(w().interceptPlay('play')).toBe(false);
  });

  it('typing "play" while waiting opens the menu', () => {
    const { escalate, tick, w } = setup();
    escalate();
    expect(w().interceptPlay('play')).toBe(false);
    tick(20000);
    let opened = false;
    act(() => {
      opened = w().interceptPlay("let's play");
    });
    expect(opened).toBe(true);
    expect(w().gamesCard?.getState().title).toBe('Pick a game');
  });

  it("the server's queue-help: That solved it leaves the queue, the article named", async () => {
    const { socket, escalate, w, screen, serverRecord } = setup({ ack: { 'queue-self-resolve': { ok: true } } });
    escalate();
    act(() => socket.fire('queue-help', { chatSessionId: 's1', items: [{ kind: 'article', id: 'k9', title: 'Invoices' }], offer: 1 }));
    expect(w().helpCard).toMatchObject({ solvable: true, items: [{ id: 'k9' }] });
    let ok = false;
    await act(async () => {
      ok = await w().solveWait();
    });
    expect(ok).toBe(true);
    expect(socket.emitWithAck).toHaveBeenCalledWith('queue-self-resolve', { chatSessionId: 's1', articleId: 'k9' }, 8000);
    expect(w().helpCard).toMatchObject({ done: true, settled: true });
    expect(screen().find((r) => r.type === 'queue-self-resolved')).toMatchObject({ text: 'You left the queue. Glad that helped.' });
    expect(serverRecord.find((r) => r.type === 'queue-self-resolved')).toMatchObject({ text: 'Resolved while waiting' });
    // The Connecting line settled as left.
    expect(screen().find((r) => r.type === 'agent-left-chat')).toMatchObject({ settled: 'cancelled' });
  });

  it('That solved it refused: the button comes back, nothing recorded', async () => {
    const { socket, escalate, w, screen } = setup({ ack: { 'queue-self-resolve': { ok: false, reason: 'agent_joined' } } });
    escalate();
    act(() => socket.fire('queue-help', { items: [{ id: 'k9', title: 'Invoices' }] }));
    await act(async () => {
      await w().solveWait();
    });
    expect(w().helpCard).toMatchObject({ busy: false, done: false, solvable: true });
    expect(screen().some((r) => r.type === 'queue-self-resolved')).toBe(false);
  });

  it('a waiting queue-status: the server picks the help, ours stays out', () => {
    const { escalate, tick, w } = setup();
    escalate();
    act(() => w().onQueueStatus({ chatSessionId: 's1', status: 'waiting', position: 2 }));
    tick(6000);
    expect(w().helpCard).toBeNull();
    act(() => w().onQueueStatus({ chatSessionId: 'other', status: 'waiting', help: { items: [{ id: 'x', title: 'X' }] } }));
    expect(w().helpCard).toBeNull();
  });

  it('a help article opens in the app: from the help centre data, else fetched', async () => {
    const fetchArticle = jest.fn(() => Promise.resolve({ _id: 'zz', title: 'Fetched' }));
    const { w } = setup({ fetchArticle });
    await act(async () => {
      await w().openArticle('a1');
    });
    expect(w().article).toMatchObject({ title: 'Downloading invoices' });
    expect(fetchArticle).not.toHaveBeenCalled();
    act(() => w().closeArticle());
    expect(w().article).toBeNull();
    await act(async () => {
      await w().openArticle('zz');
    });
    expect(fetchArticle).toHaveBeenCalledWith('zz');
    expect(w().article).toMatchObject({ title: 'Fetched' });
  });

  it('the chat ending before 6s: no card, no games', () => {
    const { socket, escalate, tick, w } = setup();
    escalate();
    act(() => socket.fire('chat-ended', { chatSessionId: 's1' }));
    tick(30000);
    expect(w().helpCard).toBeNull();
    expect(w().gamesCard).toBeNull();
  });

  it('a new conversation: the cards go', () => {
    const { escalate, tick, w } = setup();
    escalate();
    tick(22500);
    expect(w().helpCard).not.toBeNull();
    expect(w().gamesCard).not.toBeNull();
    act(() => w().resetWaiting());
    expect(w().helpCard).toBeNull();
    expect(w().gamesCard).toBeNull();
  });
});
