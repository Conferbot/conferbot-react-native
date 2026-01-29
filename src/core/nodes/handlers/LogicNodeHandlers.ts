/**
 * LogicNodeHandlers.ts
 *
 * Handlers for all Logic node types in the Conferbot React Native SDK.
 * Includes condition evaluation, math operations, variable management,
 * random path selection, jumps, and business hours checking.
 */

import { BaseNodeHandler, NodeResult, NodeUIState } from '../NodeHandler';
import { ChatState } from '../../state/ChatState';
import { NodeHandlerRegistry } from '../NodeHandlerRegistry';

// ========================================
// CONDITION EVALUATOR HELPER
// ========================================

/**
 * Supported comparison operators for condition evaluation
 */
export type ComparisonOperator =
  | 'equals'
  | 'notEquals'
  | 'contains'
  | 'startsWith'
  | 'endsWith'
  | 'greaterThan'
  | 'lessThan'
  | 'greaterThanOrEquals'
  | 'lessThanOrEquals'
  | 'isEmpty'
  | 'isNotEmpty'
  | 'matches'
  | 'in'
  | 'notIn';

/**
 * Condition definition for evaluation
 */
export interface Condition {
  variable: string;
  operator: ComparisonOperator;
  value?: any;
}

/**
 * Boolean expression combining multiple conditions
 */
export interface BooleanExpression {
  logic: 'AND' | 'OR';
  conditions: Array<Condition | BooleanExpression>;
}

/**
 * Helper class for evaluating conditions against state variables
 */
export class ConditionEvaluator {
  /**
   * Evaluates a single condition comparing two values
   * @param leftValue The value from state
   * @param operator The comparison operator
   * @param rightValue The value to compare against
   * @returns The result of the comparison
   */
  static evaluate(leftValue: any, operator: string, rightValue: any): boolean {
    // Handle null/undefined specially for isEmpty/isNotEmpty
    if (operator === 'isEmpty') {
      return ConditionEvaluator.isEmpty(leftValue);
    }

    if (operator === 'isNotEmpty') {
      return !ConditionEvaluator.isEmpty(leftValue);
    }

    // Normalize values for comparison
    const left = ConditionEvaluator.normalizeValue(leftValue);
    const right = ConditionEvaluator.normalizeValue(rightValue);

    switch (operator) {
      case 'equals':
        return ConditionEvaluator.equals(left, right);

      case 'notEquals':
        return !ConditionEvaluator.equals(left, right);

      case 'contains':
        return ConditionEvaluator.contains(left, right);

      case 'startsWith':
        return ConditionEvaluator.startsWith(left, right);

      case 'endsWith':
        return ConditionEvaluator.endsWith(left, right);

      case 'greaterThan':
        return ConditionEvaluator.greaterThan(left, right);

      case 'lessThan':
        return ConditionEvaluator.lessThan(left, right);

      case 'greaterThanOrEquals':
        return ConditionEvaluator.greaterThan(left, right) || ConditionEvaluator.equals(left, right);

      case 'lessThanOrEquals':
        return ConditionEvaluator.lessThan(left, right) || ConditionEvaluator.equals(left, right);

      case 'matches':
        return ConditionEvaluator.matches(left, right);

      case 'in':
        return ConditionEvaluator.isIn(left, right);

      case 'notIn':
        return !ConditionEvaluator.isIn(left, right);

      default:
        console.warn(`[ConditionEvaluator] Unknown operator: ${operator}`);
        return false;
    }
  }

  /**
   * Evaluates a boolean expression (AND/OR logic with multiple conditions)
   * @param expression The expression to evaluate
   * @param state The chat state for variable resolution
   * @returns The result of evaluating the expression
   */
  static evaluateExpression(
    expression: string | BooleanExpression | Condition,
    state: ChatState
  ): boolean {
    // Handle string expressions (simple variable reference or literal)
    if (typeof expression === 'string') {
      return ConditionEvaluator.evaluateStringExpression(expression, state);
    }

    // Handle single condition
    if (ConditionEvaluator.isCondition(expression)) {
      return ConditionEvaluator.evaluateCondition(expression, state);
    }

    // Handle boolean expression with AND/OR logic
    if (ConditionEvaluator.isBooleanExpression(expression)) {
      return ConditionEvaluator.evaluateBooleanExpression(expression, state);
    }

    console.warn('[ConditionEvaluator] Invalid expression format');
    return false;
  }

