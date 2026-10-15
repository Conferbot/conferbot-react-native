/**
 * useHandoverLifecycle against a fake socket and record: the Connecting
 * line and its outcomes, the waiting signals, leaving the queue, and a
 * restored chat picked back up from live-chat-state.
 */
import { renderHook, act } from '@testing-library/react-native';
import { useHandoverLifecycle } from '../../src/context/hooks/useHandoverLifecycle';

const fakeSocket = (ack: Record<string, any> = {}) => {
  const handlers: Record<string, (d: any) => void> = {};
  return {
    handlers,
    chatSessionId: 's1',
    on: jest.fn((event: string, fn: any) => {
      handlers[event] = fn;
    }),
    emitWithAck: jest.fn((event: string) => Promise.resolve(ack[event] ?? null)),
    joinChatRoomVisitor: jest.fn(),
    fire(event: string, data?: any) {
      handlers[event]?.(data);
    },
  };
};

const fakeState = (initial: any[] = [], currentNodeId: string | null = null) => {
  let rec = [...initial];
  return {
    sessionId: 's1',
    currentNodeId,
    getRecord: () => rec,
    setRecord: jest.fn((r: any[]) => (rec = r)),
    addRecord: jest.fn((r: any) => rec.push(r)),
  };
};

const setup = (o: { record?: any[]; ack?: any; state?: any; engine?: any; waitingForPerson?: boolean } = {}) => {
  const socket = fakeSocket(o.ack);
  const state = o.state || fakeState(o.record);
  let screen: any[] = o.record || [];
  const setRecord = jest.fn((u: any) => {
    screen = typeof u === 'function' ? u(screen) : u;
  });
  const props = {
    socketClient: { current: socket as any },
    chatStateRef: { current: state as any },
    flowEngine: { current: o.engine || null },
    record: screen,
    setRecord,
    isOpen: true,
    setIsLiveChatMode: jest.fn(),
    setCurrentAgent: jest.fn(),
    setCurrentUIState: jest.fn(),
    setIsNodeProcessing: jest.fn(),
    waitingForPerson: !!o.waitingForPerson,
  };
  const hook = renderHook((p: any) => useHandoverLifecycle(p), { initialProps: props });
  act(() => hook.result.current.setupHandoverListeners());
  return { hook, socket, state, props, screen: () => screen };
};

