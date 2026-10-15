import { ChatState } from '../../src/core/state/ChatState';

describe('the app user travels with every record', () => {
  afterEach(() => {
    ChatState.visitorContext = null;
  });

  it('adds visitorContext, name and email (identity verification hash included)', () => {
    ChatState.visitorContext = { plan: 'pro', id: 'u-1', name: 'Ada', email: 'ada@example.com', hash: 'abc123' };
    const data = new ChatState('s-1', 'b-1').buildResponseData();
    expect(data.visitorContext).toEqual({ plan: 'pro', id: 'u-1', name: 'Ada', email: 'ada@example.com', hash: 'abc123' });
    expect(data.visitorName).toBe('Ada');
    expect(data.visitorEmail).toBe('ada@example.com');
    expect(data.chatSessionId).toBe('s-1');
  });

  it('sends none without a user', () => {
    const data = new ChatState('s-1', 'b-1').buildResponseData();
    expect(data.visitorContext).toBeUndefined();
    expect(data.visitorName).toBeUndefined();
  });
});
