/**
 * AdvancedInputHandlers.ts
 *
 * calendar-node and ask-multiple-questions-node, per the flow-node spec and
 * the web widget (ts/chat/displayStep.ts calendar-node,
 * handlers/askQuestions.ts _handleAskMultipleQuestions*).
 */

import { BaseNodeHandler, NodeResult, NodeUIState, NodeHandler } from '../NodeHandler';
import { ChatState } from '../../state/ChatState';
import { NodeHandlerRegistry } from '../NodeHandlerRegistry';
import { DisplayNodes } from '../NodeTypes';
import { ctxOf } from '../../flow/context';
import { fillVariables } from '../../flow/text';
import { EN, isValidEmail, isValidPhone, normalizePhone, ownerTextOr, phoneErrorText } from '../../flow/inputs';
import {
  dayKeyInZone,
  dayNameInZone,
  expandSlots,
  futureSlots,
  hhmmInZone,
  longDate,
  visitorLocale,
  noonInZone,
  slotLabel,
  visitorTimeZone,
  wallTimeInZone,
} from '../../flow/calendar';
import { botSay, pushAnswer, shownText, typedText, userSay } from './flowKit';

// ========================================
// CALENDAR
// ========================================

/** Days offered ahead of today. */
const CALENDAR_DAYS = 90;

/**
 * calendar-node: a month calendar on the bot's clock (data.timeZone, default
 * UTC). Without time selection the picked day is saved as the visitor's long
 * date ("Tuesday, October 20, 2026"); with it, the day's weeklyHours cut into
 * slotDuration slots, and the saved value names both clocks. Moves on 400 ms
 * after the pick. Answer: {date: "YYYY-MM-DD", slot?: "HH:MM"} (slot start on
 * the bot's clock; `time` is read the same).
 */
export class CalendarHandler extends BaseNodeHandler {
  readonly nodeType = DisplayNodes.CALENDAR;

  private zone(data: any): string {
    return String(data?.timeZone || 'UTC');
  }

  /** A day's bookable slots on the bot's clock. */
  private slotsFor(data: any, dayKey: string, now: Date): ReturnType<typeof expandSlots> {
    const zone = this.zone(data);
    const dayName = dayNameInZone(noonInZone(dayKey, zone), zone);
    const schedule = (Array.isArray(data?.weeklyHours) ? data.weeklyHours : []).find((d: any) => d?.dayName === dayName);
    if (!schedule?.available) return [];
    return futureSlots(expandSlots(schedule.slots, data?.slotDuration, data?.bufferMinutes), dayKey, zone, now);
  }

  private dayOpen(data: any, dayKey: string): boolean {
    const zone = this.zone(data);
    const dayName = dayNameInZone(noonInZone(dayKey, zone), zone);
    const excludedDays = (Array.isArray(data?.excludeDays) ? data.excludeDays : []).map((d: any) => String(d).toLowerCase());
    const excludedDates = Array.isArray(data?.excludeDates) ? data.excludeDates.map(String) : [];
    return !excludedDays.includes(dayName.toLowerCase()) && !excludedDates.includes(dayKey);
  }

