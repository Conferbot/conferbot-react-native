/**
 * Logic Node Handlers Tests
 *
 * condition, boolean-logic, math, variable, random split, jump-to and
 * business hours, with the web widget's rules (conditionEval.ts,
 * logicValues.ts). Whole flows: __tests__/parity/flows.test.ts.
 */
import { ChatState } from '../../src/core/state/ChatState';
import { NodeResult } from '../../src/core/nodes/NodeHandler';
import {
  ConditionEvaluator,
  ConditionHandler,
  BooleanConditionHandler,
  MathOperationHandler,
  RandomPathHandler,
  SetVariableHandler,
  JumpHandler,
  BusinessHoursHandler,
  logicHandlers,
} from '../../src/core/nodes/handlers/LogicNodeHandlers';
import { createNode } from '../testUtils';

describe('Logic Node Handlers', () => {
  let state: ChatState;

  beforeEach(() => {
    state = new ChatState('s', 'b');
    state.saveVariableByName('plan', 'Pro');
    state.saveVariableByName('qty', '1,200');
    state.saveVariableByName('stars', 4);
  });

  const condition = (data: Record<string, any>) => ConditionEvaluator.evaluate(data as any, state);

  describe('condition-node (#36)', () => {
    it('reads leftValue as a variable NAME (bare, ${x} or {x}) and rightValue as typed', () => {
      expect(condition({ leftValue: 'plan', operator: '=', rightValue: 'Pro', customRightValue: true })).toBe(true);
      expect(condition({ leftValue: '${plan}', operator: '=', rightValue: 'Pro', customRightValue: true })).toBe(true);
      expect(condition({ leftValue: '{plan}', operator: '=', rightValue: 'Pro', customRightValue: true })).toBe(true);
    });

    it('is case-sensitive unless caseInsensitive', () => {
      expect(condition({ leftValue: 'plan', operator: '=', rightValue: 'pro', customRightValue: true })).toBe(false);
      expect(condition({ leftValue: 'plan', operator: '=', rightValue: 'pro', customRightValue: true, caseInsensitive: true })).toBe(true);
    });

    it('knows every operator and its aliases; anything else is false', () => {
      const t = (operator: string, rightValue: string, leftValue = 'plan') => condition({ leftValue, operator, rightValue, customRightValue: true });
      expect(t('!=', 'Basic')).toBe(true);
      expect(t('not_equals', 'Pro')).toBe(false);
      expect(t('contains', 'r')).toBe(true);
      expect(t('does not contain', 'x')).toBe(true);
      expect(t('not_contains', 'P')).toBe(false);
      expect(t('starts with', 'P')).toBe(true);
      expect(t('ends_with', 'o')).toBe(true);
      expect(t('matches', '^P.o$')).toBe(true);
      expect(t('matches', '(')).toBe(false);
      expect(t('does_not_match', '^x')).toBe(true);
      expect(t('is_set', '')).toBe(true);
      expect(t('is_not_set', '', 'nobody')).toBe(true);
      expect(t('>', '3', 'stars')).toBe(true);
      expect(t('less_than_or_equal', '4', 'stars')).toBe(true);
      expect(t('>', 'x')).toBe(false);
      expect(t('between', 'x')).toBe(false);
    });

    it('a number left in the variable field is compared as typed; stars read as their number', () => {
      expect(condition({ leftValue: '5', operator: '>', rightValue: '3', customRightValue: true })).toBe(true);
      expect(condition({ leftValue: 'stars', operator: '>', rightValue: '⭐⭐⭐', customRightValue: true })).toBe(true);
    });

    it('true leaves by source-0, false by source-1 (not "true"/"false")', async () => {
      const yes = await new ConditionHandler().handle(createNode('condition-node', { leftValue: 'plan', operator: '=', rightValue: 'Pro', customRightValue: true }), state);
      const no = await new ConditionHandler().handle(createNode('condition-node', { leftValue: 'plan', operator: '=', rightValue: 'Basic', customRightValue: true }), state);
      expect(yes).toEqual(NodeResult.port('source-0'));
      expect(no).toEqual(NodeResult.port('source-1'));
    });

    it('an old {varName, condition, value} node is "" = "": true', async () => {
      expect(await new ConditionHandler().handle(createNode('condition-node', { varName: 'x', condition: '==', value: 'y' }), state)).toEqual(NodeResult.port('source-0'));
    });
  });

  describe('boolean-logic-node', () => {
    it('"no"/"off"/"0" are false; NOT is left and not right', async () => {
      state.saveVariableByName('agree', 'Yes');
      const run = (data: any) => new BooleanConditionHandler().handle(createNode('boolean-logic-node', data), state);
      expect(await run({ leftValue: 'agree', operator: 'AND', rightValue: 'true' })).toEqual(NodeResult.port('source-0'));
      expect(await run({ leftValue: 'agree', operator: 'and', rightValue: 'off' })).toEqual(NodeResult.port('source-1'));
      expect(await run({ leftValue: 'agree', operator: 'NOT', rightValue: '0' })).toEqual(NodeResult.port('source-0'));
    });
  });

  describe('math-operation-node', () => {
    it('saves leftValue op rightValue by name (default math_operations); "/0" gives ""', async () => {
      await new MathOperationHandler().handle(createNode('math-operation-node', { leftValue: 'qty', operator: '*', rightValue: '3', answerVariable: 'total' }, { id: 'm1' }), state);
      await new MathOperationHandler().handle(createNode('math-operation-node', { leftValue: '1', operator: '/', rightValue: '0' }, { id: 'm2' }), state);
      expect(state.getAnswer('total')).toBe(3600);
      expect(state.getAnswer('math_operations')).toBe('');
    });

    it('n = n + 1 counts up without a second entry', async () => {
      state.saveVariableByName('n', 0);
      const step = createNode('math-operation-node', { leftValue: 'n', operator: '+', rightValue: '1', answerVariable: 'n' });
      await new MathOperationHandler().handle(step, state);
      await new MathOperationHandler().handle(step, state);
      expect(state.getAnswerVariables().filter((v) => v.variableName === 'n')).toHaveLength(1);
      expect(state.getAnswer('n')).toBe(2);
    });
  });

  describe('variable-node', () => {
    it('fills {x} in data.value, turns numbers into numbers with isNumber, saves by data.name', async () => {
      await new SetVariableHandler().handle(createNode('variable-node', { name: 'greeting', value: 'Hello {plan}!' }), state);
      await new SetVariableHandler().handle(createNode('variable-node', { name: 'answer', value: '42', isNumber: true }), state);
      expect(state.getAnswer('greeting')).toBe('Hello Pro!');
      expect(state.getAnswer('answer')).toBe(42);
      expect(state.getVariable('answer')).toBe(42);
    });
  });

  describe('random-flow-node', () => {
    const node = (ctx: any) => ({ ...createNode('random-flow-node', { branches: [{ id: 'a', weight: 1 }, { id: 'b', weight: 1 }] }), ctx });
    it('picks a wired branch by weight and leaves by "source-" + its id', async () => {
      const ctx = { edges: () => [{ sourceHandle: 'source-a' }, { sourceHandle: 'source-b' }], random: () => 0.8 };
      expect(await new RandomPathHandler().handle(node(ctx), state)).toEqual(NodeResult.port('source-b'));
    });
    it('no wired branch ends the chat', async () => {
      const ctx = { edges: () => [], random: () => 0.1 };
      expect(await new RandomPathHandler().handle(node(ctx), state)).toEqual(NodeResult.port('__no_path__'));
    });
  });

  describe('jump-to-node', () => {
    it('reads nodeId, then targetNodeId, then jumpTo', async () => {
      expect(await new JumpHandler().handle(createNode('jump-to-node', { nodeId: 'a', targetNodeId: 'b' }))).toEqual(NodeResult.jumpTo('a'));
      expect(await new JumpHandler().handle(createNode('jump-to-node', { nodeId: '', targetNodeId: 'b' }))).toEqual(NodeResult.jumpTo('b'));
      expect(await new JumpHandler().handle(createNode('jump-to-node', { jumpTo: 'c' }))).toEqual(NodeResult.jumpTo('c'));
    });
  });

  describe('business-hours-node', () => {
    const at = (iso: string) => ({ now: () => new Date(iso) });
    const hours = { timezone: 'Asia/Dubai', weeklyHours: [{ dayName: 'Thursday', available: true, slots: [{ start: '09:00', end: '17:00' }] }] };
    it('open on the owner\'s clock -> source-0; an excluded date -> source-1', async () => {
      const open = await new BusinessHoursHandler().handle({ ...createNode('business-hours-node', hours), ctx: at('2026-10-15T10:00:00Z') }, state);
      const closed = await new BusinessHoursHandler().handle(
        { ...createNode('business-hours-node', { ...hours, excludeDates: ['15-10-2026'] }), ctx: at('2026-10-15T10:00:00Z') },
        state
      );
      expect(open).toEqual(NodeResult.port('source-0'));
      expect(closed).toEqual(NodeResult.port('source-1'));
    });
  });

  it('registers the seven logic steps', () => {
    expect(logicHandlers.map((h) => h.nodeType).sort()).toEqual(
      ['boolean-logic-node', 'business-hours-node', 'condition-node', 'jump-to-node', 'math-operation-node', 'random-flow-node', 'variable-node'].sort()
    );
  });
});