  /**
   * Evaluates a single condition against state
   */
  static evaluateCondition(condition: Condition, state: ChatState): boolean {
    const variableValue = ConditionEvaluator.getVariableValue(condition.variable, state);
    return ConditionEvaluator.evaluate(variableValue, condition.operator, condition.value);
  }

  /**
   * Evaluates a boolean expression with AND/OR logic
   */
  private static evaluateBooleanExpression(
    expression: BooleanExpression,
    state: ChatState
  ): boolean {
    const { logic, conditions } = expression;

    if (!conditions || conditions.length === 0) {
      return true;
    }

    if (logic === 'AND') {
      return conditions.every((cond) => ConditionEvaluator.evaluateExpression(cond, state));
    }

    if (logic === 'OR') {
      return conditions.some((cond) => ConditionEvaluator.evaluateExpression(cond, state));
    }

    console.warn(`[ConditionEvaluator] Unknown logic operator: ${logic}`);
    return false;
  }

  /**
   * Evaluates a string expression
   */
  private static evaluateStringExpression(expression: string, state: ChatState): boolean {
    const trimmed = expression.trim();

    // Check for boolean literals
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;

    // Try to resolve as a variable name
    const value = ConditionEvaluator.getVariableValue(trimmed, state);

    // Convert to boolean
    return ConditionEvaluator.toBoolean(value);
  }

  /**
   * Gets a variable value from state
   */
  static getVariableValue(variableName: string, state: ChatState): any {
    // Support dot notation for nested access
    const parts = variableName.split('.');
    let value: any;

    // First, try to get the base variable
    const baseName = parts[0];

    // Check answer variables first
    value = state.getAnswer(baseName);
    if (value === undefined) {
      // Then check general variables
      value = state.getVariable(baseName);
    }
    if (value === undefined) {
      // Then check user metadata
      const metadata = state.getUserMetadata();
      value = metadata[baseName];
    }

    // Handle nested access
    if (parts.length > 1 && value !== null && value !== undefined) {
      for (let i = 1; i < parts.length; i++) {
        if (typeof value === 'object' && value !== null) {
          value = value[parts[i]];
        } else {
          return undefined;
        }
      }
    }

    return value;
  }

  /**
   * Type guard for Condition
   */
  private static isCondition(obj: any): obj is Condition {
    return obj && typeof obj.variable === 'string' && typeof obj.operator === 'string';
  }

  /**
   * Type guard for BooleanExpression
   */
  private static isBooleanExpression(obj: any): obj is BooleanExpression {
    return obj && typeof obj.logic === 'string' && Array.isArray(obj.conditions);
  }

  // ========================================
  // COMPARISON HELPERS
  // ========================================

  /**
   * Normalizes a value for comparison
   */
  private static normalizeValue(value: any): any {
    if (value === null || value === undefined) {
      return value;
    }

    // Trim strings
    if (typeof value === 'string') {
      return value.trim();
    }

    return value;
  }

  /**
   * Checks if a value is empty
   */
  private static isEmpty(value: any): boolean {
    if (value === null || value === undefined) {
      return true;
    }

    if (typeof value === 'string') {
      return value.trim().length === 0;
    }

    if (Array.isArray(value)) {
      return value.length === 0;
    }

    if (typeof value === 'object') {
      return Object.keys(value).length === 0;
    }

    return false;
  }

  /**
   * Checks equality with type coercion
   */
  private static equals(left: any, right: any): boolean {
    // Handle null/undefined
    if (left === null && right === null) return true;
    if (left === undefined && right === undefined) return true;
    if (left === null || left === undefined || right === null || right === undefined) {
      return false;
    }

    // Try numeric comparison if both can be numbers
    const leftNum = parseFloat(String(left));
    const rightNum = parseFloat(String(right));
    if (!isNaN(leftNum) && !isNaN(rightNum)) {
      return leftNum === rightNum;
    }

    // Case-insensitive string comparison
    if (typeof left === 'string' && typeof right === 'string') {
      return left.toLowerCase() === right.toLowerCase();
    }

    // Deep equality for arrays
    if (Array.isArray(left) && Array.isArray(right)) {
      if (left.length !== right.length) return false;
      return left.every((item, index) => ConditionEvaluator.equals(item, right[index]));
    }

    // Loose equality for other types
    return left == right;
  }

  /**
   * Checks if left contains right
   */
  private static contains(left: any, right: any): boolean {
    if (left === null || left === undefined) {
      return false;
    }

    // String contains
    if (typeof left === 'string') {
      const rightStr = String(right ?? '');
      return left.toLowerCase().includes(rightStr.toLowerCase());
    }

    // Array contains
    if (Array.isArray(left)) {
      return left.some((item) => ConditionEvaluator.equals(item, right));
    }

    // Object has key
    if (typeof left === 'object') {
      return String(right) in left;
    }

    return false;
  }