  private ui(node: Record<string, any>, state: ChatState): NodeUIState.Calendar {
    const data = node.data || {};
    const zone = this.zone(data);
    const now = new Date();
    const today = dayKeyInZone(now, zone);
    const showTime = !!data.showTimeSelection;
    const availableSlots: NodeUIState.Calendar['availableSlots'] = [];
    if (showTime) {
      for (let i = 0; i < CALENDAR_DAYS; i++) {
        const key = dayKeyInZone(new Date(noonInZone(today, zone).getTime() + i * 86400000), zone);
        if (!this.dayOpen(data, key)) continue;
        const slots = this.slotsFor(data, key, now);
        if (slots.length) availableSlots.push({ date: key, times: slots.map((s) => s.start) });
      }
    }
    return {
      type: 'calendar',
      nodeId: this.getNodeId(node),
      question: shownText(state, data.calendarPrompt),
      variableName: data.answerVariable,
      mode: showTime ? 'datetime' : 'date',
      minDate: data.showPastDates ? undefined : today,
      availableSlots: showTime ? availableSlots : undefined,
      showTimeSlots: showTime,
    };
  }

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const ui = this.ui(node, state);
    botSay(state, ui.question, ui.nodeId, this.nodeType);
    return NodeResult.displayUI(ui);
  }

  async handleResponse(response: any, node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const data = node.data || {};
    const nodeId = this.getNodeId(node);
    const botZone = this.zone(data);
    const visitorZone = ctxOf(node, state).visitorTimeZone || visitorTimeZone();
    const dateString = String(response?.date || response?.selectedDate || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return NodeResult.displayUI(this.ui(node, state));

    const showTime = !!data.showTimeSelection;
    const slotStart = String(response?.slot || response?.time || '').trim();
    const ctx = ctxOf(node, state);

    let value: string;
    let record: Record<string, any>;
    if (!showTime) {
      const botDate = noonInZone(dateString, botZone);
      const visitorDate = noonInZone(dateString, visitorZone);
      const date = longDate(botDate, botZone);
      const localDate = longDate(visitorDate, visitorZone, visitorLocale());
      record = { date: localDate || date, selectedDate: dateString, botTimeZone: botZone, visitorTimeZone: visitorZone, showTimeSelection: false };
      value = localDate || date;
      userSay(state, value, nodeId);
    } else {
      const slots = this.slotsFor(data, dateString, new Date());
      const slot = slots.find((s) => s.start === slotStart);
      if (!slot) return NodeResult.displayUI(this.ui(node, state));
      const botDate = noonInZone(dateString, botZone);
      const visitorDate = noonInZone(dayKeyInZone(botDate, botZone), visitorZone);
      const date = longDate(botDate, botZone);
      const localDate = longDate(visitorDate, visitorZone, visitorLocale());
      const visitorStart = hhmmInZone(wallTimeInZone(dateString, slot.start, botZone), visitorZone);
      const visitorEnd = hhmmInZone(wallTimeInZone(dateString, slot.end, botZone), visitorZone);
      const timeSlotSelected = slotLabel(slot);
      const visitorTime = `${visitorStart} - ${visitorEnd}`;
      record = {
        date: localDate || date,
        selectedDate: botDate.toISOString(),
        botTimeZone: botZone,
        visitorTimeZone: visitorZone,
        showTimeSelection: true,
        timeSlotSelected,
        visitorTime,
      };
      value = `${localDate || date} ${visitorTime} (Visitor's local time) / ${timeSlotSelected} (Bot's time)`;
      userSay(state, `${localDate}, ${visitorTime} (Your local time)`, nodeId);
      ctx.emit('calendar-slot-selection-record', {
        visitorId: state.getVariable('_visitorId') || state.sessionId,
        chatbotId: state.botId,
        nodeId,
        selectedDate: record.selectedDate,
        botTimeZone: botZone,
        visitorTimeZone: visitorZone,
        timeSlotSelected,
        visitorTime,
      });
    }
    pushAnswer(state, { id: nodeId, shape: 'user-calendar-selection', data: record });
    state.setAnswerVariable(nodeId, value);
    return NodeResult.delayedProceed(null, 400);
  }
}

// ========================================
// MULTIPLE QUESTIONS
// ========================================

/**
 * ask-multiple-questions-node: data.message, then each of data.questions in
 * turn after 2000 ms of typing. An "email" answer is checked as an e-mail,
 * "phone" / "mobile" as a phone (saved normalised). Each answer fills the
 * variable registered as nodeId + index and is recorded as
 * "<nodeId>:<questionId>". After the last one, the first edge.
 */
export class MultipleQuestionsHandler extends BaseNodeHandler {
  readonly nodeType = DisplayNodes.ASK_MULTIPLE_QUESTIONS;

  private questions(node: Record<string, any>): any[] {
    return Array.isArray(node.data?.questions) ? node.data.questions : [];
  }

