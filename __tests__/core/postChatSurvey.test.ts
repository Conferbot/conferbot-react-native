/**
 * A live chat a flow's handover step started, ended by the agent (#66, #67),
 * through the real NodeFlowEngine and handlers: the step's post-chat survey
 * questions in order when `enablePostChatSurveyQuestions` is on, each answer
 * recorded as the web records it (special.ts
 * _handlePostChatSurveyQuestionsLooper / _handlePostChatSurveyQuestionsSubmit),
 * then the flow carries on along the handover step's next edge.
 */
import { NodeFlowEngine } from '../../src/core/NodeFlowEngine';
import { ChatState } from '../../src/core/state/ChatState';
import { NodeHandlerRegistry } from '../../src/core/nodes/NodeHandlerRegistry';
import { registerAllHandlers } from '../../src/core/nodes/handlers';
import { postChatSurveyQuestionsOf } from '../../src/core/nodes/handlers/IntegrationNodeHandlers';

const QUESTIONS = [
  { id: 'q1', questionText: '<p>How did we do?</p>', answerVariable: '' },
  { id: 'q2', questionText: 'Your email for a follow-up?', answerVariable: 'email', incorrectEmailResponse: 'That email looks wrong' },
];

const flow = (handoverData: Record<string, any>) => ({
  nodes: [
    { id: 'h', type: 'human-handover-node', data: { handoverMessage: 'Connecting', ...handoverData } },
    { id: 'after', type: 'message-node', data: { text: 'Thanks for chatting' } },
  ],
  edges: [{ id: 'e1', source: 'h', target: 'after' }],
  startNodeId: 'h',
});

const run = async (handoverData: Record<string, any>) => {
  const emits: Array<[string, any]> = [];
  const socket: any = {
    emit: (e: string, p: any) => emits.push([e, p]),
    emitToServer: (e: string, p: any) => emits.push([e, p]),
    on: () => () => {},
    off: () => {},
    sendResponseRecord: (p: any) => emits.push(['response-record', p]),
  };
  const state = new ChatState('s1', 'b1');
  const registry = new NodeHandlerRegistry();
  registerAllHandlers(registry, { socketClient: socket });
  const engine = new NodeFlowEngine(state, registry, { socketClient: socket });
  engine.loadFlow(flow(handoverData) as any);
  const settle = async () => {
    for (let i = 0; i < 20; i++) await jest.advanceTimersByTimeAsync(1000);
  };
  engine.start();
  await settle();
  return { engine, state, emits, settle };
};

const recorded = (state: ChatState, type: string) => (state.getRecord() as any[]).filter((r) => r.type === type);

describe('post-chat survey after an agent ends the chat (#66, #67)', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('asks the questions in order, records the answers as the web does, then carries on along the next edge', async () => {
    const { engine, state, settle } = await run({ enablePostChatSurveyQuestions: true, postChatSurveyQuestions: QUESTIONS });
    expect(engine.getState().currentNodeId).toBe('h');
    // Only a question with an answer variable has one (web index.ts).
    expect(state.getAnswerVariables().map((a) => a.nodeId)).toEqual(['q2']);

    engine.submitResponse({ action: 'chatEnded' });
    await settle();
    let ui: any = engine.getState().currentUIState;
    expect(ui).toMatchObject({ type: 'textInput', question: 'How did we do?' });
    expect(recorded(state, 'post-chat-survey-question')).toEqual([
      expect.objectContaining({ id: 'q1', shape: 'post-chat-survey-question', text: '<p>How did we do?</p>' }),
    ]);

    engine.submitResponse('Great, thanks');
    await settle();
    ui = engine.getState().currentUIState;
    expect(ui).toMatchObject({ type: 'textInput', question: 'Your email for a follow-up?', inputType: 'email' });

    // Checked as the web checks an email answer: the owner's message, same question.
    engine.submitResponse('not-an-email');
    await settle();
    expect(engine.getState().currentNodeId).toBe('h');
    expect(engine.getState().currentUIState).toMatchObject({ errorMessage: 'That email looks wrong' });
    expect(recorded(state, 'post-chat-survey-question-response')).toHaveLength(1);

    engine.submitResponse('ana@example.com');
    await settle();

    const answers = recorded(state, 'post-chat-survey-question-response');
    expect(answers).toEqual([
      expect.objectContaining({ questionId: 'q1', shape: 'post-chat-survey-question-response', text: 'Great, thanks' }),
      expect.objectContaining({ questionId: 'q2', shape: 'post-chat-survey-question-response', text: 'ana@example.com' }),
    ]);
    // Each answer has its own id (web liveEventId('post-chat-answer')).
    expect(answers[0].id).toMatch(/^post-chat-answer-/);
    expect(answers[0].id).not.toBe(answers[1].id);
    expect(state.getAnswerVariables().find((a) => a.nodeId === 'q2')?.value).toBe('ana@example.com');
    expect(state.userEmail).toBe('ana@example.com');

    // The flow carried on along the handover step's next edge.
    expect(state.getTranscript().map((t: any) => t.text)).toContain('Thanks for chatting');
    expect(engine.getState().currentNodeId).not.toBe('h');
  });

  it('no survey with the switch off: the flow carries on at once', async () => {
    const { engine, state, settle } = await run({ enablePostChatSurveyQuestions: false, postChatSurveyQuestions: QUESTIONS });
    engine.submitResponse({ action: 'chatEnded' });
    await settle();
    expect(recorded(state, 'post-chat-survey-question')).toHaveLength(0);
    expect(state.getTranscript().map((t: any) => t.text)).toContain('Thanks for chatting');
  });

  it('no survey with the switch on and no questions', async () => {
    const { engine, state, settle } = await run({ enablePostChatSurveyQuestions: true, postChatSurveyQuestions: [] });
    engine.submitResponse({ action: 'chatEnded' });
    await settle();
    expect(recorded(state, 'post-chat-survey-question')).toHaveLength(0);
    expect(state.getTranscript().map((t: any) => t.text)).toContain('Thanks for chatting');
  });

  it('the old surveyConfig is not read: only the builder keys count', () => {
    expect(postChatSurveyQuestionsOf({ surveyConfig: { enabled: true }, postChatSurveyQuestions: QUESTIONS })).toEqual([]);
    expect(postChatSurveyQuestionsOf({ enablePostChatSurveyQuestions: true, postChatSurveyQuestions: QUESTIONS })).toHaveLength(2);
    expect(postChatSurveyQuestionsOf({ enablePostChatSurveyQuestions: true })).toEqual([]);
    expect(postChatSurveyQuestionsOf(null)).toEqual([]);
  });

  it('the legacy enablePostChatSurvey key still counts, as in Android #72 and Flutter #74', async () => {
    expect(postChatSurveyQuestionsOf({ enablePostChatSurvey: true, postChatSurveyQuestions: QUESTIONS })).toHaveLength(2);
    const { engine, state, settle } = await run({ enablePostChatSurvey: true, postChatSurveyQuestions: QUESTIONS.slice(0, 1) });
    engine.submitResponse({ action: 'chatEnded' });
    await settle();
    expect(engine.getState().currentUIState).toMatchObject({ type: 'textInput', question: 'How did we do?' });
    engine.submitResponse('Fine');
    await settle();
    expect(recorded(state, 'post-chat-survey-question-response')).toHaveLength(1);
    expect(state.getTranscript().map((t: any) => t.text)).toContain('Thanks for chatting');
  });
});
