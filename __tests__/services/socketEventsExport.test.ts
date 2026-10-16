/**
 * SocketEvents is a value at the package root (#82): on(SocketEvents.BOT_RESPONSE, ...).
 */
// The components barrel does not load under ts-jest's isolatedModules; the root's own export is what is checked.
jest.mock('../../src/components', () => ({}));

// eslint-disable-next-line import/first
import { SocketEvents } from '../../src';

describe('SocketEvents export', () => {
  it('is the runtime enum of the socket event names', () => {
    expect(SocketEvents.BOT_RESPONSE).toBe('bot-response');
    expect(SocketEvents.AGENT_MESSAGE).toBe('agent-message');
    expect(SocketEvents.FETCHED_CHATBOT_DATA).toBe('fetched-chatbot-data');
  });
});
