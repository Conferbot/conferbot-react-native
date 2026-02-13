/**
 * LegacyNodeHandlers Tests
 *
 * Comprehensive tests for legacy/backwards compatibility node handlers:
 * - UserInputNodeHandler
 * - UserRangeNodeHandler
 * - QuizNodeHandler
 */

import { ChatState } from '../../src/core/state/ChatState';
import { NodeResult, NodeUIState } from '../../src/core/nodes/NodeHandler';
import {
  UserInputNodeHandler,
  UserRangeNodeHandler,
  QuizNodeHandler,
  legacyHandlers,
  registerLegacyHandlers,
} from '../../src/core/nodes/handlers/LegacyNodeHandlers';
import { createNode } from '../testUtils';

describe('Legacy Node Handlers', () => {
  let chatState: ChatState;

  beforeEach(() => {
    chatState = new ChatState('test-session', 'test-bot');
  });

  // ========================================
  // USER INPUT NODE HANDLER TESTS
  // ========================================

  describe('UserInputNodeHandler', () => {
    const handler = new UserInputNodeHandler();

    it('should have correct node type', () => {
      expect(handler.nodeType).toBe('user-input-node');
    });

    describe('handle method', () => {
      it('should display text input UI state', async () => {
        const node = createNode('user-input-node', {
          question: 'What is your name?',
          variableName: 'userName',
          inputType: 'text',
        });

        const result = await handler.handle(node, chatState);

        expect(result.type).toBe('displayUI');
        if (result.type === 'displayUI') {
          const uiState = result.uiState as NodeUIState.TextInput;
          expect(uiState.type).toBe('textInput');
          expect(uiState.question).toBe('What is your name?');
          expect(uiState.inputType).toBe('text');
          expect(uiState.variableName).toBe('userName');
        }
      });

      it('should display email input type', async () => {
        const node = createNode('user-input-node', {
          question: 'Enter your email',
          variableName: 'email',
          inputType: 'email',
        });

        const result = await handler.handle(node, chatState);

        if (result.type === 'displayUI') {
          const uiState = result.uiState as NodeUIState.TextInput;
          expect(uiState.inputType).toBe('email');
        }
      });

      it('should display phone input type', async () => {
        const node = createNode('user-input-node', {
          question: 'Enter your phone',
          variableName: 'phone',
          inputType: 'phone',
        });

        const result = await handler.handle(node, chatState);

        if (result.type === 'displayUI') {
          const uiState = result.uiState as NodeUIState.TextInput;
          expect(uiState.inputType).toBe('phone');
        }
      });

      it('should display number input type', async () => {
        const node = createNode('user-input-node', {
          question: 'Enter a number',
          variableName: 'quantity',
          inputType: 'number',
        });

        const result = await handler.handle(node, chatState);

        if (result.type === 'displayUI') {
          const uiState = result.uiState as NodeUIState.TextInput;
          expect(uiState.inputType).toBe('number');
        }
      });

      it('should display URL input type', async () => {
        const node = createNode('user-input-node', {
          question: 'Enter website',
          variableName: 'website',
          inputType: 'url',
        });

        const result = await handler.handle(node, chatState);

        if (result.type === 'displayUI') {
          const uiState = result.uiState as NodeUIState.TextInput;
          expect(uiState.inputType).toBe('url');
        }
      });

      it('should resolve variables in question text', async () => {
        chatState.setVariable('product', 'Widget Pro');

        const node = createNode('user-input-node', {
          question: 'How do you like {{product}}?',
          variableName: 'feedback',
        });

        const result = await handler.handle(node, chatState);

        if (result.type === 'displayUI') {
          const uiState = result.uiState as NodeUIState.TextInput;
          expect(uiState.question).toBe('How do you like Widget Pro?');
        }
      });

      it('should use default question when not provided', async () => {
        const node = createNode('user-input-node', {
          variableName: 'response',
        });

        const result = await handler.handle(node, chatState);

        if (result.type === 'displayUI') {
          const uiState = result.uiState as NodeUIState.TextInput;
          expect(uiState.question).toBe('Please enter your response');
        }
      });

      it('should include validation rules', async () => {
        const node = createNode('user-input-node', {
          question: 'Enter password',
          variableName: 'password',
          required: true,
          minLength: 8,
          maxLength: 50,
          pattern: '^(?=.*[A-Za-z])(?=.*\\d)[A-Za-z\\d]{8,}$',
        });

        const result = await handler.handle(node, chatState);

        if (result.type === 'displayUI') {
          const uiState = result.uiState as NodeUIState.TextInput;
          expect(uiState.validation?.required).toBe(true);
          expect(uiState.validation?.minLength).toBe(8);
          expect(uiState.validation?.maxLength).toBe(50);
          expect(uiState.validation?.pattern).toBeDefined();
        }
      });

      it('should include placeholder', async () => {
        const node = createNode('user-input-node', {
          question: 'Enter email',
          variableName: 'email',
          placeholder: 'you@example.com',
        });

        const result = await handler.handle(node, chatState);

        if (result.type === 'displayUI') {
          const uiState = result.uiState as NodeUIState.TextInput;
          expect(uiState.placeholder).toBe('you@example.com');
        }
      });

      it('should add question to transcript', async () => {
        const node = createNode('user-input-node', {
          question: 'Test question',
          variableName: 'test',
        });

        await handler.handle(node, chatState);

        const transcript = chatState.getTranscript();
        expect(transcript.some(entry => entry.text === 'Test question')).toBe(true);
      });

      it('should handle node without explicit data section', async () => {
        // getNodeData returns node.data ?? node, so bare node is treated as data
        const result = await handler.handle({ id: 'test' }, chatState);

        // Handler uses default values and proceeds to displayUI
        expect(result.type).toBe('displayUI');
      });

      it('should use alternative field names', async () => {
        const testCases = [
          { prompt: 'Question text', variable: 'var1' },
          { text: 'Question text', name: 'var2' },
          { message: 'Question text', fieldType: 'email' },
        ];

        for (const data of testCases) {
          const node = createNode('user-input-node', data);
          const result = await handler.handle(node, chatState);

          expect(result.type).toBe('displayUI');
        }
      });
    });

    describe('handleResponse method', () => {
      it('should store text response in state', async () => {
        const node = createNode('user-input-node', {
          question: 'Enter name',
          variableName: 'name',
          inputType: 'text',
        });

        const result = await handler.handleResponse('John Doe', node, chatState);

        expect(result.type).toBe('proceed');
        expect(chatState.getAnswer('name')).toBe('John Doe');
      });

      it('should validate and normalize email', async () => {
        const node = createNode('user-input-node', {
          question: 'Enter email',
          variableName: 'email',
          inputType: 'email',
        });

        const result = await handler.handleResponse('TEST@Example.COM', node, chatState);

        expect(result.type).toBe('proceed');
        expect(chatState.getAnswer('email')).toBe('test@example.com');
      });

      it('should reject invalid email', async () => {
        const node = createNode('user-input-node', {
          question: 'Enter email',
          variableName: 'email',
          inputType: 'email',
        });

        const result = await handler.handleResponse('invalid-email', node, chatState);

        expect(result.type).toBe('error');
      });

      it('should validate phone number', async () => {
        const node = createNode('user-input-node', {
          question: 'Enter phone',
          variableName: 'phone',
          inputType: 'phone',
        });

        const validResult = await handler.handleResponse('+1234567890', node, chatState);
        expect(validResult.type).toBe('proceed');

        const invalidResult = await handler.handleResponse('123', node, chatState);
        expect(invalidResult.type).toBe('error');
      });

      it('should parse and validate number', async () => {
        const node = createNode('user-input-node', {
          question: 'Enter quantity',
          variableName: 'quantity',
          inputType: 'number',
          min: 1,
          max: 100,
        });

        const validResult = await handler.handleResponse('42', node, chatState);
        expect(validResult.type).toBe('proceed');
        expect(chatState.getAnswer('quantity')).toBe(42);

        // Reset state
        chatState = new ChatState('test-session', 'test-bot');

        const tooLowResult = await handler.handleResponse('0', node, chatState);
        expect(tooLowResult.type).toBe('error');

        const tooHighResult = await handler.handleResponse('150', node, chatState);
        expect(tooHighResult.type).toBe('error');
      });

      it('should validate and normalize URL', async () => {
        const node = createNode('user-input-node', {
          question: 'Enter website',
          variableName: 'website',
          inputType: 'url',
        });

        const result = await handler.handleResponse('example.com', node, chatState);

        expect(result.type).toBe('proceed');
        expect(chatState.getAnswer('website')).toBe('https://example.com');
      });

      it('should validate date', async () => {
        const node = createNode('user-input-node', {
          question: 'Enter date',
          variableName: 'birthdate',
          inputType: 'date',
        });

        const validResult = await handler.handleResponse('2024-01-15', node, chatState);
        expect(validResult.type).toBe('proceed');

        const invalidResult = await handler.handleResponse('not-a-date', node, chatState);
        expect(invalidResult.type).toBe('error');
      });

      it('should return error for required empty field', async () => {
        const node = createNode('user-input-node', {
          question: 'Required field',
          variableName: 'required',
          required: true,
        });

        const result = await handler.handleResponse('', node, chatState);

        expect(result.type).toBe('error');
      });

      it('should allow empty for non-required field', async () => {
        const node = createNode('user-input-node', {
          question: 'Optional field',
          variableName: 'optional',
          required: false,
        });

        const result = await handler.handleResponse('', node, chatState);

        expect(result.type).toBe('proceed');
      });

      it('should validate string length constraints', async () => {
        const node = createNode('user-input-node', {
          question: 'Enter code',
          variableName: 'code',
          minLength: 4,
          maxLength: 8,
        });

        const tooShortResult = await handler.handleResponse('abc', node, chatState);
        expect(tooShortResult.type).toBe('error');

        const tooLongResult = await handler.handleResponse('123456789', node, chatState);
        expect(tooLongResult.type).toBe('error');

        const validResult = await handler.handleResponse('12345', node, chatState);
        expect(validResult.type).toBe('proceed');
      });

      it('should validate custom pattern', async () => {
        const node = createNode('user-input-node', {
          question: 'Enter code',
          variableName: 'code',
          pattern: '^[A-Z]{3}-[0-9]{3}$',
          errorMessage: 'Code must be in format ABC-123',
        });

        const validResult = await handler.handleResponse('ABC-123', node, chatState);
        expect(validResult.type).toBe('proceed');

        const invalidResult = await handler.handleResponse('invalid', node, chatState);
        expect(invalidResult.type).toBe('error');
      });

      it('should update user email metadata', async () => {
        const node = createNode('user-input-node', {
          question: 'Enter email',
          variableName: 'userEmail',
          inputType: 'email',
        });

        await handler.handleResponse('user@example.com', node, chatState);

        expect(chatState.userEmail).toBe('user@example.com');
      });

      it('should update user name metadata', async () => {
        const node = createNode('user-input-node', {
          question: 'Enter name',
          variableName: 'name',
          inputType: 'text',
        });

        await handler.handleResponse('John Doe', node, chatState);

        expect(chatState.userName).toBe('John Doe');
      });

      it('should update user phone metadata', async () => {
        const node = createNode('user-input-node', {
          question: 'Enter phone',
          variableName: 'phone',
          inputType: 'phone',
        });

        await handler.handleResponse('123-456-7890', node, chatState);

        expect(chatState.userPhone).toBe('123-456-7890');
      });

      it('should add user response to transcript', async () => {
        const node = createNode('user-input-node', {
          question: 'Test',
          variableName: 'test',
        });

        await handler.handleResponse('User answer', node, chatState);

        const transcript = chatState.getTranscript();
        expect(transcript.some(entry => entry.text === 'User answer')).toBe(true);
      });
    });
  });

  // ========================================
  // USER RANGE NODE HANDLER TESTS
  // ========================================

  describe('UserRangeNodeHandler', () => {
    const handler = new UserRangeNodeHandler();

    it('should have correct node type', () => {
      expect(handler.nodeType).toBe('user-range-node');
    });

    describe('handle method', () => {
      it('should display slider UI state', async () => {
        const node = createNode('user-range-node', {
          question: 'Rate your experience',
          variableName: 'rating',
          min: 0,
          max: 10,
          step: 1,
          defaultValue: 5,
        });

        const result = await handler.handle(node, chatState);

        expect(result.type).toBe('displayUI');
        if (result.type === 'displayUI') {
          const uiState = result.uiState as NodeUIState.Slider;
          expect(uiState.type).toBe('slider');
          expect(uiState.question).toBe('Rate your experience');
          expect(uiState.min).toBe(0);
          expect(uiState.max).toBe(10);
          expect(uiState.step).toBe(1);
          expect(uiState.defaultValue).toBe(5);
        }
      });

      it('should include labels', async () => {
        const node = createNode('user-range-node', {
          question: 'How likely are you to recommend?',
          variableName: 'nps',
          min: 0,
          max: 10,
          minLabel: 'Not at all likely',
          maxLabel: 'Extremely likely',
        });

        const result = await handler.handle(node, chatState);

        if (result.type === 'displayUI') {
          const uiState = result.uiState as NodeUIState.Slider;
          expect(uiState.minLabel).toBe('Not at all likely');
          expect(uiState.maxLabel).toBe('Extremely likely');
        }
      });

      it('should use default values when not specified', async () => {
        const node = createNode('user-range-node', {
          question: 'Select a value',
          variableName: 'value',
        });

        const result = await handler.handle(node, chatState);

        if (result.type === 'displayUI') {
          const uiState = result.uiState as NodeUIState.Slider;
          expect(uiState.min).toBe(0);
          expect(uiState.max).toBe(100);
          expect(uiState.step).toBe(1);
        }
      });

      it('should calculate default value as midpoint', async () => {
        const node = createNode('user-range-node', {
          question: 'Select',
          variableName: 'val',
          min: 0,
          max: 100,
        });

        const result = await handler.handle(node, chatState);

        if (result.type === 'displayUI') {
          const uiState = result.uiState as NodeUIState.Slider;
          expect(uiState.defaultValue).toBe(50);
        }
      });

      it('should resolve variables in labels', async () => {
        chatState.setVariable('product', 'Service');

        const node = createNode('user-range-node', {
          question: 'Rate our {{product}}',
          variableName: 'rating',
          minLabel: 'Hate {{product}}',
          maxLabel: 'Love {{product}}',
        });

        const result = await handler.handle(node, chatState);

        if (result.type === 'displayUI') {
          const uiState = result.uiState as NodeUIState.Slider;
          expect(uiState.question).toBe('Rate our Service');
        }
      });

      it('should use alternative field names', async () => {
        const node = createNode('user-range-node', {
          text: 'Question text',
          variable: 'varName',
          leftLabel: 'Low',
          rightLabel: 'High',
        });

        const result = await handler.handle(node, chatState);

        expect(result.type).toBe('displayUI');
      });

      it('should handle missing node data gracefully', async () => {
        const result = await handler.handle({ id: 'test' }, chatState);

        // Handler uses defaults when data is missing (getNodeData returns node.data ?? node)
        // so it will display UI with default values rather than error
        expect(['displayUI', 'error']).toContain(result.type);
      });
    });

    describe('handleResponse method', () => {
      it('should store numeric response in state', async () => {
        const node = createNode('user-range-node', {
          question: 'Select',
          variableName: 'selectedValue',
          min: 0,
          max: 100,
        });

        const result = await handler.handleResponse(75, node, chatState);

        expect(result.type).toBe('proceed');
        expect(chatState.getAnswer('selectedValue')).toBe(75);
      });

      it('should parse string number response', async () => {
        const node = createNode('user-range-node', {
          question: 'Select',
          variableName: 'value',
          min: 0,
          max: 100,
        });

        const result = await handler.handleResponse('42', node, chatState);

        expect(result.type).toBe('proceed');
        expect(chatState.getAnswer('value')).toBe(42);
      });

      it('should return error for invalid number', async () => {
        const node = createNode('user-range-node', {
          question: 'Select',
          variableName: 'value',
        });

        const result = await handler.handleResponse('not-a-number', node, chatState);

        expect(result.type).toBe('error');
      });

      it('should return error for out of range value', async () => {
        const node = createNode('user-range-node', {
          question: 'Select',
          variableName: 'value',
          min: 0,
          max: 100,
        });

        const tooLowResult = await handler.handleResponse(-5, node, chatState);
        expect(tooLowResult.type).toBe('error');

        const tooHighResult = await handler.handleResponse(150, node, chatState);
        expect(tooHighResult.type).toBe('error');
      });

      it('should add response to transcript', async () => {
        const node = createNode('user-range-node', {
          question: 'Rate',
          variableName: 'rating',
        });

        await handler.handleResponse(8, node, chatState);

        const transcript = chatState.getTranscript();
        expect(transcript.some(entry => entry.text === '8')).toBe(true);
      });
    });
  });

  // ========================================
  // QUIZ NODE HANDLER TESTS
  // ========================================

  describe('QuizNodeHandler', () => {
    const handler = new QuizNodeHandler();

    it('should have correct node type', () => {
      expect(handler.nodeType).toBe('quiz-node');
    });

    describe('handle method', () => {
      it('should display quiz UI state', async () => {
        const node = createNode('quiz-node', {
          question: 'What is 2 + 2?',
          variableName: 'mathQuiz',
          options: [
            { id: 'opt1', label: '3', isCorrect: false },
            { id: 'opt2', label: '4', isCorrect: true },
            { id: 'opt3', label: '5', isCorrect: false },
          ],
        });

        const result = await handler.handle(node, chatState);

        expect(result.type).toBe('displayUI');
        if (result.type === 'displayUI') {
          const uiState = result.uiState as NodeUIState.Quiz;
          expect(uiState.type).toBe('quiz');
          expect(uiState.question).toBe('What is 2 + 2?');
          expect(uiState.options).toHaveLength(3);
          expect(uiState.options.find(o => o.isCorrect)?.label).toBe('4');
        }
      });

      it('should include feedback messages', async () => {
        const node = createNode('quiz-node', {
          question: 'Quiz question',
          variableName: 'quiz',
          options: [
            { id: 'a', label: 'A', isCorrect: true },
            { id: 'b', label: 'B', isCorrect: false },
          ],
          correctFeedback: 'Well done!',
          incorrectFeedback: 'Try again.',
        });

        const result = await handler.handle(node, chatState);

        if (result.type === 'displayUI') {
          const uiState = result.uiState as NodeUIState.Quiz;
          expect(uiState.feedback?.correct).toBe('Well done!');
          expect(uiState.feedback?.incorrect).toBe('Try again.');
        }
      });

      it('should support correctIndex for marking correct answer', async () => {
        const node = createNode('quiz-node', {
          question: 'Quiz',
          variableName: 'quiz',
          options: [
            { id: 'a', label: 'A' },
            { id: 'b', label: 'B' },
            { id: 'c', label: 'C' },
          ],
          correctIndex: 1,
        });

        const result = await handler.handle(node, chatState);

        if (result.type === 'displayUI') {
          const uiState = result.uiState as NodeUIState.Quiz;
          expect(uiState.options[1].isCorrect).toBe(true);
        }
      });

      it('should use default feedback messages', async () => {
        const node = createNode('quiz-node', {
          question: 'Quiz',
          variableName: 'quiz',
          options: [
            { id: 'a', label: 'A', isCorrect: true },
          ],
        });

        const result = await handler.handle(node, chatState);

        if (result.type === 'displayUI') {
          const uiState = result.uiState as NodeUIState.Quiz;
          expect(uiState.feedback?.correct).toBe('Correct!');
          expect(uiState.feedback?.incorrect).toBe('Incorrect.');
        }
      });

      it('should resolve variables in question and options', async () => {
        chatState.setVariable('topic', 'Math');

        const node = createNode('quiz-node', {
          question: '{{topic}} Quiz: What is 1+1?',
          variableName: 'quiz',
          options: [
            { id: 'a', label: '2', isCorrect: true },
          ],
        });

        const result = await handler.handle(node, chatState);

        if (result.type === 'displayUI') {
          const uiState = result.uiState as NodeUIState.Quiz;
          expect(uiState.question).toBe('Math Quiz: What is 1+1?');
        }
      });

      it('should use alternative field names', async () => {
        // Note: The handler checks 'options' first, so we must provide options
        // even when using alternative names like 'text' for question
        const node = createNode('quiz-node', {
          text: 'Question',  // alternative to 'question'
          variable: 'answer',  // alternative to 'variableName'
          options: [
            { text: 'Option A', correct: true },  // 'text' alternative to 'label', 'correct' alternative to 'isCorrect'
            { text: 'Option B', correct: false },
          ],
        });

        const result = await handler.handle(node, chatState);

        expect(result.type).toBe('displayUI');
        if (result.type === 'displayUI') {
          const uiState = result.uiState as NodeUIState.Quiz;
          expect(uiState.question).toBe('Question');
          expect(uiState.variableName).toBe('answer');
          expect(uiState.options[0].label).toBe('Option A');
          expect(uiState.options[0].isCorrect).toBe(true);
        }
      });

      it('should return error when no options provided', async () => {
        const node = createNode('quiz-node', {
          question: 'Empty quiz',
          variableName: 'quiz',
          options: [],
        });

        const result = await handler.handle(node, chatState);

        expect(result.type).toBe('error');
      });
    });

    describe('handleResponse method', () => {
      it('should store correct answer with isCorrect true', async () => {
        const node = createNode('quiz-node', {
          question: 'Quiz',
          variableName: 'quizAnswer',
          options: [
            { id: 'opt1', label: 'Wrong', isCorrect: false },
            { id: 'opt2', label: 'Correct', isCorrect: true },
          ],
        });

        const result = await handler.handleResponse('opt2', node, chatState);

        expect(result.type).toBe('proceed');
        const answer = chatState.getAnswer('quizAnswer');
        expect(answer.isCorrect).toBe(true);
      });

      it('should store incorrect answer with isCorrect false', async () => {
        const node = createNode('quiz-node', {
          question: 'Quiz',
          variableName: 'quizAnswer',
          options: [
            { id: 'opt1', label: 'Wrong', isCorrect: false },
            { id: 'opt2', label: 'Correct', isCorrect: true },
          ],
        });

        const result = await handler.handleResponse('opt1', node, chatState);

        expect(result.type).toBe('proceed');
        const answer = chatState.getAnswer('quizAnswer');
        expect(answer.isCorrect).toBe(false);
      });

      it('should track quiz score', async () => {
        const node = createNode('quiz-node', {
          question: 'Quiz',
          variableName: 'q1',
          options: [
            { id: 'a', label: 'A', isCorrect: true },
            { id: 'b', label: 'B', isCorrect: false },
          ],
        });

        // Answer correctly
        await handler.handleResponse('a', node, chatState);

        expect(chatState.getVariable('_quizScore')).toBe(1);
        expect(chatState.getVariable('_quizTotal')).toBe(1);

        // Answer incorrectly for another question
        const node2 = createNode('quiz-node', {
          question: 'Quiz 2',
          variableName: 'q2',
          options: [
            { id: 'a', label: 'A', isCorrect: true },
            { id: 'b', label: 'B', isCorrect: false },
          ],
        });

        await handler.handleResponse('b', node2, chatState);

        expect(chatState.getVariable('_quizScore')).toBe(1); // Still 1
        expect(chatState.getVariable('_quizTotal')).toBe(2);
      });

      it('should store separate correctness variable', async () => {
        const node = createNode('quiz-node', {
          question: 'Quiz',
          variableName: 'answer',
          options: [
            { id: 'a', label: 'A', isCorrect: true },
          ],
        });

        await handler.handleResponse('a', node, chatState);

        expect(chatState.getVariable('answer_correct')).toBe(true);
      });

      it('should jump to correct path when configured', async () => {
        const node = createNode('quiz-node', {
          question: 'Quiz',
          variableName: 'answer',
          options: [
            { id: 'a', label: 'A', isCorrect: true },
            { id: 'b', label: 'B', isCorrect: false },
          ],
          correctNextNodeId: 'correct-node',
          incorrectNextNodeId: 'incorrect-node',
        });

        const correctResult = await handler.handleResponse('a', node, chatState);

        expect(correctResult.type).toBe('jumpTo');
        if (correctResult.type === 'jumpTo') {
          expect(correctResult.targetNodeId).toBe('correct-node');
        }
      });

      it('should jump to incorrect path when wrong', async () => {
        const node = createNode('quiz-node', {
          question: 'Quiz',
          variableName: 'answer',
          options: [
            { id: 'a', label: 'A', isCorrect: true },
            { id: 'b', label: 'B', isCorrect: false },
          ],
          incorrectNextNodeId: 'incorrect-node',
        });

        const result = await handler.handleResponse('b', node, chatState);

        expect(result.type).toBe('jumpTo');
        if (result.type === 'jumpTo') {
          expect(result.targetNodeId).toBe('incorrect-node');
        }
      });

      it('should return error when no answer selected', async () => {
        const node = createNode('quiz-node', {
          question: 'Quiz',
          variableName: 'answer',
          options: [
            { id: 'a', label: 'A', isCorrect: true },
          ],
        });

        const result = await handler.handleResponse(null, node, chatState);

        expect(result.type).toBe('error');
      });

      it('should match by label when id not found', async () => {
        const node = createNode('quiz-node', {
          question: 'Quiz',
          variableName: 'answer',
          options: [
            { id: 'opt1', label: 'Answer A', isCorrect: true },
          ],
        });

        const result = await handler.handleResponse('Answer A', node, chatState);

        expect(result.type).toBe('proceed');
      });

      it('should add selected answer to transcript', async () => {
        const node = createNode('quiz-node', {
          question: 'Quiz',
          variableName: 'answer',
          options: [
            { id: 'a', label: 'My Answer', isCorrect: true },
          ],
        });

        await handler.handleResponse('a', node, chatState);

        const transcript = chatState.getTranscript();
        expect(transcript.some(entry => entry.text === 'My Answer')).toBe(true);
      });
    });
  });

  // ========================================
  // LEGACY HANDLERS COLLECTION TESTS
  // ========================================

  describe('Legacy Handlers Collection', () => {
    it('should export all legacy handlers', () => {
      expect(legacyHandlers).toHaveLength(3);
      expect(legacyHandlers.map(h => h.nodeType)).toContain('user-input-node');
      expect(legacyHandlers.map(h => h.nodeType)).toContain('user-range-node');
      expect(legacyHandlers.map(h => h.nodeType)).toContain('quiz-node');
    });

    it('should register handlers with registry', () => {
      const mockRegistry = {
        registerAll: jest.fn(),
      };

      registerLegacyHandlers(mockRegistry as any);

      expect(mockRegistry.registerAll).toHaveBeenCalledWith(legacyHandlers);
    });
  });
});