  /**
   * Checks if left starts with right
   */
  private static startsWith(left: any, right: any): boolean {
    if (typeof left !== 'string' || right === null || right === undefined) {
      return false;
    }
    const rightStr = String(right);
    return left.toLowerCase().startsWith(rightStr.toLowerCase());
  }

  /**
   * Checks if left ends with right
   */
  private static endsWith(left: any, right: any): boolean {
    if (typeof left !== 'string' || right === null || right === undefined) {
      return false;
    }
    const rightStr = String(right);
    return left.toLowerCase().endsWith(rightStr.toLowerCase());
  }

  /**
   * Numeric greater than comparison
   */
  private static greaterThan(left: any, right: any): boolean {
    const leftNum = parseFloat(String(left));
    const rightNum = parseFloat(String(right));

    if (isNaN(leftNum) || isNaN(rightNum)) {
      // Fall back to string comparison
      return String(left) > String(right);
    }

    return leftNum > rightNum;
  }

  /**
   * Numeric less than comparison
   */
  private static lessThan(left: any, right: any): boolean {
    const leftNum = parseFloat(String(left));
    const rightNum = parseFloat(String(right));

    if (isNaN(leftNum) || isNaN(rightNum)) {
      // Fall back to string comparison
      return String(left) < String(right);
    }

    return leftNum < rightNum;
  }

  /**
   * Regular expression match
   */
  private static matches(left: any, right: any): boolean {
    if (left === null || left === undefined || right === null || right === undefined) {
      return false;
    }

    try {
      const regex = new RegExp(String(right), 'i');
      return regex.test(String(left));
    } catch (error) {
      console.warn(`[ConditionEvaluator] Invalid regex pattern: ${right}`);
      return false;
    }
  }

  /**
   * Checks if left is in right (array or comma-separated string)
   */
  private static isIn(left: any, right: any): boolean {
    if (left === null || left === undefined) {
      return false;
    }

    let collection: any[];

    if (Array.isArray(right)) {
      collection = right;
    } else if (typeof right === 'string') {
      collection = right.split(',').map((s) => s.trim());
    } else {
      return false;
    }

    return collection.some((item) => ConditionEvaluator.equals(left, item));
  }

  /**
   * Converts a value to boolean
   */
  private static toBoolean(value: any): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') {
      const lower = value.toLowerCase().trim();
      if (lower === 'true' || lower === 'yes' || lower === '1') return true;
      if (lower === 'false' || lower === 'no' || lower === '0' || lower === '') return false;
      return true; // Non-empty string is truthy
    }
    return !!value;
  }
}

// ========================================
// CONDITION HANDLER
// ========================================

/**
 * Handles condition nodes that evaluate conditions against state variables.
 * Routes to different ports based on condition result (true/false).
 */
export class ConditionHandler extends BaseNodeHandler {
  readonly nodeType = 'condition';

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const data = this.getNodeData(node);
    if (!data) {
      return this.createError('Condition node missing data', true);
    }

    try {
      const variable = this.getString(data, 'variable');
      const operator = this.getString(data, 'operator', 'equals') as ComparisonOperator;
      const compareValue = data.value ?? data.compareValue;

      // Get the variable value from state
      const variableValue = ConditionEvaluator.getVariableValue(variable, state);

      // Evaluate the condition
      const result = ConditionEvaluator.evaluate(variableValue, operator, compareValue);

      // Log for debugging
      if (__DEV__) {
        console.log(
          `[ConditionHandler] ${variable} (${variableValue}) ${operator} ${compareValue} = ${result}`
        );
      }

      // Route to appropriate port
      const portName = result ? 'true' : 'false';
      return this.proceedToPort(portName, {
        conditionResult: result,
        evaluatedVariable: variable,
        evaluatedValue: variableValue,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Condition evaluation failed';
      console.error('[ConditionHandler] Error:', message);
      return this.createError(message, true);
    }
  }
}

// ========================================
// BOOLEAN CONDITION HANDLER
// ========================================

/**
 * Handles boolean condition nodes that evaluate multiple conditions with AND/OR logic.
 * Routes to different ports based on combined condition result (true/false).
 */
export class BooleanConditionHandler extends BaseNodeHandler {
  readonly nodeType = 'boolean-condition';

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const data = this.getNodeData(node);
    if (!data) {
      return this.createError('Boolean condition node missing data', true);
    }