  private indexKey(node: Record<string, any>): string {
    return `_mq_${this.getNodeId(node)}`;
  }

  private ui(node: Record<string, any>, state: ChatState, index: number): NodeUIState.TextInput {
    const q = this.questions(node)[index] || {};
    const variable = String(q.answerVariable || '').toLowerCase();
    const inputType = variable === 'email' ? 'email' : variable === 'phone' || variable === 'mobile' ? 'phone' : 'text';
    return { ...NodeUIState.textInput(this.getNodeId(node), shownText(state, q.questionText), q.answerVariable || '', inputType), awaitInput: true };
  }

  /** Ask question `index` (2000 ms of typing first). */
  private async ask(node: Record<string, any>, state: ChatState, index: number): Promise<NodeResult> {
    const nodeId = this.getNodeId(node);
    const questions = this.questions(node);
    const q = questions[index] || {};
    await ctxOf(node, state).typing(2000);
    state.setVariable(this.indexKey(node), index);
    const label = questions.length > 1 ? `Question ${index + 1} of ${questions.length}\n` : '';
    botSay(state, `${label}${shownText(state, q.questionText)}`, nodeId, this.nodeType);
    state.addRecord({
      _id: `${nodeId}:${q.id ?? index}`,
      id: `${nodeId}:${q.id ?? index}`,
      nodeId,
      questionId: q.id ?? String(index),
      answerVariable: q.answerVariable,
      shape: 'ask-multiple-questions-question',
      type: 'ask-multiple-questions-question',
      questionText: q.questionText,
      renderedText: fillVariables(q.questionText, (k) => state.lookupVariable(k)),
      time: new Date().toISOString(),
    });
    return NodeResult.displayUI(this.ui(node, state, index));
  }

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const nodeId = this.getNodeId(node);
    const message = shownText(state, node.data?.message);
    if (message) botSay(state, message, nodeId, this.nodeType);
    ctxOf(node, state).shown();
    if (!this.questions(node).length) return NodeResult.next();
    return this.ask(node, state, 0);
  }

  async handleResponse(response: any, node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const nodeId = this.getNodeId(node);
    const questions = this.questions(node);
    const index = Number(state.getVariable(this.indexKey(node)) ?? 0);
    const q = questions[index] || {};
    let value = typedText(response);
    if (!value) return NodeResult.displayUI(this.ui(node, state, index));
    const variable = String(q.answerVariable || '');
    if (variable === 'email' && !isValidEmail(value)) {
      return NodeResult.invalid(ownerTextOr(node.data?.incorrectEmailResponse, EN.emailInvalid, ['Please enter a valid email']), this.ui(node, state, index));
    }
    if (variable === 'mobile' || variable === 'phone') {
      if (!isValidPhone(value)) return NodeResult.invalid(phoneErrorText(node.data), this.ui(node, state, index));
      value = normalizePhone(value);
    }
    if (variable === 'name') state.setUserName(value);
    if (variable === 'email') state.setUserEmail(value);
    if (variable === 'phone' || variable === 'mobile') state.setUserPhone(value);

    pushAnswer(state, {
      id: `${nodeId}:${q.id ?? index}`,
      nodeId,
      questionId: q.id ?? String(index),
      answerVariable: q.answerVariable,
      shape: 'user-ask-multiple-questions-question-response',
      type: 'user-ask-multiple-questions-question-response',
      text: value,
    });
    state.setAnswerVariable(`${nodeId}${index}`, value);
    userSay(state, value, nodeId);

    if (index + 1 < questions.length) return this.ask(node, state, index + 1);
    state.deleteVariable(this.indexKey(node));
    return NodeResult.next();
  }
}

// ========================================
// REGISTRATION
// ========================================

export const advancedInputHandlers: NodeHandler[] = [new CalendarHandler(), new MultipleQuestionsHandler()];

export function registerAdvancedInputHandlers(registry: NodeHandlerRegistry): void {
  registry.registerAll(advancedInputHandlers);
}

export default advancedInputHandlers;
