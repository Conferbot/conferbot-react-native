/**
 * LogicNodeHandlers.ts
 *
 * The logic steps: condition, boolean-logic, math-operation, variable,
 * random-flow, jump-to and business-hours. They show nothing and route at
 * once. The rules are the web widget's, ported unchanged in
 * core/flow/logic.ts (handlers/conditionEval.ts, handlers/logicValues.ts);
 * the routing is handlers/logical.ts:
 *
 * - condition / boolean: true leaves by source-0, false by source-1;
 * - business hours: open source-0, closed source-1;
 * - random split: "source-" + the picked branch id (legacy: its position);
 *   no wired branch ends the chat;
 * - math and variable save by name and take the first edge;
 * - jump-to: data.nodeId, else targetNodeId, else jumpTo; a missing target
 *   ends the chat.
 */

import { BaseNodeHandler, NodeResult, NodeHandler } from '../NodeHandler';
import { ChatState } from '../../state/ChatState';
import { NodeHandlerRegistry } from '../NodeHandlerRegistry';
import { LogicNodes } from '../NodeTypes';
import { ctxOf } from '../../flow/context';
import {
  ConditionData,
  NO_PATH,
  booleanResult,
  evaluateCondition,
  isWithinBusinessHours,
  jumpTargetOf,
  mathResult,
  mathVariableName,
  pickRandomHandle,
  variableValue,
} from '../../flow/logic';

/** The operators condition-node understands (web conditionEval.ts). */
export type ComparisonOperator =
  | '='
  | '=='
  | 'equals'
  | '!='
  | 'not_equals'
  | '>'
  | 'greater_than'
  | '<'
  | 'less_than'
  | '>='
  | 'greater_than_or_equal'
  | '<='
  | 'less_than_or_equal'
  | 'contains'
  | 'does not contain'
  | 'not_contains'
  | 'starts with'
  | 'starts_with'
  | 'ends with'
  | 'ends_with'
  | 'matches'
  | 'does not match'
  | 'does_not_match'
  | 'is_set'
  | 'is_not_set';

/** A condition-node's data as the builder saves it. */
export type Condition = ConditionData;

/** A boolean-logic-node's data as the builder saves it. */
export interface BooleanExpression {
  leftValue?: any;
  operator?: 'AND' | 'OR' | 'NOT' | 'XOR' | 'NAND' | 'NOR' | 'XNOR' | string;
  rightValue?: any;
}

/** A variable read the way the web logic steps read it: the answers, first entry by name. */
export const answerLookup = (state: ChatState) => (key: string) =>
  state.hasAnswerVariable(key) ? state.getAnswer(key) : null;

/** Evaluates condition-node data against the answers. */
export class ConditionEvaluator {
  static evaluate(data: Condition, state: ChatState): boolean {
    return evaluateCondition(data, answerLookup(state));
  }
}

/** condition-node: true -> source-0, false -> source-1. */
export class ConditionHandler extends BaseNodeHandler {
  readonly nodeType = LogicNodes.CONDITION;

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    return NodeResult.port(ConditionEvaluator.evaluate(node.data || {}, state) ? 'source-0' : 'source-1');
  }
}

/** boolean-logic-node: "No", "off", "0" and empty are false; true -> source-0. */
export class BooleanConditionHandler extends BaseNodeHandler {
  readonly nodeType = LogicNodes.BOOLEAN_CONDITION;

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    return NodeResult.port(booleanResult(node.data || {}, answerLookup(state)) ? 'source-0' : 'source-1');
  }
}

export type MathOperation = '+' | '-' | '*' | '/';

/** math-operation-node: leftValue op rightValue, saved by name (answerVariable, default "math_operations"). */
export class MathOperationHandler extends BaseNodeHandler {
  readonly nodeType = LogicNodes.MATH_OPERATION;

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const data = node.data || {};
    const result = mathResult(data, answerLookup(state));
    state.saveVariableByName(mathVariableName(data), result, this.getNodeId(node));
    return NodeResult.next();
  }
}

export interface RandomPathOption {
  id: string;
  weight?: number;
}

/** random-flow-node: a wired branch by weight, leaving by "source-" + its id. */
export class RandomPathHandler extends BaseNodeHandler {
  readonly nodeType = LogicNodes.RANDOM_PATH;

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const ctx = ctxOf(node, state);
    const handles = ctx.edges().map((e) => e.sourceHandle);
    const handle = pickRandomHandle(node.data?.branches, handles, ctx.random());
    return NodeResult.port(handle ?? NO_PATH);
  }
}

export interface VariableAssignment {
  name: string;
  value: any;
  isNumber?: boolean;
}

/** variable-node: data.value ({x} filled; a number with isNumber), saved by data.name. */
export class SetVariableHandler extends BaseNodeHandler {
  readonly nodeType = LogicNodes.SET_VARIABLE;

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const data = node.data || {};
    const name = String(data.name ?? '').trim();
    const value = variableValue(data, answerLookup(state));
    if (name) {
      state.saveVariableByName(name, value, this.getNodeId(node));
      state.setVariable(name, value);
    }
    return NodeResult.next();
  }
}

/** jump-to-node: to data.nodeId / targetNodeId / jumpTo; a missing target ends the chat. */
export class JumpHandler extends BaseNodeHandler {
  readonly nodeType = LogicNodes.JUMP;

  async handle(node: Record<string, any>): Promise<NodeResult> {
    return NodeResult.jumpTo(jumpTargetOf(node.data));
  }
}

export interface DaySchedule {
  day?: number;
  dayName?: string;
  available?: boolean;
  slots?: Array<{ start: string; end: string }>;
}

export interface BusinessHoursConfig {
  timezone?: string;
  weeklyHours?: DaySchedule[];
  excludeDays?: string[];
  excludeDates?: string[];
}

/** business-hours-node: open now on the owner's clock -> source-0, closed -> source-1. */
export class BusinessHoursHandler extends BaseNodeHandler {
  readonly nodeType = LogicNodes.BUSINESS_HOURS;

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const open = isWithinBusinessHours(node.data || {}, ctxOf(node, state).now());
    return NodeResult.port(open ? 'source-0' : 'source-1');
  }
}

/**
 * All logic node handlers
 */
export const logicHandlers: NodeHandler[] = [
  new ConditionHandler(),
  new BooleanConditionHandler(),
  new MathOperationHandler(),
  new RandomPathHandler(),
  new SetVariableHandler(),
  new JumpHandler(),
  new BusinessHoursHandler(),
];

export function registerLogicHandlers(registry: NodeHandlerRegistry): void {
  registry.registerAll(logicHandlers);
}
