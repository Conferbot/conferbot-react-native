/**
 * The bot's messages reach the screen on every path that starts the flow,
 * a restored conversation included (it used to show none after a restore).
 */
import { renderHook, act } from '@testing-library/react-native';
import { useFlowEngine } from '../../src/context/hooks/useFlowEngine';

const setup = () => {
  const setRecord = jest.fn();
  const chatStateRef = { current: null as any };
  const flowEngine = { current: null as any };
  const hook = renderHook(() =>
    useFlowEngine({
      botId: 'bot-1',
      socketClient: { current: { isConnected: () => true, getUserId: () => 'u1', emit: jest.fn(), on: jest.fn(), off: jest.fn() } as any },
      storageService: { current: null },
      flowEngine,
      chatStateRef,
      setRecord,
      persistAnswerVariables: jest.fn().mockResolvedValue(undefined),
      persistFlowState: jest.fn().mockResolvedValue(undefined),
    } as any)
  );
  return { hook, setRecord, chatStateRef, flowEngine };
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

  const rows = (setRecord: jest.Mock) => setRecord.mock.calls.flatMap(([update]) => (typeof update === 'function' ? update([]) : update));
  const settle = async () => {
    for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0));
  };
  const node = (id: string, type: string, data: any = {}) => ({ id, type, data, position: { x: 0, y: 0 } });

  it('marks each bot bubble with its step, and the visitor\'s answer with what it answered', async () => {
    jest.useRealTimers();
    const { hook, setRecord, flowEngine } = setup();
    act(() => hook.result.current.initializeFlowEngine('s1'));
    const engine = flowEngine.current;
    (engine as any).config.typingDelay = 0;
    engine.loadFlow({
      nodes: [
        node('w', 'welcome-node', { text: '<p>Hi</p>', disableImage: true }),
        node('r', 'rating-choice-node', { questionText: '<p>Rate us</p>', ratingType: 5 }),
        node('m', 'message-node', { text: '<p>Thanks</p>' }),
      ],
      edges: [
        { id: 'a', source: 'w', target: 'r', sourceHandle: 'source' },
        { id: 'b', source: 'r', target: 'm', sourceHandle: 'source-4' },
      ],
    });
    await act(async () => {
      await engine.start();
      await settle();
    });
    expect(rows(setRecord).find((r: any) => r.text === 'Rate us')).toMatchObject({ nodeId: 'r' });
    await act(async () => {
      hook.result.current.submitNodeResponse({ rating: 5, maxRating: 5 });
      await settle();
    });
    // The rating card took the answer: the step's own words are the visitor's bubble.
    const answer = rows(setRecord).find((r: any) => r.type === 'user-message');
    expect(answer).toMatchObject({ text: '⭐⭐⭐⭐⭐', answerOf: { nodeId: 'r', type: 'rating-choice-node', text: '5/5' } });
  });

  it('shows the conversation again from a question gone back to', () => {
    const { hook, setRecord, chatStateRef } = setup();
    act(() => hook.result.current.initializeFlowEngine('s1'));
    const state = chatStateRef.current;
    const snap = JSON.parse(JSON.stringify(state.toJSON()));
    act(() => state.addBotMessage('First', 'n1', 'message-node'));
    act(() => state.restore(snap));
    setRecord.mockClear();
    act(() => state.addBotMessage('Asked again', 'n1', 'message-node'));
    expect(shown(setRecord)).toEqual(['Asked again']);
  });
});
