/**
 * "Edit" on an answer (web index.ts _noteQuestionPoint / _rewindToQuestion,
 * ts/chat/delight/index.ts): the engine keeps a point for each question,
 * says what ran since, and goes back to it - the conversation's state as it
 * was, the question asked again.
 */
import { NodeFlowEngine } from '../../src/core/NodeFlowEngine';
import { ChatState } from '../../src/core/state/ChatState';
import { NodeHandlerRegistry, registerAllHandlers } from '../../src/core';
import { canChangeAnswer } from '../../src/core/delight';

const node = (id: string, type: string, data: any = {}) => ({ id, type, data, position: { x: 0, y: 0 } });
const edge = (source: string, target: string) => ({ id: `e-${source}-${target}`, source, target, sourceHandle: 'source' });

const flow = {
  nodes: [
    node('w', 'welcome-node', { text: '<p>Hi</p>', disableImage: true }),
    node('q1', 'ask-name-node', { questionText: '<p>Your name?</p>', answerVariable: 'name' }),
    node('m', 'message-node', { text: '<p>Thanks {name}</p>' }),
    node('q2', 'ask-email-node', { questionText: '<p>Your email?</p>', answerVariable: 'email' }),
    node('q3', 'ask-file-node', { questionText: '<p>A file?</p>' }),
  ],
  edges: [edge('w', 'q1'), edge('q1', 'm'), edge('m', 'q2'), edge('q2', 'q3')],
};

const settle = async () => {
  for (let i = 0; i < 30; i++) await new Promise((r) => setImmediate(r));
};

const start = async () => {
  const state = new ChatState('s1', 'b1');
  const registry = NodeHandlerRegistry.getInstance();
  registerAllHandlers(registry, {});
  const engine = new NodeFlowEngine(state, registry, { typingDelay: 0 });
  engine.loadFlow(flow as any);
  await engine.start();
  await settle();
  return { state, engine };
};

describe('change answer', () => {
  beforeEach(() => jest.useRealTimers());

  it('keeps a point for each question, before it is drawn', async () => {
    const { engine, state } = await start();
    const points = engine.questionPoints();
    expect(points.map((p) => p.nodeId)).toEqual(['q1']);
    // Taken before the question's own record entry.
    expect((state.getRecord()[points[0].recordLen] as any).id).toBe('q1');
    expect(state.getTranscript().some((e) => e.nodeId === 'q1')).toBe(true);
  });

  it('says what ran since a question; a message is safe to undo, a file step is not', async () => {
    const { engine } = await start();
    await engine.submitResponse('Jamie');
    await settle();
    const [p1, p2] = engine.questionPoints();
    expect(p2.nodeId).toBe('q2');
    expect(engine.typesSince(p1)).toEqual(['message-node', 'ask-email-node']);
    expect(canChangeAnswer(p1.type, engine.typesSince(p1).slice(0, -1))).toBe(true);
    await engine.submitResponse('jamie@example.com');
    await settle();
    // The file step acts on the world: the email can no longer be changed.
    expect(engine.typesSince(engine.questionPoints()[1])).toEqual(['ask-file-node']);
    expect(canChangeAnswer('ask-email-node', ['ask-file-node'])).toBe(false);
  });

  it('goes back: the state as it was, the question asked again, a new answer taken', async () => {
    const { engine, state } = await start();
    await engine.submitResponse('Jamie');
    await settle();
    expect(state.getAnswer('name')).toBe('Jamie');
    expect(engine.getState().currentNodeId).toBe('q2');
    const transcriptBefore = state.getTranscript().length;

    const p1 = engine.questionPoints()[0];
    expect(await engine.rewindTo(p1.id)).toBe(true);
    await settle();

    expect(engine.getState().currentNodeId).toBe('q1');
    expect(engine.getState().isWaitingForInput).toBe(true);
    expect(state.getAnswer('name') ?? null).toBeNull();
    // The answer and everything after it are gone; the question is asked again.
    expect(state.getTranscript().length).toBeLessThan(transcriptBefore);
    expect(state.getTranscript().filter((e) => e.type === 'user')).toHaveLength(0);
    // Points after it are gone; the question has a new one.
    expect(engine.questionPoints().map((p) => p.nodeId)).toEqual(['q1']);
    expect(engine.questionPoints()[0].id).not.toBe(p1.id);

    await engine.submitResponse('Sam');
    await settle();
    expect(state.getAnswer('name')).toBe('Sam');
    expect(engine.getState().currentNodeId).toBe('q2');
  });

  it('refuses a point that is gone, and once the chat is over', async () => {
    const { engine, state } = await start();
    expect(await engine.rewindTo(999)).toBe(false);
    state.markConversationComplete('done');
    expect(await engine.rewindTo(engine.questionPoints()[0].id)).toBe(false);
  });

  it('counts a person in the conversation since as not safe', async () => {
    const { engine, state } = await start();
    const p1 = engine.questionPoints()[0];
    state.addRecord({ _id: 'a1', type: 'agent-message', time: new Date().toISOString(), text: 'Hi' } as any);
    expect(engine.typesSince(p1)).toContain('agent');
    expect(canChangeAnswer('ask-name-node', engine.typesSince(p1))).toBe(false);
  });

  it('puts a saved state back in place, keeping its listeners', () => {
    const state = new ChatState('s1', 'b1');
    state.saveVariableByName('name', 'Jamie', 'q1');
    const snap = JSON.parse(JSON.stringify(state.toJSON()));
    state.saveVariableByName('name', 'Sam', 'q1');
    state.addUserMessage('Sam', 'q1');
    const heard = jest.fn();
    state.addListener(heard);
    state.restore(snap);
    expect(state.getAnswer('name')).toBe('Jamie');
    expect(state.getTranscript()).toHaveLength(0);
    expect(state.sessionId).toBe('s1');
    expect(heard).toHaveBeenCalled();
  });
});