    try {
      // Support both expression object and conditions array format
      let result: boolean;

      if (data.expression) {
        // Full expression object
        result = ConditionEvaluator.evaluateExpression(data.expression, state);
      } else if (data.conditions && Array.isArray(data.conditions)) {
        // Conditions array with logic operator
        const logic = (data.logic || 'AND').toUpperCase() as 'AND' | 'OR';
        const expression: BooleanExpression = {
          logic,
          conditions: data.conditions,
        };
        result = ConditionEvaluator.evaluateExpression(expression, state);
      } else {
        // Simple boolean variable check
        const variable = this.getString(data, 'variable');
        if (variable) {
          const value = ConditionEvaluator.getVariableValue(variable, state);
          result = ConditionEvaluator.evaluate(value, 'isNotEmpty', null);
        } else {
          console.warn('[BooleanConditionHandler] No conditions or expression provided');
          result = false;
        }
      }

      // Log for debugging
      if (__DEV__) {
        console.log(`[BooleanConditionHandler] Result: ${result}`);
      }

      // Route to appropriate port
      const portName = result ? 'true' : 'false';
      return this.proceedToPort(portName, {
        conditionResult: result,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Boolean condition evaluation failed';
      console.error('[BooleanConditionHandler] Error:', message);
      return this.createError(message, true);
    }
  }
}

// ========================================
// MATH OPERATION HANDLER
// ========================================

/**
 * Supported math operations
 */
export type MathOperation =
  | 'add'
  | 'subtract'
  | 'multiply'
  | 'divide'
  | 'modulo'
  | 'power'
  | 'round'
  | 'floor'
  | 'ceil'
  | 'abs'
  | 'sqrt'
  | 'min'
  | 'max'
  | 'random';

/**
 * Handles math operation nodes that perform calculations and store results.
 * Supports binary operations (add, subtract, etc.) and unary operations (round, abs, etc.).
 */
export class MathOperationHandler extends BaseNodeHandler {
  readonly nodeType = 'math-operation';

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const data = this.getNodeData(node);
    if (!data) {
      return this.createError('Math operation node missing data', true);
    }

    try {
      const operation = this.getString(data, 'operation', 'add') as MathOperation;
      const resultVariable = this.getString(data, 'resultVariable') || this.getString(data, 'variable');

      if (!resultVariable) {
        return this.createError('Math operation requires a result variable name', true);
      }

      // Get operands
      const operand1 = this.resolveOperand(data.operand1 ?? data.value1 ?? data.left, state);
      const operand2 = this.resolveOperand(data.operand2 ?? data.value2 ?? data.right, state);

      // Perform the operation
      const result = this.performOperation(operation, operand1, operand2);

      // Store the result
      state.setVariable(resultVariable, result);

      // Log for debugging
      if (__DEV__) {
        console.log(
          `[MathOperationHandler] ${operation}(${operand1}, ${operand2}) = ${result} -> ${resultVariable}`
        );
      }

      return this.proceed(node, {
        operation,
        operand1,
        operand2,
        result,
        resultVariable,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Math operation failed';
      console.error('[MathOperationHandler] Error:', message);
      return this.createError(message, true);
    }
  }

  /**
   * Resolves an operand to a number
   */
  private resolveOperand(operand: any, state: ChatState): number {
    if (operand === null || operand === undefined) {
      return 0;
    }

    // If it's a number, use directly
    if (typeof operand === 'number') {
      return operand;
    }

    // If it's a string, try to resolve as variable or parse as number
    if (typeof operand === 'string') {
      // Check if it's a variable reference (starts with $ or {{)
      if (operand.startsWith('$') || operand.startsWith('{{')) {
        const varName = operand.replace(/^\$|\{\{|\}\}/g, '').trim();
        const value = ConditionEvaluator.getVariableValue(varName, state);
        return this.toNumber(value);
      }

      // Check if it's a plain variable name (letters/underscores only)
      if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(operand)) {
        const value = ConditionEvaluator.getVariableValue(operand, state);
        if (value !== undefined) {
          return this.toNumber(value);
        }
      }

      // Parse as number
      return this.toNumber(operand);
    }

    return this.toNumber(operand);
  }

  /**
   * Converts a value to a number
   */
  private toNumber(value: any): number {
    if (typeof value === 'number') {
      return isNaN(value) ? 0 : value;
    }

    const parsed = parseFloat(String(value));
    return isNaN(parsed) ? 0 : parsed;
  }

