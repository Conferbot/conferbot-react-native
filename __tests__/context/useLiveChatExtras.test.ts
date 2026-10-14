/**
 * useLiveChatExtras against a fake socket: the server's live chat events,
 * the visitor's receipts, and what the cards send.
 */
import { renderHook, act } from '@testing-library/react-native';
import { useLiveChatExtras } from '../../src/context/hooks/useLiveChatExtras';

const fakeSocket = () => {
  const handlers: Record<string, (d: any) => void> = {};
  return {
    handlers,
    chatSessionId: 's1',
    on: jest.fn((event: string, fn: any) => {
      handlers[event] = fn;
    }),
    isConnected: () => true,
    emitWithAck: jest.fn().mockResolvedValue({ ok: true }),
    emitToServer: jest.fn(),
    sendResponseRecord: jest.fn(),
    fire(event: string, data?: any) {
      handlers[event]?.(data);
    },
  };
};

const fakeState = () => {
  const records: any[] = [];
  return {
    records,
    sessionId: 's1',
    addRecord: jest.fn((r: any) => records.push(r)),
    getVariable: jest.fn(() => 'v1'),
    setUserMetadata: jest.fn(),
    setAnswer: jest.fn(),
    buildResponseData: jest.fn(() => ({ record: records })),
  };
};

let continueFlow = jest.fn();
const setup = (overrides: any = {}) => {
  continueFlow = jest.fn();
  const socket = fakeSocket();
  const state = fakeState();
  const setRecord = jest.fn();
  const props = {
    socketClient: { current: socket as any },
    chatStateRef: { current: state as any },
    record: [] as any[],
    setRecord,
    isOpen: true,
    waitingForPerson: false,
    continueFlow,
    ...overrides,
  };
  const hook = renderHook((p: any) => useLiveChatExtras(p), { initialProps: props });
  act(() => hook.result.current.setupLiveChatListeners());
  return { hook, socket, state, setRecord, props };
};

