/**
 * Advanced Input Handlers Tests
 *
 * calendar-node and ask-multiple-questions-node, as the web widget runs
 * them (displayStep.ts calendar-node, askQuestions.ts).
 */
import { ChatState } from '../../src/core/state/ChatState';
import { NodeResult } from '../../src/core/nodes/NodeHandler';
import { CalendarHandler, MultipleQuestionsHandler, advancedInputHandlers } from '../../src/core/nodes/handlers/AdvancedInputHandlers';
import { createNode } from '../testUtils';

describe('Advanced Input Handlers', () => {
  let state: ChatState;
  const emitted: Array<[string, any]> = [];
  const ctx = {
    visitorTimeZone: 'UTC',
    emit: (e: string, p: any) => emitted.push([e, p]) > 0,
    typing: async () => undefined,
    shown: () => undefined,
  };

  beforeEach(() => {
    state = new ChatState('s', 'b');
    emitted.length = 0;
  });

  describe('calendar-node', () => {
    it('shows calendarPrompt; a day without time selection saves the long date, then 400 ms', async () => {
      const node = { ...createNode('calendar-node', { calendarPrompt: '<p>Pick a day</p>', answerVariable: 'day' }, { id: 'cal' }), ctx };
      state.registerAnswerVariable('cal', 'day');
      const ui: any = await new CalendarHandler().handle(node, state);
      expect(ui.uiState).toMatchObject({ type: 'calendar', question: 'Pick a day', mode: 'date' });
      expect(await new CalendarHandler().handleResponse({ date: '2026-10-20' }, node, state)).toEqual(NodeResult.delayedProceed(null, 400));
      expect(state.getAnswer('day')).toBe('Tuesday, October 20, 2026');
    });

    it('with time selection: weekly hours in slots, the value names both clocks, the slot record is sent', async () => {
      const data = {
        timeZone: 'Asia/Dubai',
        showTimeSelection: true,
        slotDuration: 30,
        weeklyHours: [{ dayName: 'Wednesday', available: true, slots: [{ start: '09:00', end: '11:00' }] }],
        answerVariable: 'meeting',
      };
      const node = { ...createNode('calendar-node', data, { id: 'cal' }), ctx };
      state.registerAnswerVariable('cal', 'meeting');
      await new CalendarHandler().handleResponse({ date: '2026-10-21', slot: '09:30' }, node, state);
      expect(state.getAnswer('meeting')).toBe(
        "Wednesday, October 21, 2026 05:30 - 06:00 (Visitor's local time) / 09:30 - 10:00 (Bot's time)"
      );
      expect(emitted[0][0]).toBe('calendar-slot-selection-record');
    });
  });

  describe('ask-multiple-questions-node', () => {
    const node = {
      ...createNode(
        'ask-multiple-questions-node',
        {
          message: 'A few questions',
          questions: [
            { id: '1', questionText: 'Name?', answerVariable: 'first' },
            { id: '2', questionText: 'Email?', answerVariable: 'email' },
          ],
        },
        { id: 'mq' }
      ),
      ctx,
    };

    it('says the message, then asks each question in turn; an "email" answer is checked', async () => {
      state.registerAnswerVariable('mq0', 'first');
      state.registerAnswerVariable('mq1', 'email');
      const h = new MultipleQuestionsHandler();
      const first: any = await h.handle(node, state);
      expect(first.uiState.question).toBe('Name?');
      const second: any = await h.handleResponse('alpha', node, state);
      expect(second.uiState.question).toBe('Email?');
      expect((await h.handleResponse('bad-email', node, state)).type).toBe('invalid');
      expect(await h.handleResponse('a@b.co', node, state)).toEqual(NodeResult.next());
      expect(state.getAnswerVariables().map((v) => [v.nodeId, v.value])).toEqual([
        ['mq0', 'alpha'],
        ['mq1', 'a@b.co'],
      ]);
      expect(state.getRecord().filter((r: any) => r.shape === 'user-ask-multiple-questions-question-response').map((r: any) => r.id)).toEqual(['mq:1', 'mq:2']);
    });
  });

  it('registers calendar and multiple questions', () => {
    expect(advancedInputHandlers.map((h) => h.nodeType)).toEqual(['calendar-node', 'ask-multiple-questions-node']);
  });
});