  /**
   * Performs the math operation
   */
  private performOperation(operation: MathOperation, a: number, b: number): number {
    switch (operation) {
      case 'add':
        return a + b;

      case 'subtract':
        return a - b;

      case 'multiply':
        return a * b;

      case 'divide':
        if (b === 0) {
          console.warn('[MathOperationHandler] Division by zero, returning 0');
          return 0;
        }
        return a / b;

      case 'modulo':
        if (b === 0) {
          console.warn('[MathOperationHandler] Modulo by zero, returning 0');
          return 0;
        }
        return a % b;

      case 'power':
        return Math.pow(a, b);

      case 'round':
        // b is number of decimal places (default 0)
        const places = Math.round(b) || 0;
        const multiplier = Math.pow(10, places);
        return Math.round(a * multiplier) / multiplier;

      case 'floor':
        return Math.floor(a);

      case 'ceil':
        return Math.ceil(a);

      case 'abs':
        return Math.abs(a);

      case 'sqrt':
        return Math.sqrt(a);

      case 'min':
        return Math.min(a, b);

      case 'max':
        return Math.max(a, b);

      case 'random':
        // Generate random number between a (min) and b (max)
        const min = Math.min(a, b);
        const max = Math.max(a, b);
        return min + Math.random() * (max - min);

      default:
        console.warn(`[MathOperationHandler] Unknown operation: ${operation}`);
        return a;
    }
  }
}

// ========================================
// RANDOM PATH HANDLER
// ========================================

/**
 * Path option with weight for random selection
 */
export interface RandomPathOption {
  id: string;
  port?: string;
  weight?: number;
  percentage?: number;
}

/**
 * Handles random path nodes that select a random output port based on weights.
 * Supports multiple paths with configurable percentages/weights.
 */
export class RandomPathHandler extends BaseNodeHandler {
  readonly nodeType = 'random-path';

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const data = this.getNodeData(node);
    if (!data) {
      return this.createError('Random path node missing data', true);
    }

    try {
      const paths = this.getArray<RandomPathOption>(data, 'paths') ||
                    this.getArray<RandomPathOption>(data, 'options');

      if (!paths || paths.length === 0) {
        // No paths defined, try to use default ports
        const portCount = this.getNumber(data, 'portCount', 2);
        return this.selectRandomDefaultPort(portCount);
      }

      // Calculate total weight
      let totalWeight = 0;
      const normalizedPaths = paths.map((path) => {
        const weight = path.weight ?? path.percentage ?? 1;
        totalWeight += weight;
        return { ...path, weight };
      });

      // Generate random number
      let random = Math.random() * totalWeight;

      // Select path based on weight
      for (const path of normalizedPaths) {
        random -= path.weight!;
        if (random <= 0) {
          const portName = path.port || path.id;

          // Log for debugging
          if (__DEV__) {
            console.log(`[RandomPathHandler] Selected path: ${portName}`);
          }

          return this.proceedToPort(portName, {
            selectedPath: portName,
            pathId: path.id,
          });
        }
      }

      // Fallback to last path
      const lastPath = normalizedPaths[normalizedPaths.length - 1];
      const portName = lastPath.port || lastPath.id;
      return this.proceedToPort(portName, {
        selectedPath: portName,
        pathId: lastPath.id,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Random path selection failed';
      console.error('[RandomPathHandler] Error:', message);
      return this.createError(message, true);
    }
  }

  /**
   * Selects a random default port (port_0, port_1, etc.)
   */
  private selectRandomDefaultPort(portCount: number): NodeResult {
    const selectedIndex = Math.floor(Math.random() * portCount);
    const portName = `port_${selectedIndex}`;

    if (__DEV__) {
      console.log(`[RandomPathHandler] Selected default port: ${portName}`);
    }

    return this.proceedToPort(portName, {
      selectedPath: portName,
      selectedIndex,
    });
  }
}

// ========================================
// SET VARIABLE HANDLER
// ========================================

/**
 * Variable assignment definition
 */
export interface VariableAssignment {
  name: string;
  value: any;
  expression?: string;
}

/**
 * Handles set variable nodes that set one or more variables in state.
 * Supports static values, expressions, and variable references.
 */
export class SetVariableHandler extends BaseNodeHandler {
  readonly nodeType = 'set-variable';

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const data = this.getNodeData(node);
    if (!data) {
      return this.createError('Set variable node missing data', true);
    }