describe('useLiveChatExtras', () => {
  it('follows the queue, and clears it when a person joins', () => {
    const { hook, socket } = setup();
    act(() => socket.fire('queue-status', { chatSessionId: 's1', status: 'waiting', position: 2 }));
    expect(hook.result.current.queue?.position).toBe(2);
    // Another chat's queue is not ours.
    act(() => socket.fire('queue-status', { chatSessionId: 'other', status: 'waiting', position: 7 }));
    expect(hook.result.current.queue?.position).toBe(2);
    act(() => socket.fire('agent-accepted', { agentDetails: { name: 'Sam' } }));
    expect(hook.result.current.queue).toBeNull();
  });

  it('asks for the queue position while waiting for a person', async () => {
    jest.useFakeTimers();
    const socket = fakeSocket();
    socket.emitWithAck.mockResolvedValue({ status: 'waiting', position: 1 });
    const hook = renderHook(() =>
      useLiveChatExtras({
        socketClient: { current: socket as any },
        chatStateRef: { current: fakeState() as any },
        record: [],
        setRecord: jest.fn(),
        isOpen: true,
        waitingForPerson: true,
      })
    );
    await act(async () => {});
    expect(socket.emitWithAck).toHaveBeenCalledWith('queue-status', { chatSessionId: 's1' }, 10000);
    expect(hook.result.current.queue?.position).toBe(1);
    await act(async () => {
      jest.advanceTimersByTime(20000);
    });
    expect(socket.emitWithAck).toHaveBeenCalledTimes(2);
    hook.unmount();
    jest.useRealTimers();
  });

  it('tracks locks, the composer switch, a dropped agent and a file request', () => {
    const { hook, socket, state } = setup();
    act(() => socket.fire('conversation-locked', { lockedByName: 'Ana' }));
    expect(hook.result.current.lockedBy).toBe('Ana');
    act(() => socket.fire('conversation-unlocked', {}));
    expect(hook.result.current.lockedBy).toBeNull();
    act(() => socket.fire('visitor-input-toggled', { isInputEnabled: false }));
    expect(hook.result.current.inputEnabled).toBe(false);
    act(() => socket.fire('agent-connection-lost', { agentName: 'Sam' }));
    expect(hook.result.current.agentLost).toBe('Sam');
    act(() => socket.fire('agent-connection-restored', {}));
    expect(hook.result.current.agentLost).toBeNull();
    act(() => socket.fire('file-upload-requested', { agentName: 'Sam' }));
    expect(hook.result.current.fileRequestedBy).toBe('Sam');
    expect(state.addRecord).toHaveBeenCalledWith(expect.objectContaining({ shape: 'agent-file-request', agentName: 'Sam' }));
  });

  it('opens the rating when the chat ends, and sends it', () => {
    const { hook, socket } = setup();
    act(() => hook.result.current.setChatbotData({ csatConfig: { enabled: true, ratingType: 'thumbs' } }));
    act(() => socket.fire('chat-ended', {}));
    expect(hook.result.current.csatOpen).toBe(true);
    act(() => hook.result.current.submitRating(true, 'thanks'));
    expect(socket.emitToServer).toHaveBeenCalledWith('submit-chat-rating', {
      chatSessionId: 's1',
      source: 'post_chat_survey',
      thumbsUp: true,
      feedback: 'thanks',
    });
    expect(hook.result.current.csatSent).toBe(true);
  });

  it('opens the lead card on buying intent and keeps the email', () => {
    const { hook, socket, state } = setup();
    act(() => socket.fire('agent-message', { agentDetails: { isAIAgent: true }, leadCard: true }));
    expect(hook.result.current.leadCardOpen).toBe(true);
    act(() => hook.result.current.captureLeadEmail('jo@example.com'));
    expect(state.setUserMetadata).toHaveBeenCalledWith({ email: 'jo@example.com' });
    expect(state.setAnswer).toHaveBeenCalledWith('lead-card', 'email', 'jo@example.com');
    expect(socket.sendResponseRecord).toHaveBeenCalled();
    expect(hook.result.current.leadCardOpen).toBe(false);
    expect(hook.result.current.leadEmail).toBe('jo@example.com');
  });

  it('leaves a message by email', async () => {
    const { hook, socket, state } = setup();
    act(() => socket.fire('no-agents-available'));
    expect(hook.result.current.noAgents).toBe(true);
    let ok = false;
    await act(async () => {
      ok = await hook.result.current.leaveMessage('jo@example.com', 'Need a quote');
    });
    expect(ok).toBe(true);
    expect(socket.emitWithAck).toHaveBeenCalledWith(
      'leave-message',
      expect.objectContaining({ chatSessionId: 's1', email: 'jo@example.com', message: 'Need a quote', visitorId: 'v1', entryId: expect.stringMatching(/^leave-message-/) })
    );
    expect(state.addRecord).toHaveBeenCalledWith(expect.objectContaining({ via: 'email', text: 'Need a quote' }));
    expect(hook.result.current.noAgents).toBe(false);
    expect(hook.result.current.leftMessageTo).toBe('jo@example.com');
    expect(continueFlow).toHaveBeenCalledTimes(1);
  });

  it('carries the flow on when leave a message is skipped', () => {
    const { hook, socket } = setup();
    act(() => socket.fire('no-agents-available'));
    act(() => hook.result.current.skipLeaveMessage());
    expect(hook.result.current.noAgents).toBe(false);
    expect(continueFlow).toHaveBeenCalledTimes(1);
  });

  it('records the visitor file as the web widget does', () => {
    const { hook, socket, state, setRecord } = setup();
    act(() => socket.fire('file-upload-requested', { agentName: 'Sam' }));
    act(() => hook.result.current.sendLiveFile('/media/abc', { name: 'id.png', type: 'image/png', size: 10 }));
    expect(state.addRecord).toHaveBeenLastCalledWith({ id: expect.stringMatching(/^user-file-/), shape: 'user-live-message-file', time: expect.any(String), url: '/media/abc' });
    expect(setRecord).toHaveBeenCalled();
    expect(socket.sendResponseRecord).toHaveBeenCalled();
    expect(hook.result.current.fileRequestedBy).toBeNull();
  });

  it('reports the agent message delivered and seen once each', () => {
    const { hook, socket, props } = setup();
    const record = [{ _id: 'a1', type: 'agent-message' }];
    hook.rerender({ ...props, record });
    expect(socket.emitToServer).toHaveBeenCalledWith('visitor-read-receipt', { chatSessionId: 's1', messageId: 'a1', state: 'delivered' });
    expect(socket.emitToServer).toHaveBeenCalledWith('visitor-read-receipt', { chatSessionId: 's1', messageId: 'a1', state: 'seen' });
    hook.rerender({ ...props, record: [...record] });
    expect(socket.emitToServer).toHaveBeenCalledTimes(2);
  });

  it('only reports delivered while the chat is closed', () => {
    const { hook, socket, props } = setup({ isOpen: false });
    hook.rerender({ ...props, isOpen: false, record: [{ _id: 'a1', type: 'agent-message' }] });
    expect(socket.emitToServer).toHaveBeenCalledTimes(1);
    expect(socket.emitToServer).toHaveBeenCalledWith('visitor-read-receipt', expect.objectContaining({ state: 'delivered' }));
  });
});
