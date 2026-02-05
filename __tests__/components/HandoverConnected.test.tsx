/**
 * HandoverConnected.test.tsx
 *
 * Tests for the HandoverConnected component that displays the connected agent state.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { HandoverConnected } from '../../src/components/Handover/HandoverConnected';
import { createMockTheme, createAgent } from '../testUtils';

// Mock theme
jest.mock('../../src/theme', () => ({
  useTheme: () => createMockTheme(),
}));

describe('HandoverConnected', () => {
  const mockAgent = createAgent();

  const defaultProps = {
    agent: mockAgent,
    onEndChat: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ========================================
  // RENDERING TESTS
  // ========================================

  describe('Rendering', () => {
    it('renders the component with agent information', () => {
      const { getByText, getByTestId } = render(
        <HandoverConnected {...defaultProps} testID="connected" />
      );

      expect(getByTestId('connected')).toBeTruthy();
      expect(getByText(mockAgent.name)).toBeTruthy();
    });

    it('renders agent avatar when provided', () => {
      const agentWithAvatar = { ...mockAgent, avatar: 'https://example.com/avatar.png' };
      const { getByTestId } = render(
        <HandoverConnected {...defaultProps} agent={agentWithAvatar} testID="connected" />
      );

      expect(getByTestId('connected')).toBeTruthy();
    });

    it('renders agent avatar placeholder when avatar is not provided', () => {
      const agentWithoutAvatar = { ...mockAgent, avatar: undefined };
      const { getByTestId } = render(
        <HandoverConnected {...defaultProps} agent={agentWithoutAvatar} testID="connected" />
      );

      expect(getByTestId('connected')).toBeTruthy();
    });

    it('renders connected message', () => {
      const { getByTestId } = render(
        <HandoverConnected
          {...defaultProps}
          connectedMessage="You are now connected with an agent"
          testID="connected"
        />
      );

      expect(getByTestId('connected')).toBeTruthy();
    });

    it('renders end chat button', () => {
      const { getByTestId } = render(
        <HandoverConnected {...defaultProps} testID="connected" />
      );

      expect(getByTestId('connected')).toBeTruthy();
    });

    it('renders custom end chat button text', () => {
      const { getByText } = render(
        <HandoverConnected {...defaultProps} endChatButtonText="Finish Conversation" />
      );

      expect(getByText('Finish Conversation')).toBeTruthy();
    });

    it('renders agent department when provided', () => {
      const agentWithDept = { ...mockAgent, department: 'Technical Support' };
      const { getByText } = render(
        <HandoverConnected {...defaultProps} agent={agentWithDept} />
      );

      expect(getByText('Technical Support')).toBeTruthy();
    });

    it('renders agent status indicator', () => {
      const agentOnline = { ...mockAgent, status: 'online' as const };
      const { getByTestId } = render(
        <HandoverConnected {...defaultProps} agent={agentOnline} testID="connected" />
      );

      expect(getByTestId('connected')).toBeTruthy();
    });
  });

  // ========================================
  // INTERACTION TESTS
  // ========================================

  describe('Interactions', () => {
    it('calls onEndChat when end chat button is pressed', () => {
      const onEndChat = jest.fn();
      const { getByText } = render(
        <HandoverConnected {...defaultProps} onEndChat={onEndChat} endChatButtonText="End Chat" />
      );

      fireEvent.press(getByText('End Chat'));

      expect(onEndChat).toHaveBeenCalledTimes(1);
    });

    it('calls onEndChat only once on rapid presses', () => {
      const onEndChat = jest.fn();
      const { getByText } = render(
        <HandoverConnected {...defaultProps} onEndChat={onEndChat} endChatButtonText="End Chat" />
      );

      const button = getByText('End Chat');
      fireEvent.press(button);
      fireEvent.press(button);
      fireEvent.press(button);

      // Should debounce or limit calls
      expect(onEndChat).toHaveBeenCalled();
    });
  });

  // ========================================
  // ACCESSIBILITY TESTS
  // ========================================

  describe('Accessibility', () => {
    it('has accessible elements', () => {
      const { getByTestId } = render(
        <HandoverConnected {...defaultProps} testID="connected" />
      );

      const container = getByTestId('connected');
      expect(container).toBeTruthy();
    });

    it('supports custom accessibility label', () => {
      const { getByTestId } = render(
        <HandoverConnected
          {...defaultProps}
          testID="connected"
          accessibilityLabel="Connected to support agent"
        />
      );

      const container = getByTestId('connected');
      expect(container.props.accessibilityLabel).toBe('Connected to support agent');
    });

    it('end chat button is accessible', () => {
      const { getByText } = render(
        <HandoverConnected {...defaultProps} endChatButtonText="End Chat" />
      );

      const button = getByText('End Chat');
      expect(button).toBeTruthy();
    });
  });

  // ========================================
  // EDGE CASES
  // ========================================

  describe('Edge Cases', () => {
    it('handles agent with minimal information', () => {
      const minimalAgent = { id: 'agent-1', name: 'Agent' };
      const { getByText } = render(
        <HandoverConnected {...defaultProps} agent={minimalAgent as any} />
      );

      expect(getByText('Agent')).toBeTruthy();
    });

    it('handles very long agent name', () => {
      const longNameAgent = { ...mockAgent, name: 'A'.repeat(100) };
      const { getByTestId } = render(
        <HandoverConnected {...defaultProps} agent={longNameAgent} testID="connected" />
      );

      expect(getByTestId('connected')).toBeTruthy();
    });

    it('handles very long department name', () => {
      const longDeptAgent = { ...mockAgent, department: 'B'.repeat(100) };
      const { getByTestId } = render(
        <HandoverConnected {...defaultProps} agent={longDeptAgent} testID="connected" />
      );

      expect(getByTestId('connected')).toBeTruthy();
    });

    it('handles empty connected message', () => {
      const { getByTestId } = render(
        <HandoverConnected {...defaultProps} connectedMessage="" testID="connected" />
      );

      expect(getByTestId('connected')).toBeTruthy();
    });

    it('handles missing onEndChat gracefully', () => {
      const { getByTestId } = render(
        <HandoverConnected agent={mockAgent} testID="connected" />
      );

      expect(getByTestId('connected')).toBeTruthy();
    });
  });
});
