// @ts-nocheck
/**
 * withAnalyticsTracking.ts
 *
 * Higher-order function to wrap node handlers with analytics tracking.
 * Automatically tracks node visits, exits, and user interactions.
 */

import type { NodeHandler, NodeResult } from '../../core/nodes/NodeHandler';
import type { BaseNode } from '../../core/nodes/NodeTypes';
import type { ChatState } from '../../core/state/ChatState';
import { getAnalyticsService, type NodeExitType } from './index';

// ========================================
// TYPES
// ========================================

export interface AnalyticsTrackingOptions {
  /** Whether to track node visits (default: true) */
  trackVisits?: boolean;
  /** Whether to track node exits (default: true) */
  trackExits?: boolean;
  /** Whether to track user responses (default: true) */
  trackResponses?: boolean;
  /** Custom properties to include with events */
  customProperties?: (node: BaseNode, state: ChatState) => Record<string, any>;
}

// ========================================
// WRAPPER FUNCTION
// ========================================

/**
 * Wraps a node handler with analytics tracking.
 * Automatically tracks node entry, exit, and user responses.
 *
 * @example
 * ```typescript
 * const handler = withAnalyticsTracking(new TextInputHandler(), {
 *   trackVisits: true,
 *   trackExits: true,
 * });
 * ```
 */
export function withAnalyticsTracking<T extends NodeHandler>(
  handler: T,
  options: AnalyticsTrackingOptions = {}
): T {
  const {
    trackVisits = true,
    trackExits = true,
    trackResponses = true,
    customProperties,
  } = options;

  const analytics = getAnalyticsService();

  // Create a proxy to intercept handler methods
  return new Proxy(handler, {
    get(target, prop: keyof NodeHandler) {
      const original = target[prop];

      // Wrap the handle method
      if (prop === 'handle' && typeof original === 'function') {
        return async function (node: BaseNode, state: ChatState): Promise<NodeResult> {
          // Track node entry
          if (trackVisits && analytics.initialized) {
            const nodeName = node.data?.label || node.data?.title || node.id;
            analytics.trackNodeEntry(node.id, node.type, nodeName);

            // Track custom properties if provided
            if (customProperties) {
              const props = customProperties(node, state);
              analytics.trackEvent('node_custom_data', {
                nodeId: node.id,
                nodeType: node.type,
                ...props,
              });
            }
          }

          try {
            // Call original handler
            const result = await (original as any).call(target, node, state);

            // Track based on result type
            if (trackExits && analytics.initialized) {
              if (result.type === 'proceed' || result.type === 'delayedProceed') {
                // Don't track exit here - wait for actual exit
                // The next node entry will trigger the exit of this node
              } else if (result.type === 'error') {
                analytics.trackNodeExit('error');
              }
            }

            return result;
          } catch (error) {
            // Track error exit
            if (trackExits && analytics.initialized) {
              analytics.trackNodeExit('error');
            }
            throw error;
          }
        };
      }

      // Wrap the handleResponse method
      if (prop === 'handleResponse' && typeof original === 'function') {
        return async function (
          response: any,
          node: BaseNode,
          state: ChatState
        ): Promise<NodeResult> {
          // Track user response
          if (trackResponses && analytics.initialized) {
            const responseType = typeof response;
            let exitType: NodeExitType = 'proceeded';
            let userInput: string | undefined;
            let selectedOption: string | undefined;

            // Determine response details
            if (responseType === 'string') {
              userInput = response;
            } else if (responseType === 'object' && response !== null) {
              if (response.text) {
                userInput = response.text;
              }
              if (response.selectedOption || response.choice || response.value) {
                selectedOption = response.selectedOption || response.choice || response.value;
              }
              if (response.skipped) {
                exitType = 'skipped';
              }
              if (response.back || response.goBack) {
                exitType = 'back_pressed';
              }
            }

            analytics.trackNodeExit(exitType, userInput, selectedOption);

            // Track specific interaction types
            if (selectedOption) {
              analytics.trackChoiceSelect(selectedOption, selectedOption);
            }
          }

          // Call original handler
          return (original as any).call(target, response, node, state);
        };
      }

      return original;
    },
  });
}

// ========================================
// HELPER FUNCTIONS FOR MANUAL TRACKING
// ========================================

/**
 * Track a button click in a node component
 */
export function trackNodeButtonClick(
  nodeId: string,
  buttonId: string,
  buttonLabel?: string
): void {
  const analytics = getAnalyticsService();
  if (analytics.initialized) {
    analytics.trackButtonClick(buttonId, buttonLabel);
  }
}

/**
 * Track a link click in a node component
 */
export function trackNodeLinkClick(nodeId: string, url: string): void {
  const analytics = getAnalyticsService();
  if (analytics.initialized) {
    analytics.trackLinkClick(url);
  }
}

/**
 * Track a file upload in a node component
 */
export function trackNodeFileUpload(
  nodeId: string,
  fileName: string,
  fileType: string,
  fileSize?: number
): void {
  const analytics = getAnalyticsService();
  if (analytics.initialized) {
    analytics.trackFileUpload(fileName, fileType, fileSize);
  }
}

/**
 * Track carousel interaction in a node component
 */
export function trackNodeCarouselInteraction(
  nodeId: string,
  action: 'swipe' | 'click',
  itemIndex: number
): void {
  const analytics = getAnalyticsService();
  if (analytics.initialized) {
    analytics.trackCarouselInteraction(action, itemIndex);
  }
}

/**
 * Track goal completion from a node
 */
export function trackNodeGoalCompletion(
  nodeId: string,
  goalId: string,
  conversionEvent?: string,
  conversionValue?: number
): void {
  const analytics = getAnalyticsService();
  if (analytics.initialized) {
    analytics.trackGoalCompletion(goalId, conversionEvent, conversionValue);
  }
}

export default withAnalyticsTracking;
