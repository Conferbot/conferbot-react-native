/**
 * Legacy Node Handlers Tests
 *
 * The v1 steps: two/three-choices (choiceText1..3), select-option
 * (option1..5), user-input, user-range, user-rating and quiz, as the web
 * widget runs them (handlers/_legacy.ts, flowOperations.ts).
 */
import { ChatState } from '../../src/core/state/ChatState';
import { NodeResult } from '../../src/core/nodes/NodeHandler';
import {
  TwoChoicesNodeHandler,
  ThreeChoicesNodeHandler,
  SelectOptionNodeHandler,
  UserInputNodeHandler,
  UserRangeNodeHandler,
  UserRatingNodeHandler,
  QuizNodeHandler,
  legacyHandlers,
} from '../../src/core/nodes/handlers/LegacyNodeHandlers';
import { createNode } from '../testUtils';

describe('Legacy Node Handlers', () => {
  let state: ChatState;
  beforeEach(() => {
    state = new ChatState('s', 'b');
  });
  const record = (shape: string) => state.getRecord().find((r: any) => r.shape === shape) as any;

  it('two-choices reads choiceText1/2 (#35), leaves by source-1/2 and saves no variable', async () => {
    const node = createNode('two-choices-node', { choicePrompt: 'Ready?', choiceText1: '<p>Yes</p>', choiceText2: 'Later' }, { id: 't' });
    const ui: any = await new TwoChoicesNodeHandler().handle(node, state);
    expect(ui.uiState.buttons.map((b: any) => b.label)).toEqual(['Yes', 'Later']);
    expect(await new TwoChoicesNodeHandler().handleResponse({ buttonId: '2' }, node, state)).toEqual(NodeResult.port('source-2'));
    expect(record('user-selected-choice').selectedChoice).toBe('Later');
    expect(state.getAnswerVariables()).toHaveLength(0);
  });

  it('two-choices hides the second with disableSecondChoice; three-choices has three', async () => {
    const two: any = await new TwoChoicesNodeHandler().handle(createNode('two-choices-node', { choiceText1: 'A', choiceText2: 'B', disableSecondChoice: true }), state);
    const three: any = await new ThreeChoicesNodeHandler().handle(createNode('three-choices-node', { choiceText1: 'A', choiceText2: 'B', choiceText3: 'C' }), state);
    expect(two.uiState.buttons).toHaveLength(1);
    expect(three.uiState.buttons.map((b: any) => b.id)).toEqual(['1', '2', '3']);
  });

  it('select-option reads option1..5 and takes the first edge after 600 ms', async () => {
    const node = createNode('select-option-node', { option1: 'S', option2: 'M', option3: 'L', disableOption4: true, disableOption5: true }, { id: 's' });
    const ui: any = await new SelectOptionNodeHandler().handle(node, state);
    expect(ui.uiState.buttons).toHaveLength(3);
    expect(await new SelectOptionNodeHandler().handleResponse({ buttonId: '3' }, node, state)).toEqual(NodeResult.delayedProceed(null, 600));
    expect(record('user-selected-option').selectedOption).toBe('L');
  });

  it('user-input checks e-mails (incorrectEmailResponse) and moves on 500 ms after an answer', async () => {
    const node = createNode('user-input-node', { type: 'email', incorrectEmailResponse: 'Bad email' }, { id: 'u' });
    expect(await new UserInputNodeHandler().handleResponse('nope', node, state)).toMatchObject({ type: 'invalid', message: 'Bad email' });
    expect(await new UserInputNodeHandler().handleResponse('a@b.io', node, state)).toEqual(NodeResult.delayedProceed(null, 500));
    expect(record('user-input-response')).toMatchObject({ type: 'email', text: 'a@b.io' });
  });

  it('user-input name greets with nameGreet after 1000 ms of typing', async () => {
    const node = { ...createNode('user-input-node', { type: 'name', nameGreet: 'Hi {name}!' }, { id: 'u' }), ctx: { typing: async () => undefined } };
    expect(await new UserInputNodeHandler().handleResponse('maria lopez', node, state)).toEqual(NodeResult.delayedProceed(null, 1000));
    expect(state.getTranscript().pop()?.text).toBe('Hi Maria!');
  });

  it('user-range: below -> source-1, within -> source-2, above -> source-3; text refused', async () => {
    const node = createNode('user-range-node', { minVal: 10, maxVal: 100 }, { id: 'rg' });
    const h = new UserRangeNodeHandler();
    expect((await h.handleResponse('lots', node, state)).type).toBe('invalid');
    expect(await h.handleResponse('5', node, state)).toEqual(NodeResult.port('source-1'));
    expect(await h.handleResponse('50', node, state)).toEqual(NodeResult.port('source-2'));
    expect(await h.handleResponse('1,000', node, state)).toEqual(NodeResult.port('source-3'));
  });

  it('user-rating records the number and takes the first edge', async () => {
    const node = createNode('user-rating-node', { type: 'star' }, { id: 'ur' });
    expect(await new UserRatingNodeHandler().handleResponse({ value: 4 }, node, state)).toEqual(NodeResult.next());
    expect(record('user-selected-rating')).toMatchObject({ type: 'star', rating: 4 });
  });

  describe('quiz-node', () => {
    const quiz = createNode('quiz-node', { quizPrompt: 'Q', option1: 'A', option2: 'B', option3: 'C', correctAnswer: 'option3' }, { id: 'q' });

    it('wrong -> source-1, right -> source-2 ("optionN", not a number)', async () => {
      expect(await new QuizNodeHandler().handleResponse({ buttonId: '1' }, quiz, state)).toEqual(NodeResult.port('source-1'));
      expect(await new QuizNodeHandler().handleResponse({ buttonId: '3' }, quiz, state)).toEqual(NodeResult.port('source-2'));
      expect(record('user-selected-quiz-option')).toMatchObject({ selectedOption: 'C', correctAnswer: 'option3', correct: true });
    });

    it('right into a variable-node: adds to the score and jumps past it', async () => {
      const varNode = { id: 'v', type: 'variable-node', data: { name: 'score', value: '1' } };
      const ctx = {
        edges: () => [{ source: 'q', sourceHandle: 'source-2', target: 'v' }],
        edgesOf: (id: string) => (id === 'v' ? [{ source: 'v', target: 'next' }] : []),
        node: (id: string) => (id === 'v' ? varNode : undefined),
      };
      expect(await new QuizNodeHandler().handleResponse({ buttonId: '3' }, { ...quiz, ctx }, state)).toEqual(NodeResult.jumpTo('next'));
      await new QuizNodeHandler().handleResponse({ buttonId: '3' }, { ...quiz, ctx }, state);
      expect(state.getVariable('score')).toBe(2);
    });
  });

  it('registers the seven legacy steps', () => {
    expect(legacyHandlers).toHaveLength(7);
  });
});