    try {
      const setVariables: Record<string, any> = {};

      // Support multiple assignment formats

      // Format 1: Single variable
      if (data.variableName || data.name) {
        const name = data.variableName || data.name;
        const value = this.resolveValue(data.value ?? data.expression, state);
        state.setVariable(name, value);
        setVariables[name] = value;
      }

      // Format 2: Variables array
      if (Array.isArray(data.variables)) {
        for (const assignment of data.variables as VariableAssignment[]) {
          const name = assignment.name;
          if (!name) continue;

          const value = assignment.expression
            ? this.resolveValue(assignment.expression, state)
            : this.resolveValue(assignment.value, state);

          state.setVariable(name, value);
          setVariables[name] = value;
        }
      }

      // Format 3: Assignments object
      if (data.assignments && typeof data.assignments === 'object') {
        for (const [name, value] of Object.entries(data.assignments)) {
          const resolvedValue = this.resolveValue(value, state);
          state.setVariable(name, resolvedValue);
          setVariables[name] = resolvedValue;
        }
      }

      // Log for debugging
      if (__DEV__) {
        console.log('[SetVariableHandler] Set variables:', setVariables);
      }

      return this.proceed(node, {
        setVariables,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Set variable failed';
      console.error('[SetVariableHandler] Error:', message);
      return this.createError(message, true);
    }
  }

  /**
   * Resolves a value which may be an expression or variable reference
   */
  private resolveValue(value: any, state: ChatState): any {
    if (value === null || value === undefined) {
      return value;
    }

    // Handle string values that might be expressions
    if (typeof value === 'string') {
      // Check for variable template syntax {{varName}}
      if (value.includes('{{') && value.includes('}}')) {
        return state.resolveVariables(value);
      }

      // Check for $ prefix variable reference
      if (value.startsWith('$')) {
        const varName = value.substring(1);
        return ConditionEvaluator.getVariableValue(varName, state);
      }

      // Check for simple expression (basic math)
      if (this.isSimpleExpression(value)) {
        return this.evaluateSimpleExpression(value, state);
      }
    }

    // Return value as-is for other types
    return value;
  }

  /**
   * Checks if a string looks like a simple math expression
   */
  private isSimpleExpression(value: string): boolean {
    // Matches patterns like "a + b", "count * 2", etc.
    return /^[\w\$\{\}\.]+\s*[\+\-\*\/\%]\s*[\w\$\{\}\.]+$/.test(value.trim());
  }

  /**
   * Evaluates a simple math expression
   */
  private evaluateSimpleExpression(expression: string, state: ChatState): any {
    try {
      // Parse the expression
      const match = expression.trim().match(/^([\w\$\{\}\.]+)\s*([\+\-\*\/\%])\s*([\w\$\{\}\.]+)$/);
      if (!match) {
        return expression;
      }

      const [, leftStr, operator, rightStr] = match;

      // Resolve operands
      const left = this.resolveOperand(leftStr, state);
      const right = this.resolveOperand(rightStr, state);

      // Perform operation
      switch (operator) {
        case '+':
          // String concatenation if either is non-numeric
          if (typeof left === 'string' || typeof right === 'string') {
            return String(left) + String(right);
          }
          return left + right;
        case '-':
          return left - right;
        case '*':
          return left * right;
        case '/':
          return right !== 0 ? left / right : 0;
        case '%':
          return right !== 0 ? left % right : 0;
        default:
          return expression;
      }
    } catch {
      return expression;
    }
  }

  /**
   * Resolves an operand which might be a variable or literal
   */
  private resolveOperand(operand: string, state: ChatState): any {
    const trimmed = operand.trim();

    // Variable template syntax
    if (trimmed.startsWith('{{') && trimmed.endsWith('}}')) {
      const varName = trimmed.slice(2, -2).trim();
      return ConditionEvaluator.getVariableValue(varName, state) ?? 0;
    }

    // $ prefix
    if (trimmed.startsWith('$')) {
      const varName = trimmed.substring(1);
      return ConditionEvaluator.getVariableValue(varName, state) ?? 0;
    }

    // Try to parse as number
    const num = parseFloat(trimmed);
    if (!isNaN(num)) {
      return num;
    }

    // Try as variable name
    const value = ConditionEvaluator.getVariableValue(trimmed, state);
    if (value !== undefined) {
      return value;
    }

    // Return as string literal
    return trimmed;
  }
}

// ========================================
// JUMP HANDLER
// ========================================

/**
 * Handles jump nodes that redirect flow to a specific target node.
 * Used for creating loops, goto functionality, or flow shortcuts.
 */
export class JumpHandler extends BaseNodeHandler {
  readonly nodeType = 'jump';

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const data = this.getNodeData(node);
    if (!data) {
      return this.createError('Jump node missing data', true);
    }