describe('useHandoverLifecycle', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('an AI escalating draws one Connecting line; an idle pause draws nothing (#28)', () => {
    const { hook, screen } = setup();
    let kind: any;
    act(() => {
      kind = hook.result.current.onAgentLeft({ reason: 'visitor_inactive', agentDetails: { name: 'Ava', isAIAgent: true } });
    });
    expect(kind).toBe('ignore');
    expect(screen()).toHaveLength(0);
    act(() => {
      hook.result.current.onAgentLeft({ reason: 'escalated', agentDetails: { name: 'Ava', isAIAgent: true } });
      hook.result.current.onAgentLeft({ reason: 'escalated', agentDetails: { name: 'Ava', isAIAgent: true } });
    });
    expect(screen()).toHaveLength(1);
    expect(screen()[0]).toMatchObject({ type: 'agent-left-chat', handover: true, text: 'Connecting you with the team…' });
    act(() => {
      hook.result.current.onAgentLeft({ agentDetails: { name: 'Sam' } });
    });
    expect(screen()[1]).toMatchObject({ type: 'agent-left-chat', text: 'Sam left the chat' });
  });

  it('a person joining settles the line, says cb:human-joined, and no 20s signal fires (#31)', () => {
    const { hook, screen } = setup();
    const got: string[] = [];
    act(() => {
      hook.result.current.onWidgetSignal('cb:waiting-for-human', () => got.push('waiting'));
      hook.result.current.onWidgetSignal('cb:human-joined', (d: any) => got.push(`joined:${d.name}`));
      hook.result.current.onAgentLeft({ reason: 'escalated', agentDetails: { name: 'Ava', isAIAgent: true } });
    });
    let plan: any;
    act(() => {
      plan = hook.result.current.onAccepted({ agentDetails: { _id: 'u1', name: 'Sam' } });
      hook.result.current.addJoin({ _id: 'u1', name: 'Sam' }, plan);
    });
    expect(screen()[0]).toMatchObject({ settled: 'joined', text: 'Connected with the team' });
    expect(screen()[1]).toMatchObject({ type: 'agent-joined-message', text: 'Sam joined the chat', afterAI: true, agentId: 'u1' });
    act(() => jest.advanceTimersByTime(30000));
    expect(got).toEqual(['joined:Sam']);
  });

  it('nobody joins in 20s: cb:waiting-for-human once; the server\'s handover-waiting settles unavailable', () => {
    const { hook, socket, screen } = setup();
    const got: any[] = [];
    act(() => {
      hook.result.current.onWidgetSignal('cb:waiting-for-human', (d) => got.push(d));
      hook.result.current.onAgentLeft({ reason: 'escalated', agentDetails: { name: 'Ava', isAIAgent: true } });
    });
    act(() => jest.advanceTimersByTime(20000));
    expect(got).toEqual([{ offline: false, reason: 'busy', backAt: null, emailCaptured: false }]);
    act(() => socket.fire('handover-waiting', { chatSessionId: 's1', reason: 'offline' }));
    expect(got[1]).toMatchObject({ reason: 'offline' });
    expect(screen()[0]).toMatchObject({ settled: 'unavailable', text: "The team couldn't join just now" });
  });

  it('chat ended first: the line says so and cb:wait-over ended', () => {
    const { hook, socket, screen } = setup();
    const over: any[] = [];
    act(() => {
      hook.result.current.onWidgetSignal('cb:wait-over', (d) => over.push(d));
      hook.result.current.onAgentLeft({ reason: 'escalated', agentDetails: { isAIAgent: true } });
    });
    act(() => socket.fire('chat-ended', { chatSessionId: 's1' }));
    expect(screen()[0]).toMatchObject({ settled: 'ended', text: 'Chat ended before the team joined' });
    expect(over).toEqual([{ reason: 'ended' }]);
  });

  it('leaving the queue sends queue-self-resolve, then the flow moves on (#58)', async () => {
    const engine = { isAtHandover: () => true, submitResponse: jest.fn(), handoverNodeData: () => ({}) };
    const { hook, socket, screen, state } = setup({ ack: { 'queue-self-resolve': { ok: true } }, engine });
    let left: any;
    await act(async () => {
      left = await hook.result.current.leaveQueue();
    });
    expect(left).toBe(true);
    expect(socket.emitWithAck).toHaveBeenCalledWith('queue-self-resolve', { chatSessionId: 's1' }, 8000);
    expect(screen()[0]).toMatchObject({ type: 'queue-self-resolved', text: 'You left the queue' });
    expect(state.addRecord).toHaveBeenCalledWith(expect.objectContaining({ type: 'queue-self-resolved' }));
    expect(engine.submitResponse).toHaveBeenCalledWith({ action: 'cancel', queueLeft: true });
  });

  it('the answer and queue-left for the same Cancel: "You left the queue" once (#65)', async () => {
    const engine = { isAtHandover: () => true, submitResponse: jest.fn(), handoverNodeData: () => ({}) };
    const { hook, socket, screen, state } = setup({ ack: { 'queue-self-resolve': { ok: true } }, engine, waitingForPerson: true });
    // queue-left first (it can beat the answer), then the answer, then queue-left again
    act(() => socket.fire('queue-left', { chatSessionId: 's1', reason: 'self_service' }));
    await act(async () => {
      await hook.result.current.leaveQueue();
    });
    act(() => socket.fire('queue-left', { chatSessionId: 's1', reason: 'self_service' }));
    expect(screen().filter((m: any) => m.type === 'queue-self-resolved')).toHaveLength(1);
    expect(state.addRecord.mock.calls.filter(([r]: any[]) => r.type === 'queue-self-resolved')).toHaveLength(1);
    expect(engine.submitResponse).toHaveBeenCalledTimes(1);
  });

  it('a person accepted just before: not_waiting, live-chat-state live, the visitor stays', async () => {
    const engine = { isAtHandover: () => true, submitResponse: jest.fn(), handoverNodeData: () => ({}) };
    const { hook, socket } = setup({
      ack: { 'queue-self-resolve': { ok: false, reason: 'not_waiting' }, 'live-chat-state': { status: 'live', agentDetails: { _id: 'u1' } } },
      engine,
    });
    let left: any;
    await act(async () => {
      left = await hook.result.current.leaveQueue();
    });
    expect(left).toBe(false);
    expect(socket.emitWithAck).toHaveBeenCalledWith('live-chat-state', { chatSessionId: 's1' }, 8000);
    expect(engine.submitResponse).not.toHaveBeenCalled();
  });

  it('a person already has it: the visitor stays', async () => {
    const engine = { isAtHandover: () => true, submitResponse: jest.fn(), handoverNodeData: () => ({}) };
    const { hook } = setup({ ack: { 'queue-self-resolve': { ok: false, reason: 'agent_joined' } }, engine });
    let left: any;
    await act(async () => {
      left = await hook.result.current.leaveQueue();
    });
    expect(left).toBe(false);
    expect(engine.submitResponse).not.toHaveBeenCalled();
  });

  it('restart: a live chat comes back live with its agent, the flow is not run again (#29)', async () => {
    const record = [
      { _id: 'b1', type: 'bot-message', text: 'Hi' },
      { _id: 'l1', type: 'agent-left-chat', handover: true, text: 'Connecting you with the team…' },
    ];
    const { hook, socket, props, screen } = setup({
      record,
      ack: { 'live-chat-state': { status: 'live', agentDetails: { _id: 'u1', name: 'Sam' } } },
    });
    let step: any;
    await act(async () => {
      step = await hook.result.current.resumeRestored({ sessionId: 's1', nodes: [], agentBot: true });
    });
    expect(step).toBe('live');
    expect(socket.joinChatRoomVisitor).toHaveBeenCalledWith('s1');
    expect(socket.emitWithAck).toHaveBeenCalledWith('live-chat-state', { chatSessionId: 's1' }, 10000);
    expect(props.setIsLiveChatMode).toHaveBeenCalledWith(true);
    expect(props.setCurrentAgent).toHaveBeenCalledWith(expect.objectContaining({ id: 'u1', name: 'Sam', isAIAgent: false }));
    expect(screen()[1]).toMatchObject({ settled: 'joined' });
    expect(screen()[2]).toMatchObject({ type: 'agent-joined-message', name: 'Sam', afterAI: true });
  });

  it('restart while still in the queue: back on the handover step, not asked again', async () => {
    const engine = { waitAt: jest.fn(() => true), submitResponse: jest.fn(), resumeFrom: jest.fn(), handoverNodeData: () => ({}) };
    const state = fakeState([{ _id: 'b1', type: 'bot-message' }], 'h1');
    const { hook } = setup({ state, engine, record: [{ _id: 'b1', type: 'bot-message' }], ack: { 'live-chat-state': { status: 'waiting', waitEndsAt: Date.now() + 60000 } } });
    let step: any;
    await act(async () => {
      step = await hook.result.current.resumeRestored({ sessionId: 's1', nodes: [{ id: 'h1', type: 'human-handover-node' }], agentBot: false });
    });
    expect(step).toBe('wait');
    expect(engine.waitAt).toHaveBeenCalledWith('h1', expect.objectContaining({ type: 'humanHandover', stage: 'waiting' }));
    expect(engine.resumeFrom).not.toHaveBeenCalled();
  });

  it('a restored chat with nothing live is not asked about', async () => {
    const { hook, socket } = setup({ record: [{ _id: 'b1', type: 'bot-message' }] });
    let step: any;
    await act(async () => {
      step = await hook.result.current.resumeRestored({ sessionId: 's1', nodes: [], agentBot: false });
    });
    expect(step).toBe('start');
    expect(socket.emitWithAck).not.toHaveBeenCalled();
  });
});
