/**
 * The bot's messages reach the screen on every path that starts the flow,
 * a restored conversation included (it used to show none after a restore).
 */
import { renderHook, act } from '@testing-library/react-native';
import { useFlowEngine } from '../../src/context/hooks/useFlowEngine';

const setup = () => {
  const setRecord = jest.fn();
  const chatStateRef = { current: null as any };
  const hook = renderHook(() =>
    useFlowEngine({
      botId: 'bot-1',
      socketClient: { current: { isConnected: () => true, getUserId: () => 'u1', emit: jest.fn(), on: jest.fn(), off: jest.fn() } as any },
      storageService: { current: null },
      flowEngine: { current: null },
      chatStateRef,
      setRecord,
      persistAnswerVariables: jest.fn().mockResolvedValue(undefined),
      persistFlowState: jest.fn().mockResolvedValue(undefined),
    } as any)
  );
  return { hook, setRecord, chatStateRef };
};

const shown = (setRecord: jest.Mock) =>
  setRecord.mock.calls.flatMap(([update]) => (typeof update === 'function' ? update([]) : update)).map((r: any) => r.text);

describe('useFlowEngine', () => {
  it('shows bot messages in a new conversation', () => {
    const { hook, setRecord, chatStateRef } = setup();
    act(() => hook.result.current.initializeFlowEngine('s1'));
    act(() => chatStateRef.current.addBotMessage('Hello there', 'n1', 'message-node'));
    expect(shown(setRecord)).toContain('Hello there');
  });

  it('shows bot messages in a restored conversation', () => {
    const { hook, setRecord, chatStateRef } = setup();
    const persisted = {
      session: { chatSessionId: 's1', currentNodeId: 'n2', visitedNodes: ['n1'] },
      answerVariables: { variables: [] },
      messages: [{ _id: 'm1', type: 'bot-message', text: 'Earlier' }],
    };
    act(() => hook.result.current.initializeFlowEngine('s1', persisted as any));
    act(() => chatStateRef.current.addBotMessage('Connecting you now', 'n3', 'message-node'));
    expect(shown(setRecord)).toEqual(['Connecting you now']);
  });
});