    try {
      // Get target node ID from various possible properties
      const targetNodeId =
        data.targetNodeId ||
        data.targetId ||
        data.jumpTo ||
        data.goto ||
        data.nodeId;

      if (!targetNodeId) {
        return this.createError('Jump node requires a target node ID', true);
      }

      // Log for debugging
      if (__DEV__) {
        console.log(`[JumpHandler] Jumping to node: ${targetNodeId}`);
      }

      // Track the jump in state (for loop detection)
      const jumpCount = (state.getVariable(`_jumpCount_${targetNodeId}`) || 0) + 1;
      state.setVariable(`_jumpCount_${targetNodeId}`, jumpCount);

      // Prevent infinite loops
      const maxJumps = this.getNumber(data, 'maxJumps', 100);
      if (jumpCount > maxJumps) {
        console.warn(`[JumpHandler] Max jumps (${maxJumps}) exceeded for node ${targetNodeId}`);
        return this.createError(`Maximum jump limit exceeded for node ${targetNodeId}`, true);
      }

      return NodeResult.jumpTo(targetNodeId, {
        jumpCount,
        fromNodeId: this.getNodeId(node),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Jump failed';
      console.error('[JumpHandler] Error:', message);
      return this.createError(message, true);
    }
  }
}

// ========================================
// BUSINESS HOURS HANDLER
// ========================================

/**
 * Day schedule definition
 */
export interface DaySchedule {
  day: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  enabled: boolean;
  openTime?: string; // HH:mm format
  closeTime?: string; // HH:mm format
  breaks?: Array<{
    start: string;
    end: string;
  }>;
}

/**
 * Business hours configuration
 */
export interface BusinessHoursConfig {
  timezone?: string;
  schedules: DaySchedule[];
  holidays?: string[]; // ISO date strings
  overrides?: Array<{
    date: string;
    enabled: boolean;
    openTime?: string;
    closeTime?: string;
  }>;
}

/**
 * Handles business hours nodes that check if current time is within business hours.
 * Supports timezones, multiple schedules, holidays, and overrides.
 */
export class BusinessHoursHandler extends BaseNodeHandler {
  readonly nodeType = 'business-hours';

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const data = this.getNodeData(node);
    if (!data) {
      return this.createError('Business hours node missing data', true);
    }

