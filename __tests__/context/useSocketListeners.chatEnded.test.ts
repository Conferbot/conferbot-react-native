/**
 * chat-ended in useSocketListeners (#66): a flow waiting on its handover
 * step carries on from it (the step's post-chat survey, else its next
 * edge), as the web's agentListeners.ts onChatEnded does; it is not reset.
 * With no flow at a handover step the chat is over as before.
 */
import { renderHook, act } from '@testing-library/react-native';
import { useSocketListeners } from '../../src/context/hooks/useSocketListeners';

const setup = (engine: any) => {
  const handlers: Record<string, (d: any) => void> = {};
  const socket: any = { chatSessionId: 's1', on: (e: string, fn: any) => (handlers[e] = fn) };
  let rec: any[] = [];
  const state: any = { getRecord: () => rec, addRecord: jest.fn((r: any) => rec.push(r)) };
  const fns = {
    setCurrentUIState: jest.fn(),
    setIsNodeProcessing: jest.fn(),
    setIsLiveChatMode: jest.fn(),
    persistSession: jest.fn(async () => {}),
  };
  const noop = jest.fn();
  const props: any = {
    socketClient: { current: socket },
    flowEngine: { current: engine },
    chatStateRef: { current: state },
    workspaceIdRef: { current: null },
    chatSessionId: 's1',
    isOpen: true,
    setRecord: noop,
    setChatSessionId: noop,
    setCurrentAgent: noop,
    setAgentTyping: noop,
    setIsConnected: noop,
    setUnreadCount: noop,
    setServerCustomizations: noop,
    setReactions: noop,
    persistMessages: jest.fn(async () => {}),
    initializeFlowEngine: noop,
    lastUserChoiceRef: { current: null },
    setAgentBot: noop,
    onChatbotData: noop,
    onAgentBotReady: noop,
    onAgentAccepted: () => true,
    onAgentMessage: () => ({}),
    setupAgentListeners: noop,
    handover: { onAgentLeft: noop, recordRef: { current: [] } },
    ...fns,
  };
  const hook = renderHook(() => useSocketListeners(props));
  act(() => hook.result.current.setupSocketListeners());
  return { fire: (e: string, d?: any) => act(() => handlers[e]?.(d)), state, fns };
};

describe('chat-ended with a flow at its handover step (#66)', () => {
  it('carries the flow on from the handover step, not reset', () => {
    const engine = {
      isAtHandover: () => true,
      getState: () => ({ isWaitingForInput: true }),
      submitResponse: jest.fn(() => Promise.resolve()),
      reset: jest.fn(),
    };
    const { fire, state, fns } = setup(engine);
    fire('chat-ended', { chatSessionId: 's1' });
    expect(engine.submitResponse).toHaveBeenCalledWith({ action: 'chatEnded' });
    expect(engine.reset).not.toHaveBeenCalled();
    expect(fns.setCurrentUIState).not.toHaveBeenCalledWith(null);
    expect(state.addRecord).toHaveBeenCalledWith(expect.objectContaining({ type: 'agent-chat-ended' }));
    expect(fns.setIsLiveChatMode).toHaveBeenCalledWith(false);

    // The same end again: nothing more (one survey per end, #47).
    fire('chat-ended', { chatSessionId: 's1' });
    expect(engine.submitResponse).toHaveBeenCalledTimes(1);
  });

  it('no flow at a handover step: the chat is over as before', () => {
    const engine = {
      isAtHandover: () => false,
      getState: () => ({ isWaitingForInput: false }),
      submitResponse: jest.fn(),
      reset: jest.fn(),
    };
    const { fire, fns } = setup(engine);
    fire('chat-ended', { chatSessionId: 's1' });
    expect(engine.submitResponse).not.toHaveBeenCalled();
    expect(engine.reset).toHaveBeenCalled();
    expect(fns.setCurrentUIState).toHaveBeenCalledWith(null);
  });

  it('another session\'s end is ignored', () => {
    const engine = { isAtHandover: () => true, getState: () => ({ isWaitingForInput: true }), submitResponse: jest.fn(), reset: jest.fn() };
    const { fire } = setup(engine);
    fire('chat-ended', { chatSessionId: 'other' });
    expect(engine.submitResponse).not.toHaveBeenCalled();
    expect(engine.reset).not.toHaveBeenCalled();
  });
});
