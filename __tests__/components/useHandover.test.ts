/**
 * The standalone useHandover hook sends only events the embed-server
 * handles (#58): initiate-handover, queue-self-resolve, visitor-typing,
 * submit-chat-rating - never handover:*.
 */
import { renderHook, act } from '@testing-library/react-native';
import { useHandover } from '../../src/components/Handover/useHandover';
import { buildStandaloneHandoverPayload } from '../../src/core/handoverPayload';

const fakeSocket = () => ({ emitToServer: jest.fn(), on: jest.fn(), off: jest.fn() });

const setup = (extra: any = {}) => {
  const socket = fakeSocket();
  const hook = renderHook(() =>
    useHandover({
      socketClient: socket,
      sessionId: 's1',
      botId: 'b1',
      workspaceId: 'w1',
      nodeId: 'n1',
      surveyConfig: { enabled: true, ratingStyle: 'stars' } as any,
      ...extra,
    })
  );
  return { socket, hook, events: () => socket.emitToServer.mock.calls.map((c: any[]) => c[0]) };
};

describe('useHandover (server events)', () => {
  it('asks for a person with initiate-handover', () => {
    const { socket, hook, events } = setup();
    act(() => hook.result.current.submitPreChat({ name: 'Jo' } as any, 'sales'));
    expect(events()).toEqual(['initiate-handover']);
    const payload = socket.emitToServer.mock.calls[0][1];
    expect(payload.chatSessionId).toBe('s1');
    expect(payload.chatMetaData.botId).toBe('b1');
    expect(payload.chatMetaData.chatSessionId).toBe('s1');
    expect(payload.chatMetaData.visitorInfo).toEqual({ name: 'Jo' });
    expect(payload.department).toBe('sales');
    expect(payload.maxWaitTime).toBe(5);
    act(() => hook.result.current.reset());
  });

  it('cancel and end chat while waiting leave the queue', () => {
    const { socket, hook, events } = setup();
    act(() => hook.result.current.cancel());
    act(() => hook.result.current.endChat());
    expect(events()).toEqual(['queue-self-resolve', 'queue-self-resolve']);
    expect(socket.emitToServer.mock.calls[0][1]).toEqual({ chatSessionId: 's1' });
  });

  it('typing is visitor-typing; the survey is submit-chat-rating; sendMessage sends nothing', () => {
    const { socket, hook, events } = setup();
    act(() => hook.result.current.setTyping(true));
    act(() => hook.result.current.submitSurvey({ rating: 5, feedback: 'great', timestamp: 'x' }));
    act(() => hook.result.current.sendMessage('hi'));
    expect(events()).toEqual(['visitor-typing', 'submit-chat-rating']);
    expect(socket.emitToServer.mock.calls[0][1]).toEqual({ chatSessionId: 's1', isTyping: true });
    expect(socket.emitToServer.mock.calls[1][1]).toEqual({ chatSessionId: 's1', source: 'post_chat_survey', csatScore: 5, feedback: 'great' });
  });
});

describe('buildStandaloneHandoverPayload', () => {
  it('has the fields initiate-handover reads', () => {
    const p = buildStandaloneHandoverPayload({ sessionId: 's', botId: 'b', now: new Date('2026-10-15T00:00:00Z') });
    expect(p).toMatchObject({
      workspaceId: '',
      chatbotId: 'b',
      chatSessionId: 's',
      priority: 'normal',
      maxWaitTime: 2,
      assignedAIAgents: [],
      chatMetaData: { botId: 'b', chatSessionId: 's', chatDate: '2026-10-15T00:00:00.000Z', record: [] },
      metaData: { visitorId: 's' },
    });
    expect('department' in p).toBe(false);
  });
});