    try {
      // Get current time in specified timezone
      const timezone = this.getString(data, 'timezone', 'UTC');
      const now = this.getCurrentTime(timezone);
      const dateString = this.formatDate(now);

      // Check for date overrides first
      const overrides = this.getArray<any>(data, 'overrides');
      const override = overrides.find((o) => o.date === dateString);
      if (override) {
        if (!override.enabled) {
          return this.proceedToPort('closed', { reason: 'override', date: dateString });
        }
        if (override.openTime && override.closeTime) {
          const isOpen = this.isTimeInRange(now, override.openTime, override.closeTime);
          return this.proceedToPort(isOpen ? 'open' : 'closed', {
            reason: 'override',
            date: dateString,
          });
        }
      }

      // Check for holidays
      const holidays = this.getArray<string>(data, 'holidays');
      if (holidays.includes(dateString)) {
        return this.proceedToPort('closed', { reason: 'holiday', date: dateString });
      }

      // Get schedule for current day
      const dayOfWeek = now.getDay();
      const schedules = this.getArray<DaySchedule>(data, 'schedules');

      // Find schedule for today
      let schedule = schedules.find((s) => s.day === dayOfWeek);

      // If no specific schedule, try default schedule
      if (!schedule && data.defaultSchedule) {
        schedule = data.defaultSchedule as DaySchedule;
      }

      // If still no schedule, check simplified format
      if (!schedule && data.openTime && data.closeTime) {
        // Check if today is enabled in days array
        const days = this.getArray<number>(data, 'days', [1, 2, 3, 4, 5]); // Default Mon-Fri
        if (!days.includes(dayOfWeek)) {
          return this.proceedToPort('closed', { reason: 'dayOff', day: dayOfWeek });
        }

        schedule = {
          day: dayOfWeek,
          enabled: true,
          openTime: data.openTime,
          closeTime: data.closeTime,
          breaks: data.breaks,
        };
      }

      // No schedule found
      if (!schedule) {
        // Default to closed if no schedule
        return this.proceedToPort('closed', { reason: 'noSchedule', day: dayOfWeek });
      }

      // Check if day is enabled
      if (!schedule.enabled) {
        return this.proceedToPort('closed', { reason: 'dayDisabled', day: dayOfWeek });
      }

      // Check if current time is within open hours
      if (schedule.openTime && schedule.closeTime) {
        const isOpen = this.isTimeInRange(now, schedule.openTime, schedule.closeTime);

        if (!isOpen) {
          return this.proceedToPort('closed', {
            reason: 'outsideHours',
            currentTime: this.formatTime(now),
            openTime: schedule.openTime,
            closeTime: schedule.closeTime,
          });
        }

        // Check for breaks
        if (schedule.breaks && schedule.breaks.length > 0) {
          for (const breakPeriod of schedule.breaks) {
            if (this.isTimeInRange(now, breakPeriod.start, breakPeriod.end)) {
              return this.proceedToPort('closed', {
                reason: 'break',
                breakStart: breakPeriod.start,
                breakEnd: breakPeriod.end,
              });
            }
          }
        }

        // Log for debugging
        if (__DEV__) {
          console.log('[BusinessHoursHandler] Business is OPEN');
        }

        return this.proceedToPort('open', {
          currentTime: this.formatTime(now),
          openTime: schedule.openTime,
          closeTime: schedule.closeTime,
        });
      }

      // No time restrictions, assume open
      return this.proceedToPort('open', { reason: 'noTimeRestriction' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Business hours check failed';
      console.error('[BusinessHoursHandler] Error:', message);
      return this.createError(message, true);
    }
  }

  /**
   * Gets current time in the specified timezone
   */
  private getCurrentTime(timezone: string): Date {
    try {
      // Create a date string in the target timezone
      const now = new Date();
      const options: Intl.DateTimeFormatOptions = {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      };

      const formatter = new Intl.DateTimeFormat('en-US', options);
      const parts = formatter.formatToParts(now);

      const getPart = (type: Intl.DateTimeFormatPartTypes): string => {
        const part = parts.find((p) => p.type === type);
        return part ? part.value : '0';
      };

      const year = parseInt(getPart('year'), 10);
      const month = parseInt(getPart('month'), 10) - 1;
      const day = parseInt(getPart('day'), 10);
      const hour = parseInt(getPart('hour'), 10);
      const minute = parseInt(getPart('minute'), 10);
      const second = parseInt(getPart('second'), 10);

      return new Date(year, month, day, hour, minute, second);
    } catch (error) {
      console.warn(`[BusinessHoursHandler] Invalid timezone: ${timezone}, using local time`);
      return new Date();
    }
  }

  /**
   * Checks if a time is within a range
   */
  private isTimeInRange(date: Date, openTime: string, closeTime: string): boolean {
    const currentMinutes = date.getHours() * 60 + date.getMinutes();
    const openMinutes = this.parseTimeToMinutes(openTime);
    const closeMinutes = this.parseTimeToMinutes(closeTime);

    // Handle overnight schedules (e.g., 22:00 - 06:00)
    if (closeMinutes < openMinutes) {
      return currentMinutes >= openMinutes || currentMinutes < closeMinutes;
    }

    return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
  }

  /**
   * Parses a time string (HH:mm) to minutes since midnight
   */
  private parseTimeToMinutes(time: string): number {
    const parts = time.split(':');
    const hours = parseInt(parts[0], 10) || 0;
    const minutes = parseInt(parts[1], 10) || 0;
    return hours * 60 + minutes;
  }

  /**
   * Formats a date as YYYY-MM-DD
   */
  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Formats a date as HH:mm
   */
  private formatTime(date: Date): string {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }
}

// ========================================
// HANDLER REGISTRATION
// ========================================

/**
 * All logic node handlers
 */
export const logicHandlers = [
  new ConditionHandler(),
  new BooleanConditionHandler(),
  new MathOperationHandler(),
  new RandomPathHandler(),
  new SetVariableHandler(),
  new JumpHandler(),
  new BusinessHoursHandler(),
];

/**
 * Registers all logic node handlers with the registry
 * @param registry The node handler registry
 */
export function registerLogicHandlers(registry: NodeHandlerRegistry): void {
  for (const handler of logicHandlers) {
    registry.register(handler);
  }
}

// ========================================
// EXPORTS
// ========================================

export {
  ConditionHandler,
  BooleanConditionHandler,
  MathOperationHandler,
  RandomPathHandler,
  SetVariableHandler,
  JumpHandler,
  BusinessHoursHandler,
  ConditionEvaluator,
};

// Type declarations for React Native's __DEV__ global
declare const __DEV__: boolean;
