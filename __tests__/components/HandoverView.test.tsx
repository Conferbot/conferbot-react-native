/**
 * HandoverView.test.tsx
 *
 * Tests for the HandoverView component which orchestrates the human handover flow.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { HandoverView } from '../../src/components/Handover/HandoverView';
import { createMockTheme, createAgent } from '../testUtils';
import type { HandoverStage } from '../../src/components/Handover/types';

// Mock theme
jest.mock('../../src/theme', () => ({
  useTheme: () => createMockTheme(),
}));

// Mock child components
jest.mock('../../src/components/Handover/PreChatForm', () => ({
  PreChatForm: ({ onSubmit, testID }: any) => {
    const { TouchableOpacity, Text } = require('react-native');
    return (
      <TouchableOpacity testID={testID || 'pre-chat-form'} onPress={() => onSubmit({ name: 'Test', email: 'test@test.com' })}>
        <Text>PreChatForm</Text>
      </TouchableOpacity>
    );
  },
}));

jest.mock('../../src/components/Handover/HandoverWaiting', () => ({
  HandoverWaiting: ({ onCancel, testID }: any) => {
    const { TouchableOpacity, Text } = require('react-native');
    return (
      <TouchableOpacity testID={testID || 'handover-waiting'} onPress={onCancel}>
        <Text>HandoverWaiting</Text>
      </TouchableOpacity>
    );
  },
}));

jest.mock('../../src/components/Handover/HandoverConnected', () => ({
  HandoverConnected: ({ onEndChat, testID }: any) => {
    const { TouchableOpacity, Text } = require('react-native');
    return (
      <TouchableOpacity testID={testID || 'handover-connected'} onPress={onEndChat}>
        <Text>HandoverConnected</Text>
      </TouchableOpacity>
    );
  },
}));

jest.mock('../../src/components/Handover/AgentTyping', () => ({
  AgentTyping: ({ testID }: any) => {
    const { View, Text } = require('react-native');
    return (
      <View testID={testID || 'agent-typing'}>
        <Text>AgentTyping</Text>
      </View>
    );
  },
}));

jest.mock('../../src/components/Handover/HandoverError', () => ({
  HandoverError: ({ onRetry, onCancel, testID }: any) => {
    const { View, TouchableOpacity, Text } = require('react-native');
    return (
      <View testID={testID || 'handover-error'}>
        <TouchableOpacity testID="retry-button" onPress={onRetry}>
          <Text>Retry</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="cancel-button" onPress={onCancel}>
          <Text>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  },
}));

jest.mock('../../src/components/Handover/PostChatSurvey', () => ({
  PostChatSurvey: ({ onSubmit, onSkip, testID }: any) => {
    const { View, TouchableOpacity, Text } = require('react-native');
    return (
      <View testID={testID || 'post-chat-survey'}>
        <TouchableOpacity testID="submit-survey" onPress={() => onSubmit({ rating: 5 })}>
          <Text>Submit</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="skip-survey" onPress={onSkip}>
          <Text>Skip</Text>
        </TouchableOpacity>
      </View>
    );
  },
}));

describe('HandoverView', () => {
  const defaultProps = {
    nodeId: 'node-123',
    stage: 'waiting' as HandoverStage,
  };

  const mockAgent = createAgent();

  const mockPreChatConfig = {
    enabled: true,
    fields: [
      { id: 'name', label: 'Name', type: 'text' as const, required: true },
      { id: 'email', label: 'Email', type: 'email' as const, required: true },
    ],
  };

  const mockSurveyConfig = {
    enabled: true,
    title: 'How was your experience?',
    ratingEnabled: true,
    commentEnabled: true,
  };

  const mockQueueInfo = {
    position: 2,
    estimatedWaitTime: 120,
  };

  // ========================================
  // RENDERING TESTS
  // ========================================

  describe('Rendering', () => {
    it('renders PreChatForm when stage is pre_chat', () => {
      const { getByTestId, getByText } = render(
        <HandoverView
          {...defaultProps}
          stage="pre_chat"
          preChatConfig={mockPreChatConfig}
        />
      );

      expect(getByTestId('pre-chat-form')).toBeTruthy();
      expect(getByText('PreChatForm')).toBeTruthy();
    });

    it('renders HandoverWaiting when stage is waiting', () => {
      const { getByTestId, getByText } = render(
        <HandoverView {...defaultProps} stage="waiting" queueInfo={mockQueueInfo} />
      );

      expect(getByTestId('handover-waiting')).toBeTruthy();
      expect(getByText('HandoverWaiting')).toBeTruthy();
    });

    it('renders HandoverWaiting when stage is connecting', () => {
      const { getByTestId } = render(
        <HandoverView {...defaultProps} stage="connecting" />
      );

      expect(getByTestId('handover-waiting')).toBeTruthy();
    });

    it('renders HandoverConnected when stage is connected', () => {
      const { getByTestId, getByText } = render(
        <HandoverView {...defaultProps} stage="connected" agent={mockAgent} />
      );

      expect(getByTestId('handover-connected')).toBeTruthy();
      expect(getByText('HandoverConnected')).toBeTruthy();
    });

    it('renders AgentTyping when stage is agent_typing', () => {
      const { getByTestId, getByText } = render(
        <HandoverView {...defaultProps} stage="agent_typing" agent={mockAgent} isAgentTyping={true} />
      );

      expect(getByTestId('agent-typing')).toBeTruthy();
      expect(getByText('AgentTyping')).toBeTruthy();
    });

    it('renders HandoverError when stage is error', () => {
      const { getByTestId } = render(
        <HandoverView {...defaultProps} stage="error" errorMessage="Connection failed" />
      );

      expect(getByTestId('handover-error')).toBeTruthy();
    });

    it('renders HandoverError when stage is no_agents', () => {
      const { getByTestId } = render(
        <HandoverView {...defaultProps} stage="no_agents" />
      );

      expect(getByTestId('handover-error')).toBeTruthy();
    });

    it('renders HandoverError when stage is timeout', () => {
      const { getByTestId } = render(
        <HandoverView {...defaultProps} stage="timeout" />
      );

      expect(getByTestId('handover-error')).toBeTruthy();
    });

    it('renders PostChatSurvey when stage is post_chat', () => {
      const { getByTestId, getByText } = render(
        <HandoverView
          {...defaultProps}
          stage="post_chat"
          surveyConfig={mockSurveyConfig}
        />
      );

      expect(getByTestId('post-chat-survey')).toBeTruthy();
      expect(getByText('Submit')).toBeTruthy();
    });

    it('renders ended state message when stage is ended', () => {
      const { getByTestId } = render(
        <HandoverView {...defaultProps} stage="ended" endedMessage="Chat has ended" />
      );

      expect(getByTestId('handover-view')).toBeTruthy();
    });

    it('applies custom testID', () => {
      const { getByTestId } = render(
        <HandoverView {...defaultProps} testID="custom-handover" />
      );

      expect(getByTestId('custom-handover')).toBeTruthy();
    });
  });

  // ========================================
  // INTERACTION TESTS
  // ========================================

  describe('Interactions', () => {
    it('calls onPreChatSubmit when PreChatForm is submitted', () => {
      const onPreChatSubmit = jest.fn();
      const { getByTestId } = render(
        <HandoverView
          {...defaultProps}
          stage="pre_chat"
          preChatConfig={mockPreChatConfig}
          onPreChatSubmit={onPreChatSubmit}
        />
      );

      fireEvent.press(getByTestId('pre-chat-form'));

      expect(onPreChatSubmit).toHaveBeenCalledWith({ name: 'Test', email: 'test@test.com' });
    });

    it('calls onCancel when waiting is cancelled', () => {
      const onCancel = jest.fn();
      const { getByTestId } = render(
        <HandoverView {...defaultProps} stage="waiting" onCancel={onCancel} />
      );

      fireEvent.press(getByTestId('handover-waiting'));

      expect(onCancel).toHaveBeenCalled();
    });

    it('calls onEndChat when connected chat is ended', () => {
      const onEndChat = jest.fn();
      const { getByTestId } = render(
        <HandoverView
          {...defaultProps}
          stage="connected"
          agent={mockAgent}
          onEndChat={onEndChat}
        />
      );

      fireEvent.press(getByTestId('handover-connected'));

      expect(onEndChat).toHaveBeenCalled();
    });

    it('calls onRetry when error retry is pressed', () => {
      const onRetry = jest.fn();
      const { getByTestId } = render(
        <HandoverView {...defaultProps} stage="error" onRetry={onRetry} />
      );

      fireEvent.press(getByTestId('retry-button'));

      expect(onRetry).toHaveBeenCalled();
    });

    it('calls onCancel when error cancel is pressed', () => {
      const onCancel = jest.fn();
      const { getByTestId } = render(
        <HandoverView {...defaultProps} stage="error" onCancel={onCancel} />
      );

      fireEvent.press(getByTestId('cancel-button'));

      expect(onCancel).toHaveBeenCalled();
    });

    it('calls onSurveySubmit when survey is submitted', () => {
      const onSurveySubmit = jest.fn();
      const { getByTestId } = render(
        <HandoverView
          {...defaultProps}
          stage="post_chat"
          surveyConfig={mockSurveyConfig}
          onSurveySubmit={onSurveySubmit}
        />
      );

      fireEvent.press(getByTestId('submit-survey'));

      expect(onSurveySubmit).toHaveBeenCalledWith({ rating: 5 });
    });

    it('calls onSurveySkip when survey is skipped', () => {
      const onSurveySkip = jest.fn();
      const { getByTestId } = render(
        <HandoverView
          {...defaultProps}
          stage="post_chat"
          surveyConfig={mockSurveyConfig}
          onSurveySkip={onSurveySkip}
        />
      );

      fireEvent.press(getByTestId('skip-survey'));

      expect(onSurveySkip).toHaveBeenCalled();
    });
  });

  // ========================================
  // ACCESSIBILITY TESTS
  // ========================================

  describe('Accessibility', () => {
    it('has accessible container', () => {
      const { getByTestId } = render(
        <HandoverView {...defaultProps} testID="handover-view" />
      );

      const container = getByTestId('handover-view');
      expect(container).toBeTruthy();
    });

    it('supports custom accessibility label', () => {
      const { getByTestId } = render(
        <HandoverView
          {...defaultProps}
          testID="handover-view"
          accessibilityLabel="Human agent handover"
        />
      );

      const container = getByTestId('handover-view');
      expect(container.props.accessibilityLabel).toBe('Human agent handover');
    });
  });

  // ========================================
  // EDGE CASES
  // ========================================

  describe('Edge Cases', () => {
    it('handles missing agent in connected state gracefully', () => {
      const { getByTestId } = render(
        <HandoverView {...defaultProps} stage="connected" />
      );

      expect(getByTestId('handover-connected')).toBeTruthy();
    });

    it('handles missing preChatConfig in pre_chat stage', () => {
      const { getByTestId } = render(
        <HandoverView {...defaultProps} stage="pre_chat" />
      );

      expect(getByTestId('pre-chat-form')).toBeTruthy();
    });

    it('handles missing surveyConfig in post_chat stage', () => {
      const { getByTestId } = render(
        <HandoverView {...defaultProps} stage="post_chat" />
      );

      expect(getByTestId('post-chat-survey')).toBeTruthy();
    });

    it('handles missing queueInfo in waiting stage', () => {
      const { getByTestId } = render(
        <HandoverView {...defaultProps} stage="waiting" />
      );

      expect(getByTestId('handover-waiting')).toBeTruthy();
    });

    it('handles all error-type stages', () => {
      const errorStages: HandoverStage[] = ['error', 'no_agents', 'timeout'];

      errorStages.forEach((stage) => {
        const { getByTestId, unmount } = render(
          <HandoverView {...defaultProps} stage={stage} />
        );
        expect(getByTestId('handover-error')).toBeTruthy();
        unmount();
      });
    });
  });
});
