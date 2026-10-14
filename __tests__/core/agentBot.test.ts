import {
  parseAgentBot,
  agentDetailsOf,
  isAIAgentDetails,
  agentShellNodes,
  agentHandoverData,
  isAgentAIActive,
  normalizeAgentSources,
  answerActionsOf,
  answerCardOf,
  resultCardOf,
  actionRequestOf,
  followUpsOf,
  safeRich,
  quickActionsOf,
  aiReplyExtrasOf,
  conversionEventOf,
} from '../../src/core/agentBot';
import { buildHandoverPayload } from '../../src/core/handoverPayload';
import { ChatState } from '../../src/core/state/ChatState';

describe('agent bots', () => {
  it('reads agentBot only when it is well formed', () => {
    expect(parseAgentBot({})).toBeNull();
    expect(parseAgentBot({ agentBot: null })).toBeNull();
    expect(parseAgentBot({ agentBot: { displayName: 'x' } })).toBeNull();
    const bot = parseAgentBot({
      name: 'Shop',
      agentBot: { agentId: 'a1', greeting: ' Hi there ', starters: ['Pricing?', 'pricing?', '', { text: 'Refunds' }], avatar: 'https://x/a.png' },
    });
    expect(bot).toEqual({ agentId: 'a1', displayName: 'Shop', greeting: 'Hi there', starters: ['Pricing?', 'Refunds'], avatar: 'https://x/a.png' });
  });

  it('presents the agent as the server does', () => {
    const d = agentDetailsOf({ agentId: 'a1', displayName: 'Ava', greeting: '', starters: [], avatar: null });
    expect(d).toEqual({ _id: 'ai-agent-a1', name: 'Ava', avatar: '', isAIAgent: true });
    expect(isAIAgentDetails(d)).toBe(true);
    expect(isAIAgentDetails({ _id: 'ai-agent-x' })).toBe(true);
    expect(isAIAgentDetails({ _id: '64f0', name: 'Sam' })).toBe(false);
  });

  it('uses only the handover assigned to this agent, never a form before it', () => {
    const nodes = [
      { id: 'w', type: 'welcome-node', data: { text: 'old' } },
      { id: 'h1', type: 'human-handover-node', data: { assignedAIAgents: ['other'], enablePreChatQuestions: true } },
      { id: 'h2', type: 'human-handover-node', data: { assignedAIAgents: ['a1'], enablePreChatQuestions: true, preChatQuestions: [1], handoverMessage: 'wait', priority: 'high' } },
    ];
    const { welcome, handover } = agentShellNodes(nodes, 'a1');
    expect(welcome?.id).toBe('w');
    expect(handover?.id).toBe('h2');
    expect(agentShellNodes([nodes[0], nodes[1]], 'a1')).toEqual({ welcome: null, handover: null });
    const data = agentHandoverData(handover?.data, 'a1');
    expect(data).toMatchObject({ assignedAIAgents: ['a1'], handoverMessage: '', enablePreChatQuestions: false, preChatQuestions: [], priority: 'high' });
  });

  it('knows when the AI is still answering', () => {
    expect(isAgentAIActive([])).toBe(true);
    expect(isAgentAIActive([{ type: 'agent-left-chat' }])).toBe(false);
    expect(isAgentAIActive([{ type: 'ai-agent-inactive-close' }, { type: 'ai-agent-resumed' }])).toBe(true);
    expect(isAgentAIActive([{ type: 'ai-agent-resumed' }, { type: 'agent-chat-ended' }])).toBe(false);
  });

  it('cleans sources, buttons and cards like the web widget', () => {
    expect(
      normalizeAgentSources([
        { title: 'Pricing', url: 'https://www.acme.com/pricing' },
        { title: 'dup', url: 'https://www.acme.com/pricing' },
        { title: 'bad', url: 'javascript:alert(1)' },
        { title: 'Refunds', articleId: '0123456789abcdef01234567' },
        { url: 'https://acme.com/a' },
        { url: 'https://acme.com/b' },
      ])
    ).toEqual([
      { title: 'Pricing', url: 'https://www.acme.com/pricing' },
      { title: 'Refunds', articleId: '0123456789abcdef01234567' },
      { title: 'acme.com', url: 'https://acme.com/a' },
    ]);
    expect(answerActionsOf([{ label: 'See pricing', url: 'https://a.co/p' }, { label: 'x', url: 'ftp://a' }, { label: 'Again', url: 'https://a.co/p' }])).toEqual([
      { label: 'See pricing', url: 'https://a.co/p' },
    ]);
    expect(answerCardOf({ rows: [['Pro', '$49']] })).toBeNull();
    expect(answerCardOf({ title: 'Plans', rows: [['Pro', '$49'], ['Team', '$99']], url: 'http://insecure' })).toEqual({
      title: 'Plans', rows: [['Pro', '$49'], ['Team', '$99']], note: null, url: null,
    });
    expect(resultCardOf({ title: 'Order', status: 'In transit', tone: 'weird', link: { url: 'https://t.co/1' } })).toEqual({
      title: 'Order', status: 'In transit', tone: 'neutral', rows: [], link: { url: 'https://t.co/1', label: 'Open' },
    });
    expect(actionRequestOf({ token: 't', name: 'Cancel order', summary: [{ label: 'Order', value: 1042 }, { nope: 1 }] })).toEqual({
      token: 't', name: 'Cancel order', summary: [{ label: 'Order', value: '1042' }],
    });
    expect(actionRequestOf({ name: 'x' })).toBeNull();
    expect(followUpsOf(['a', '', 3, 'b', 'c', 'd'])).toEqual(['a', 'b', 'c']);
  });

  it('keeps only drawable rich messages', () => {
    expect(safeRich({ kind: 'quick_replies', options: ['Yes'] })).toBeNull();
    expect(safeRich({ kind: 'quick_replies', text: 'Pick', options: ['Yes', 'No'] })).toEqual({ kind: 'quick_replies', text: 'Pick', options: ['Yes', 'No'] });
    expect(safeRich({ kind: 'card', title: 'Pro', imageUrl: 'http://x', button: { label: 'Buy', url: 'https://b' } })).toMatchObject({ imageUrl: null, button: { label: 'Buy', url: 'https://b' } });
    expect(safeRich({ kind: 'video' })).toBeNull();
  });

  it('quick actions and goals', () => {
    expect(quickActionsOf({ chatQuickActions: [{ label: 'Book a demo', url: 'https://cal.com/x' }, { label: 'Mail', url: 'mailto:a@b.co' }, { label: 'x', url: 'javascript:1' }] })).toEqual([
      { label: 'Book a demo', url: 'https://cal.com/x' },
      { label: 'Mail', url: 'mailto:a@b.co' },
    ]);
    expect(conversionEventOf('Book a demo')).toBe('demo_booked');
    expect(conversionEventOf('Start free trial')).toBe('signup');
  });

  it('adds extras only to AI replies, and nothing but sources to a fallback', () => {
    expect(aiReplyExtrasOf({ agentDetails: { _id: 'u1', name: 'Sam' }, sources: [{ url: 'https://a.co' }] })).toEqual({});
    const ai = { _id: 'ai-agent-a1', isAIAgent: true };
    expect(aiReplyExtrasOf({ agentDetails: ai, isFallback: true, actions: [{ label: 'x', url: 'https://a.co' }] })).toEqual({ isFallback: true });
    expect(aiReplyExtrasOf({ agentDetails: ai, actions: [{ label: 'Go', url: 'https://a.co' }] })).toEqual({ actions: [{ label: 'Go', url: 'https://a.co' }], isAIReply: true });
  });

  it('builds the initiate-handover payload with a silent start', () => {
    const state = new ChatState('s1', 'b1');
    state.setVariable('_workspaceId', 'w1');
    state.setVariable('_visitorId', 'v1');
    const p = buildHandoverPayload(state, agentHandoverData(null, 'a1'), { silentStart: true });
    expect(p).toMatchObject({
      workspaceId: 'w1', chatbotId: 'b1', chatSessionId: 's1', assignedAIAgents: ['a1'], assignmentType: 'auto',
      priority: 'normal', maxWaitTime: 2, silentStart: true, metaData: { visitorId: 'v1' },
    });
    expect(p.chatMetaData).toMatchObject({ version: 'v2', botId: 'b1', chatSessionId: 's1' });
  });

  it('sends the handover wait time as the builder wrote it', () => {
    const state = new ChatState('s1', 'b1');
    const wait = (v: unknown) => buildHandoverPayload(state, { maxWaitTime: v } as any).maxWaitTime;
    expect(wait('0.5')).toBe(0.5);
    expect(wait(3)).toBe(3);
    expect(wait(undefined)).toBe(2);
    expect(wait('soon')).toBe(2);
  });
});
