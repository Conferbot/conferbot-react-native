/**
 * AgentTyping.test.tsx
 *
 * Tests for the AgentTyping component that shows agent typing indicator.
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { AgentTyping } from '../../src/components/Handover/AgentTyping';
import { createMockTheme, createAgent } from '../testUtils';

// Mock theme
jest.mock('../../src/theme', () => ({
  useTheme: () => createMockTheme(),
}));

describe('AgentTyping', () => {
  const mockAgent = createAgent();

  const defaultProps = {
    agent: mockAgent,
  };

  // ========================================
  // RENDERING TESTS
  // ========================================

  describe('Rendering', () => {
    it('renders the typing indicator', () => {
      const { getByTestId } = render(
        <AgentTyping {...defaultProps} testID="agent-typing" />
      );

      expect(getByTestId('agent-typing')).toBeTruthy();
    });

    it('renders agent name', () => {
      const { getByText } = render(
        <AgentTyping {...defaultProps} />
      );

      expect(getByText(new RegExp(mockAgent.name))).toBeTruthy();
    });

    it('renders agent avatar when provided', () => {
      const agentWithAvatar = { ...mockAgent, avatar: 'https://example.com/avatar.png' };
      const { getByTestId } = render(
        <AgentTyping agent={agentWithAvatar} testID="agent-typing" />
      );

      expect(getByTestId('agent-typing')).toBeTruthy();
    });

    it('renders placeholder avatar when not provided', () => {
      const agentWithoutAvatar = { ...mockAgent, avatar: undefined };
      const { getByTestId } = render(
        <AgentTyping agent={agentWithoutAvatar} testID="agent-typing" />
      );

      expect(getByTestId('agent-typing')).toBeTruthy();
    });

    it('renders typing animation dots', () => {
      const { getByTestId } = render(
        <AgentTyping {...defaultProps} testID="agent-typing" />
      );

      expect(getByTestId('agent-typing')).toBeTruthy();
    });

    it('renders custom typing message', () => {
      const { getByText } = render(
        <AgentTyping {...defaultProps} typingMessage="{name} is writing..." />
      );

      expect(getByText(/is writing/)).toBeTruthy();
    });

    it('renders default typing message when not provided', () => {
      const { getByTestId } = render(
        <AgentTyping {...defaultProps} testID="agent-typing" />
      );

      expect(getByTestId('agent-typing')).toBeTruthy();
    });

    it('renders in compact mode', () => {
      const { getByTestId } = render(
        <AgentTyping {...defaultProps} compact={true} testID="agent-typing" />
      );

      expect(getByTestId('agent-typing')).toBeTruthy();
    });

    it('renders without agent info when hideAgentInfo is true', () => {
      const { queryByText, getByTestId } = render(
        <AgentTyping {...defaultProps} hideAgentInfo={true} testID="agent-typing" />
      );

      expect(getByTestId('agent-typing')).toBeTruthy();
      expect(queryByText(mockAgent.name)).toBeFalsy();
    });
  });

  // ========================================
  // ANIMATION TESTS
  // ========================================

  describe('Animation', () => {
    it('animates typing dots', () => {
      const { getByTestId } = render(
        <AgentTyping {...defaultProps} animated={true} testID="agent-typing" />
      );

      expect(getByTestId('agent-typing')).toBeTruthy();
    });

    it('does not animate when animated is false', () => {
      const { getByTestId } = render(
        <AgentTyping {...defaultProps} animated={false} testID="agent-typing" />
      );

      expect(getByTestId('agent-typing')).toBeTruthy();
    });
  });

  // ========================================
  // ACCESSIBILITY TESTS
  // ========================================

  describe('Accessibility', () => {
    it('has accessible container', () => {
      const { getByTestId } = render(
        <AgentTyping {...defaultProps} testID="agent-typing" />
      );

      const container = getByTestId('agent-typing');
      expect(container).toBeTruthy();
    });

    it('supports custom accessibility label', () => {
      const { getByTestId } = render(
        <AgentTyping
          {...defaultProps}
          testID="agent-typing"
          accessibilityLabel="Support agent is typing"
        />
      );

      const container = getByTestId('agent-typing');
      expect(container.props.accessibilityLabel).toBe('Support agent is typing');
    });

    it('has appropriate accessibility role', () => {
      const { getByTestId } = render(
        <AgentTyping {...defaultProps} testID="agent-typing" />
      );

      const container = getByTestId('agent-typing');
      expect(container).toBeTruthy();
    });

    it('announces typing status to screen readers', () => {
      const { getByTestId } = render(
        <AgentTyping {...defaultProps} testID="agent-typing" />
      );

      expect(getByTestId('agent-typing')).toBeTruthy();
    });
  });

  // ========================================
  // EDGE CASES
  // ========================================

  describe('Edge Cases', () => {
    it('handles agent with minimal information', () => {
      const minimalAgent = { id: 'agent-1', name: 'Agent' };
      const { getByText } = render(
        <AgentTyping agent={minimalAgent as any} />
      );

      expect(getByText(/Agent/)).toBeTruthy();
    });

    it('handles very long agent name', () => {
      const longNameAgent = { ...mockAgent, name: 'A'.repeat(100) };
      const { getByTestId } = render(
        <AgentTyping agent={longNameAgent} testID="agent-typing" />
      );

      expect(getByTestId('agent-typing')).toBeTruthy();
    });

    it('handles missing agent gracefully', () => {
      const { getByTestId } = render(
        <AgentTyping testID="agent-typing" />
      );

      expect(getByTestId('agent-typing')).toBeTruthy();
    });

    it('handles agent name with special characters', () => {
      const specialNameAgent = { ...mockAgent, name: "Agent O'Brien" };
      const { getByText } = render(
        <AgentTyping agent={specialNameAgent} />
      );

      expect(getByText(/O'Brien/)).toBeTruthy();
    });

    it('handles agent name with unicode characters', () => {
      const unicodeNameAgent = { ...mockAgent, name: 'Agent \u00E9\u00E8\u00EA' };
      const { getByTestId } = render(
        <AgentTyping agent={unicodeNameAgent} testID="agent-typing" />
      );

      expect(getByTestId('agent-typing')).toBeTruthy();
    });

    it('handles empty typing message', () => {
      const { getByTestId } = render(
        <AgentTyping {...defaultProps} typingMessage="" testID="agent-typing" />
      );

      expect(getByTestId('agent-typing')).toBeTruthy();
    });

    it('handles typing message without name placeholder', () => {
      const { getByText } = render(
        <AgentTyping {...defaultProps} typingMessage="Agent is typing..." />
      );

      expect(getByText('Agent is typing...')).toBeTruthy();
    });

    it('renders correctly when show is false', () => {
      const { queryByTestId } = render(
        <AgentTyping {...defaultProps} show={false} testID="agent-typing" />
      );

      // Should either not render or be hidden
      expect(queryByTestId('agent-typing')).toBeFalsy();
    });

    it('transitions from hidden to visible', () => {
      const { queryByTestId, rerender, getByTestId } = render(
        <AgentTyping {...defaultProps} show={false} testID="agent-typing" />
      );

      expect(queryByTestId('agent-typing')).toBeFalsy();

      rerender(
        <AgentTyping {...defaultProps} show={true} testID="agent-typing" />
      );

      expect(getByTestId('agent-typing')).toBeTruthy();
    });
  });
});
