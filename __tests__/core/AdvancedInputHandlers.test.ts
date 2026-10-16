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
import { bookedLabels, dayKeyInZone, isDayFullyBooked } from '../../src/core/flow/calendar';

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

  describe('calendar-node booked slots (web displayStep.ts daySlotsFor, nodeLogic.ts isDayFullyBooked)', () => {
    const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const data = {
      timeZone: 'Asia/Dubai',
      showTimeSelection: true,
      slotDuration: 30,
      weeklyHours: DAYS.map((dayName) => ({ dayName, available: true, slots: [{ start: '09:00', end: '10:00' }] })),
      answerVariable: 'meeting',
    };
    // A day three days ahead, on the bot's clock.
    const ahead = (n: number) => dayKeyInZone(new Date(Date.now() + n * 86400000), 'Asia/Dubai');
    const bookingOn = (day: string, slot: string, extra: any = {}) => ({ date: `${day}T08:00:00.000Z`, timeSlotSelected: slot, ...extra });

    it('shows a taken slot as booked and refuses it; another node\'s booking does not count', async () => {
      const day = ahead(3);
      const node = {
        ...createNode('calendar-node', data, { id: 'cal' }),
        ctx: { ...ctx, calendarBookings: [bookingOn(day, '09:00 - 09:30'), bookingOn(day, '09:30 - 10:00', { nodeId: 'other' })] },
      };
      const ui: any = (await new CalendarHandler().handle(node, state)).uiState;
      const entry = ui.availableSlots.find((d: any) => d.date === day);
      expect(entry).toEqual({ date: day, times: ['09:00', '09:30'], booked: ['09:00'] });
      expect(await new CalendarHandler().handleResponse({ date: day, slot: '09:00' }, node, state)).toMatchObject({ type: 'displayUI' });
      expect(state.getAnswer('meeting') ?? null).toBeNull();
      expect(await new CalendarHandler().handleResponse({ date: day, slot: '09:30' }, node, state)).toEqual(NodeResult.delayedProceed(null, 400));
    });

    it('leaves out a day with every slot taken (the node\'s own bookings count too)', async () => {
      const day = ahead(4);
      const node = {
        ...createNode('calendar-node', { ...data, bookings: [bookingOn(day, '09:30 - 10:00')] }, { id: 'cal' }),
        ctx: { ...ctx, calendarBookings: [bookingOn(day, '09:00 - 09:30', { nodeId: 'cal' })] },
      };
      const ui: any = (await new CalendarHandler().handle(node, state)).uiState;
      expect(ui.availableSlots.some((d: any) => d.date === day)).toBe(false);
      expect(ui.availableSlots.some((d: any) => d.date === ahead(5))).toBe(true);
    });

    it('reads bookings on the bot\'s clock, for this node only', () => {
      const bookings = [
        { date: '2026-11-02T21:30:00.000Z', timeSlotSelected: '09:00 - 09:30' }, // 01:30 on the 3rd in Dubai
        { date: '2026-11-03T08:00:00.000Z', timeSlotSelected: '10:00 - 10:30', nodeId: 'cal' },
        { date: '2026-11-03T08:00:00.000Z', timeSlotSelected: '11:00 - 11:30', nodeId: 'x' },
        null,
      ];
      expect(bookedLabels(bookings, { id: 'cal' }, '2026-11-03', 'Asia/Dubai')).toEqual(['09:00 - 09:30', '10:00 - 10:30']);
      expect(bookedLabels(bookings, { id: 'cal' }, '2026-11-02', 'UTC')).toEqual(['09:00 - 09:30']);
      expect(isDayFullyBooked([{ start: '09:00', end: '09:30' }], ['09:00 - 09:30'])).toBe(true);
      expect(isDayFullyBooked([], [])).toBe(false);
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
