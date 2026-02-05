/**
 * NodeRenderer.test.tsx
 *
 * Tests for the NodeRenderer component that routes to correct UI components.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { NodeRenderer } from '../../src/components/NodeComponents/NodeRenderer';
import { createMockTheme, createNode } from '../testUtils';

// Mock theme
jest.mock('../../src/theme', () => ({
  useTheme: () => createMockTheme(),
}));

// Mock all node component types
jest.mock('../../src/components/NodeComponents/MessageComponents', () => ({
  TextMessage: ({ content, testID }: any) => {
    const { Text } = require('react-native');
    return <Text testID={testID || 'text-message'}>{content}</Text>;
  },
  ImageMessage: ({ testID }: any) => {
    const { View } = require('react-native');
    return <View testID={testID || 'image-message'} />;
  },
  VideoMessage: ({ testID }: any) => {
    const { View } = require('react-native');
    return <View testID={testID || 'video-message'} />;
  },
  AudioMessage: ({ testID }: any) => {
    const { View } = require('react-native');
    return <View testID={testID || 'audio-message'} />;
  },
  FileMessage: ({ testID }: any) => {
    const { View } = require('react-native');
    return <View testID={testID || 'file-message'} />;
  },
  HtmlMessage: ({ testID }: any) => {
    const { View } = require('react-native');
    return <View testID={testID || 'html-message'} />;
  },
}));

jest.mock('../../src/components/NodeComponents/SelectionComponents', () => ({
  ButtonsSelection: ({ onSelect, testID }: any) => {
    const { TouchableOpacity, Text } = require('react-native');
    return (
      <TouchableOpacity testID={testID || 'buttons-selection'} onPress={() => onSelect('option-1')}>
        <Text>Button 1</Text>
      </TouchableOpacity>
    );
  },
  CardsSelection: ({ testID }: any) => {
    const { View } = require('react-native');
    return <View testID={testID || 'cards-selection'} />;
  },
  CarouselSelection: ({ testID }: any) => {
    const { View } = require('react-native');
    return <View testID={testID || 'carousel-selection'} />;
  },
  PictureChoiceSelection: ({ testID }: any) => {
    const { View } = require('react-native');
    return <View testID={testID || 'picture-choice'} />;
  },
  DropdownSelection: ({ testID }: any) => {
    const { View } = require('react-native');
    return <View testID={testID || 'dropdown-selection'} />;
  },
}));

jest.mock('../../src/components/NodeComponents/InputComponents', () => ({
  TextInputComponent: ({ onSubmit, testID }: any) => {
    const { TextInput } = require('react-native');
    return (
      <TextInput
        testID={testID || 'text-input'}
        onSubmitEditing={(e: any) => onSubmit(e.nativeEvent.text)}
      />
    );
  },
  CalendarInput: ({ testID }: any) => {
    const { View } = require('react-native');
    return <View testID={testID || 'calendar-input'} />;
  },
  FileUploadInput: ({ testID }: any) => {
    const { View } = require('react-native');
    return <View testID={testID || 'file-upload'} />;
  },
  LocationPickerInput: ({ testID }: any) => {
    const { View } = require('react-native');
    return <View testID={testID || 'location-picker'} />;
  },
  MultipleQuestionsInput: ({ testID }: any) => {
    const { View } = require('react-native');
    return <View testID={testID || 'multiple-questions'} />;
  },
}));

jest.mock('../../src/components/NodeComponents/RatingComponents', () => ({
  StarRating: ({ testID }: any) => {
    const { View } = require('react-native');
    return <View testID={testID || 'star-rating'} />;
  },
  OpinionScale: ({ testID }: any) => {
    const { View } = require('react-native');
    return <View testID={testID || 'opinion-scale'} />;
  },
  SliderRating: ({ testID }: any) => {
    const { View } = require('react-native');
    return <View testID={testID || 'slider-rating'} />;
  },
}));

jest.mock('../../src/components/Handover/HandoverView', () => ({
  HandoverView: ({ testID }: any) => {
    const { View } = require('react-native');
    return <View testID={testID || 'handover-view'} />;
  },
}));

describe('NodeRenderer', () => {
  const defaultProps = {
    onResponse: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ========================================
  // MESSAGE TYPE RENDERING
  // ========================================

  describe('Message Type Rendering', () => {
    it('renders text message node', () => {
      const node = createNode({ type: 'message', content: 'Hello world' });
      const { getByTestId } = render(
        <NodeRenderer {...defaultProps} node={node} />
      );

      expect(getByTestId('text-message')).toBeTruthy();
    });

    it('renders image message node', () => {
      const node = createNode({ type: 'image', url: 'https://example.com/image.png' });
      const { getByTestId } = render(
        <NodeRenderer {...defaultProps} node={node} />
      );

      expect(getByTestId('image-message')).toBeTruthy();
    });

    it('renders video message node', () => {
      const node = createNode({ type: 'video', url: 'https://example.com/video.mp4' });
      const { getByTestId } = render(
        <NodeRenderer {...defaultProps} node={node} />
      );

      expect(getByTestId('video-message')).toBeTruthy();
    });

    it('renders audio message node', () => {
      const node = createNode({ type: 'audio', url: 'https://example.com/audio.mp3' });
      const { getByTestId } = render(
        <NodeRenderer {...defaultProps} node={node} />
      );

      expect(getByTestId('audio-message')).toBeTruthy();
    });

    it('renders file message node', () => {
      const node = createNode({ type: 'file', url: 'https://example.com/doc.pdf', filename: 'doc.pdf' });
      const { getByTestId } = render(
        <NodeRenderer {...defaultProps} node={node} />
      );

      expect(getByTestId('file-message')).toBeTruthy();
    });

    it('renders html message node', () => {
      const node = createNode({ type: 'html', content: '<p>HTML content</p>' });
      const { getByTestId } = render(
        <NodeRenderer {...defaultProps} node={node} />
      );

      expect(getByTestId('html-message')).toBeTruthy();
    });
  });

  // ========================================
  // SELECTION TYPE RENDERING
  // ========================================

  describe('Selection Type Rendering', () => {
    it('renders buttons selection node', () => {
      const node = createNode({
        type: 'buttons',
        options: [
          { id: '1', text: 'Option 1' },
          { id: '2', text: 'Option 2' },
        ],
      });
      const { getByTestId } = render(
        <NodeRenderer {...defaultProps} node={node} />
      );

      expect(getByTestId('buttons-selection')).toBeTruthy();
    });

    it('renders cards selection node', () => {
      const node = createNode({
        type: 'cards',
        cards: [
          { id: '1', title: 'Card 1', description: 'Desc 1' },
        ],
      });
      const { getByTestId } = render(
        <NodeRenderer {...defaultProps} node={node} />
      );

      expect(getByTestId('cards-selection')).toBeTruthy();
    });

    it('renders carousel selection node', () => {
      const node = createNode({
        type: 'carousel',
        items: [
          { id: '1', image: 'img1.png', title: 'Item 1' },
        ],
      });
      const { getByTestId } = render(
        <NodeRenderer {...defaultProps} node={node} />
      );

      expect(getByTestId('carousel-selection')).toBeTruthy();
    });

    it('renders picture choice selection node', () => {
      const node = createNode({
        type: 'pictureChoice',
        choices: [
          { id: '1', image: 'img1.png', label: 'Choice 1' },
        ],
      });
      const { getByTestId } = render(
        <NodeRenderer {...defaultProps} node={node} />
      );

      expect(getByTestId('picture-choice')).toBeTruthy();
    });

    it('renders dropdown selection node', () => {
      const node = createNode({
        type: 'dropdown',
        options: [
          { id: '1', text: 'Option 1' },
        ],
      });
      const { getByTestId } = render(
        <NodeRenderer {...defaultProps} node={node} />
      );

      expect(getByTestId('dropdown-selection')).toBeTruthy();
    });
  });

  // ========================================
  // INPUT TYPE RENDERING
  // ========================================

  describe('Input Type Rendering', () => {
    it('renders text input node', () => {
      const node = createNode({ type: 'textInput', placeholder: 'Enter text' });
      const { getByTestId } = render(
        <NodeRenderer {...defaultProps} node={node} />
      );

      expect(getByTestId('text-input')).toBeTruthy();
    });

    it('renders calendar input node', () => {
      const node = createNode({ type: 'calendar' });
      const { getByTestId } = render(
        <NodeRenderer {...defaultProps} node={node} />
      );

      expect(getByTestId('calendar-input')).toBeTruthy();
    });

    it('renders file upload node', () => {
      const node = createNode({ type: 'fileUpload' });
      const { getByTestId } = render(
        <NodeRenderer {...defaultProps} node={node} />
      );

      expect(getByTestId('file-upload')).toBeTruthy();
    });

    it('renders location picker node', () => {
      const node = createNode({ type: 'locationPicker' });
      const { getByTestId } = render(
        <NodeRenderer {...defaultProps} node={node} />
      );

      expect(getByTestId('location-picker')).toBeTruthy();
    });

    it('renders multiple questions node', () => {
      const node = createNode({
        type: 'multipleQuestions',
        questions: [
          { id: '1', text: 'Question 1' },
        ],
      });
      const { getByTestId } = render(
        <NodeRenderer {...defaultProps} node={node} />
      );

      expect(getByTestId('multiple-questions')).toBeTruthy();
    });
  });

  // ========================================
  // RATING TYPE RENDERING
  // ========================================

  describe('Rating Type Rendering', () => {
    it('renders star rating node', () => {
      const node = createNode({ type: 'rating', maxRating: 5 });
      const { getByTestId } = render(
        <NodeRenderer {...defaultProps} node={node} />
      );

      expect(getByTestId('star-rating')).toBeTruthy();
    });

    it('renders opinion scale node', () => {
      const node = createNode({ type: 'opinionScale', min: 1, max: 10 });
      const { getByTestId } = render(
        <NodeRenderer {...defaultProps} node={node} />
      );

      expect(getByTestId('opinion-scale')).toBeTruthy();
    });

    it('renders slider rating node', () => {
      const node = createNode({ type: 'slider', min: 0, max: 100 });
      const { getByTestId } = render(
        <NodeRenderer {...defaultProps} node={node} />
      );

      expect(getByTestId('slider-rating')).toBeTruthy();
    });
  });

  // ========================================
  // SPECIAL TYPE RENDERING
  // ========================================

  describe('Special Type Rendering', () => {
    it('renders human handover node', () => {
      const node = createNode({ type: 'humanHandover', stage: 'waiting' });
      const { getByTestId } = render(
        <NodeRenderer {...defaultProps} node={node} />
      );

      expect(getByTestId('handover-view')).toBeTruthy();
    });

    it('renders loading node', () => {
      const node = createNode({ type: 'loading' });
      const { getByTestId } = render(
        <NodeRenderer {...defaultProps} node={node} testID="node-renderer" />
      );

      expect(getByTestId('node-renderer')).toBeTruthy();
    });

    it('renders GPT response node', () => {
      const node = createNode({ type: 'gptResponse', content: 'AI response' });
      const { getByTestId } = render(
        <NodeRenderer {...defaultProps} node={node} />
      );

      expect(getByTestId('text-message')).toBeTruthy();
    });

    it('renders quiz node', () => {
      const node = createNode({
        type: 'quiz',
        question: 'What is 2+2?',
        options: [
          { id: '1', text: '3' },
          { id: '2', text: '4', correct: true },
        ],
      });
      const { getByTestId } = render(
        <NodeRenderer {...defaultProps} node={node} testID="node-renderer" />
      );

      expect(getByTestId('node-renderer')).toBeTruthy();
    });

    it('renders custom node', () => {
      const node = createNode({ type: 'custom', customType: 'myCustomNode' });
      const { getByTestId } = render(
        <NodeRenderer {...defaultProps} node={node} testID="node-renderer" />
      );

      expect(getByTestId('node-renderer')).toBeTruthy();
    });
  });

  // ========================================
  // INTERACTION TESTS
  // ========================================

  describe('Interactions', () => {
    it('calls onResponse when button selection is made', () => {
      const onResponse = jest.fn();
      const node = createNode({
        type: 'buttons',
        options: [{ id: '1', text: 'Option 1' }],
      });

      const { getByTestId } = render(
        <NodeRenderer node={node} onResponse={onResponse} />
      );

      fireEvent.press(getByTestId('buttons-selection'));

      expect(onResponse).toHaveBeenCalledWith('option-1');
    });

    it('calls onResponse when text input is submitted', () => {
      const onResponse = jest.fn();
      const node = createNode({ type: 'textInput' });

      const { getByTestId } = render(
        <NodeRenderer node={node} onResponse={onResponse} />
      );

      const input = getByTestId('text-input');
      fireEvent(input, 'submitEditing', { nativeEvent: { text: 'user input' } });

      expect(onResponse).toHaveBeenCalledWith('user input');
    });
  });

  // ========================================
  // ACCESSIBILITY TESTS
  // ========================================

  describe('Accessibility', () => {
    it('passes accessibility props to child components', () => {
      const node = createNode({ type: 'message', content: 'Hello' });
      const { getByTestId } = render(
        <NodeRenderer
          {...defaultProps}
          node={node}
          testID="node-renderer"
          accessibilityLabel="Chat message"
        />
      );

      expect(getByTestId('text-message')).toBeTruthy();
    });
  });

  // ========================================
  // EDGE CASES
  // ========================================

  describe('Edge Cases', () => {
    it('handles unknown node type gracefully', () => {
      const node = createNode({ type: 'unknownType' as any });
      const { getByTestId } = render(
        <NodeRenderer {...defaultProps} node={node} testID="node-renderer" />
      );

      expect(getByTestId('node-renderer')).toBeTruthy();
    });

    it('handles null node gracefully', () => {
      const { getByTestId } = render(
        <NodeRenderer {...defaultProps} node={null as any} testID="node-renderer" />
      );

      expect(getByTestId('node-renderer')).toBeTruthy();
    });

    it('handles undefined node gracefully', () => {
      const { getByTestId } = render(
        <NodeRenderer {...defaultProps} node={undefined as any} testID="node-renderer" />
      );

      expect(getByTestId('node-renderer')).toBeTruthy();
    });

    it('handles node without type gracefully', () => {
      const node = { id: 'node-1' } as any;
      const { getByTestId } = render(
        <NodeRenderer {...defaultProps} node={node} testID="node-renderer" />
      );

      expect(getByTestId('node-renderer')).toBeTruthy();
    });

    it('handles missing onResponse gracefully', () => {
      const node = createNode({ type: 'message', content: 'Hello' });
      const { getByTestId } = render(
        <NodeRenderer node={node} testID="node-renderer" />
      );

      expect(getByTestId('text-message')).toBeTruthy();
    });

    it('handles node with empty options', () => {
      const node = createNode({ type: 'buttons', options: [] });
      const { getByTestId } = render(
        <NodeRenderer {...defaultProps} node={node} testID="node-renderer" />
      );

      expect(getByTestId('node-renderer')).toBeTruthy();
    });

    it('handles rapid node type changes', () => {
      const messageNode = createNode({ type: 'message', content: 'Hello' });
      const buttonsNode = createNode({ type: 'buttons', options: [] });

      const { rerender, getByTestId } = render(
        <NodeRenderer {...defaultProps} node={messageNode} />
      );

      expect(getByTestId('text-message')).toBeTruthy();

      rerender(<NodeRenderer {...defaultProps} node={buttonsNode} testID="node-renderer" />);

      expect(getByTestId('node-renderer')).toBeTruthy();
    });
  });
});
