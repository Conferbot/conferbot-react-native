/**
 * NodeRenderer.test.tsx
 *
 * Tests for the NodeRenderer component that routes NodeUIState objects to the
 * correct UI component.
 *
 * Rewritten against the real API: NodeRenderer takes { uiState, onSubmit }
 * (not { node, onResponse }) and routes to the components actually exported
 * by this SDK (MessageBubble, ButtonGroup, StarRating, ...). Child modules
 * are mocked with their real export names to isolate routing.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { NodeRenderer } from '../../src/components/NodeComponents/NodeRenderer';
import type { NodeUIState } from '../../src/core/nodes/NodeHandler';
import { createMockTheme } from '../testUtils';

// Mock theme
jest.mock('../../src/theme', () => ({
  useTheme: () => createMockTheme(),
}));

// Mock child component modules with their REAL export names
jest.mock('../../src/components/NodeComponents/MessageComponents', () => {
  const { View, Text } = require('react-native');
  const React = require('react');
  return {
    MessageBubble: ({ text }: any) =>
      React.createElement(Text, { testID: 'message-bubble' }, text),
    ImageDisplay: () => React.createElement(View, { testID: 'image-display' }),
    VideoPlayer: () => React.createElement(View, { testID: 'video-player' }),
    AudioPlayer: () => React.createElement(View, { testID: 'audio-player' }),
    FileDownload: () => React.createElement(View, { testID: 'file-download' }),
    HTMLView: () => React.createElement(View, { testID: 'html-view' }),
  };
});

jest.mock('../../src/components/NodeComponents/InputComponents', () => {
  const { TextInput } = require('react-native');
  const React = require('react');
  return {
    TextInputComponent: ({ onSubmit }: any) =>
      React.createElement(TextInput, {
        testID: 'text-input-component',
        onSubmitEditing: (e: any) => onSubmit(e.nativeEvent.text),
      }),
  };
});

jest.mock('../../src/components/NodeComponents/SelectionComponents', () => {
  const { View, TouchableOpacity, Text } = require('react-native');
  const React = require('react');
  return {
    ButtonGroup: ({ onSubmit }: any) =>
      React.createElement(
        TouchableOpacity,
        {
          testID: 'button-group',
          onPress: () => onSubmit({ buttonId: 'b1', value: 'one' }),
        },
        React.createElement(Text, null, 'Button 1')
      ),
    CardGrid: () => React.createElement(View, { testID: 'card-grid' }),
    CarouselView: () => React.createElement(View, { testID: 'carousel-view' }),
    PictureChoiceGrid: () =>
      React.createElement(View, { testID: 'picture-choice-grid' }),
    DropdownPicker: () =>
      React.createElement(View, { testID: 'dropdown-picker' }),
  };
});

jest.mock('../../src/components/NodeComponents/RatingComponents', () => {
  const { View } = require('react-native');
  const React = require('react');
  return {
    StarRating: () => React.createElement(View, { testID: 'star-rating' }),
    OpinionScaleSelector: () =>
      React.createElement(View, { testID: 'opinion-scale' }),
    SliderInput: () => React.createElement(View, { testID: 'slider-input' }),
  };
});

jest.mock('../../src/components/NodeComponents/AdvancedComponents', () => {
  const { View } = require('react-native');
  const React = require('react');
  return {
    CalendarPicker: () =>
      React.createElement(View, { testID: 'calendar-picker' }),
    MultiFieldForm: () =>
      React.createElement(View, { testID: 'multi-field-form' }),
    FileUploadButton: () =>
      React.createElement(View, { testID: 'file-upload-button' }),
    LocationInput: () =>
      React.createElement(View, { testID: 'location-input' }),
  };
});

jest.mock('../../src/components/NodeComponents/SpecialComponents', () => {
  const { View } = require('react-native');
  const React = require('react');
  return {
    HumanHandoverView: () =>
      React.createElement(View, { testID: 'human-handover-view' }),
    GPTResponseView: () =>
      React.createElement(View, { testID: 'gpt-response-view' }),
    LoadingIndicator: () =>
      React.createElement(View, { testID: 'loading-indicator' }),
    QuizQuestion: () => React.createElement(View, { testID: 'quiz-question' }),
  };
});

describe('NodeRenderer', () => {
  const onSubmit = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ========================================
  // MESSAGE TYPE ROUTING
  // ========================================

  describe('Message Type Routing', () => {
    it('renders MessageBubble for message states', () => {
      const uiState: NodeUIState = {
        type: 'message',
        nodeId: 'n1',
        text: 'Hello world',
      };
      const { getByTestId, getByText } = render(
        <NodeRenderer uiState={uiState} onSubmit={onSubmit} />
      );

      expect(getByTestId('message-bubble')).toBeTruthy();
      expect(getByText('Hello world')).toBeTruthy();
    });

    it('renders ImageDisplay for image states', () => {
      const uiState: NodeUIState = {
        type: 'image',
        nodeId: 'n2',
        url: 'https://example.com/image.png',
      };
      const { getByTestId } = render(
        <NodeRenderer uiState={uiState} onSubmit={onSubmit} />
      );

      expect(getByTestId('image-display')).toBeTruthy();
    });

    it('renders VideoPlayer for video states', () => {
      const uiState: NodeUIState = {
        type: 'video',
        nodeId: 'n3',
        url: 'https://example.com/video.mp4',
      };
      const { getByTestId } = render(
        <NodeRenderer uiState={uiState} onSubmit={onSubmit} />
      );

      expect(getByTestId('video-player')).toBeTruthy();
    });

    it('renders AudioPlayer for audio states', () => {
      const uiState: NodeUIState = {
        type: 'audio',
        nodeId: 'n4',
        url: 'https://example.com/audio.mp3',
      };
      const { getByTestId } = render(
        <NodeRenderer uiState={uiState} onSubmit={onSubmit} />
      );

      expect(getByTestId('audio-player')).toBeTruthy();
    });

    it('renders FileDownload for file states', () => {
      const uiState: NodeUIState = {
        type: 'file',
        nodeId: 'n5',
        url: 'https://example.com/doc.pdf',
        filename: 'doc.pdf',
      };
      const { getByTestId } = render(
        <NodeRenderer uiState={uiState} onSubmit={onSubmit} />
      );

      expect(getByTestId('file-download')).toBeTruthy();
    });

    it('renders HTMLView for html states', () => {
      const uiState: NodeUIState = {
        type: 'html',
        nodeId: 'n6',
        content: '<p>HTML content</p>',
      };
      const { getByTestId } = render(
        <NodeRenderer uiState={uiState} onSubmit={onSubmit} />
      );

      expect(getByTestId('html-view')).toBeTruthy();
    });
  });

  // ========================================
  // SELECTION TYPE ROUTING
  // ========================================

  describe('Selection Type Routing', () => {
    it('renders ButtonGroup for buttons states', () => {
      const uiState: NodeUIState = {
        type: 'buttons',
        nodeId: 'n7',
        question: 'Pick',
        buttons: [{ id: 'b1', label: 'One' }],
      };
      const { getByTestId } = render(
        <NodeRenderer uiState={uiState} onSubmit={onSubmit} />
      );

      expect(getByTestId('button-group')).toBeTruthy();
    });

    it('renders CardGrid for cards states', () => {
      const uiState: NodeUIState = {
        type: 'cards',
        nodeId: 'n8',
        cards: [{ id: 'c1', title: 'Card 1' }],
      };
      const { getByTestId } = render(
        <NodeRenderer uiState={uiState} onSubmit={onSubmit} />
      );

      expect(getByTestId('card-grid')).toBeTruthy();
    });

    it('renders CarouselView for carousel states', () => {
      const uiState: NodeUIState = {
        type: 'carousel',
        nodeId: 'n9',
        cards: [{ id: 'c1', title: 'Slide 1' }],
      };
      const { getByTestId } = render(
        <NodeRenderer uiState={uiState} onSubmit={onSubmit} />
      );

      expect(getByTestId('carousel-view')).toBeTruthy();
    });

    it('renders PictureChoiceGrid for pictureChoice states', () => {
      const uiState: NodeUIState = {
        type: 'pictureChoice',
        nodeId: 'n10',
        question: 'Pick a picture',
        choices: [{ id: 'p1', imageUrl: 'https://example.com/1.png' }],
      };
      const { getByTestId } = render(
        <NodeRenderer uiState={uiState} onSubmit={onSubmit} />
      );

      expect(getByTestId('picture-choice-grid')).toBeTruthy();
    });

    it('renders DropdownPicker for dropdown states', () => {
      const uiState: NodeUIState = {
        type: 'dropdown',
        nodeId: 'n11',
        question: 'Pick one',
        options: [{ id: 'o1', label: 'Option 1' }],
      };
      const { getByTestId } = render(
        <NodeRenderer uiState={uiState} onSubmit={onSubmit} />
      );

      expect(getByTestId('dropdown-picker')).toBeTruthy();
    });
  });

  // ========================================
  // INPUT / RATING / ADVANCED TYPE ROUTING
  // ========================================

  describe('Input and Rating Type Routing', () => {
    it('renders TextInputComponent for textInput states', () => {
      const uiState: NodeUIState = {
        type: 'textInput',
        nodeId: 'n12',
        question: 'Your name?',
        variableName: 'name',
        inputType: 'text',
      };
      const { getByTestId } = render(
        <NodeRenderer uiState={uiState} onSubmit={onSubmit} />
      );

      expect(getByTestId('text-input-component')).toBeTruthy();
    });

    it('renders StarRating for rating states', () => {
      const uiState: NodeUIState = {
        type: 'rating',
        nodeId: 'n13',
        question: 'Rate us',
        maxRating: 5,
        style: 'stars',
      };
      const { getByTestId } = render(
        <NodeRenderer uiState={uiState} onSubmit={onSubmit} />
      );

      expect(getByTestId('star-rating')).toBeTruthy();
    });

    it('renders OpinionScaleSelector for opinionScale states', () => {
      const uiState: NodeUIState = {
        type: 'opinionScale',
        nodeId: 'n14',
        question: 'How likely?',
        min: 0,
        max: 10,
      };
      const { getByTestId } = render(
        <NodeRenderer uiState={uiState} onSubmit={onSubmit} />
      );

      expect(getByTestId('opinion-scale')).toBeTruthy();
    });

    it('renders SliderInput for slider states', () => {
      const uiState: NodeUIState = {
        type: 'slider',
        nodeId: 'n15',
        question: 'Pick a value',
        min: 0,
        max: 100,
      };
      const { getByTestId } = render(
        <NodeRenderer uiState={uiState} onSubmit={onSubmit} />
      );

      expect(getByTestId('slider-input')).toBeTruthy();
    });

    it('renders CalendarPicker for calendar states', () => {
      const uiState: NodeUIState = {
        type: 'calendar',
        nodeId: 'n16',
        question: 'Pick a date',
        mode: 'date',
      };
      const { getByTestId } = render(
        <NodeRenderer uiState={uiState} onSubmit={onSubmit} />
      );

      expect(getByTestId('calendar-picker')).toBeTruthy();
    });

    it('renders MultiFieldForm for multipleQuestions states', () => {
      const uiState: NodeUIState = {
        type: 'multipleQuestions',
        nodeId: 'n17',
        questions: [
          { id: 'q1', question: 'Name?', type: 'text', variableName: 'name' },
        ],
      };
      const { getByTestId } = render(
        <NodeRenderer uiState={uiState} onSubmit={onSubmit} />
      );

      expect(getByTestId('multi-field-form')).toBeTruthy();
    });

    it('renders FileUploadButton for fileUpload states', () => {
      const uiState: NodeUIState = {
        type: 'fileUpload',
        nodeId: 'n18',
        question: 'Upload a file',
      };
      const { getByTestId } = render(
        <NodeRenderer uiState={uiState} onSubmit={onSubmit} />
      );

      expect(getByTestId('file-upload-button')).toBeTruthy();
    });

    it('renders LocationInput for locationPicker states', () => {
      const uiState: NodeUIState = {
        type: 'locationPicker',
        nodeId: 'n19',
        question: 'Where are you?',
      };
      const { getByTestId } = render(
        <NodeRenderer uiState={uiState} onSubmit={onSubmit} />
      );

      expect(getByTestId('location-input')).toBeTruthy();
    });
  });

  // ========================================
  // SPECIAL TYPE ROUTING
  // ========================================

  describe('Special Type Routing', () => {
    it('renders HumanHandoverView for humanHandover states', () => {
      const uiState: NodeUIState = {
        type: 'humanHandover',
        nodeId: 'n20',
        stage: 'waiting',
      };
      const { getByTestId } = render(
        <NodeRenderer uiState={uiState} onSubmit={onSubmit} />
      );

      expect(getByTestId('human-handover-view')).toBeTruthy();
    });

    it('renders GPTResponseView for gptResponse states', () => {
      const uiState: NodeUIState = {
        type: 'gptResponse',
        nodeId: 'n21',
        text: 'AI response',
      };
      const { getByTestId } = render(
        <NodeRenderer uiState={uiState} onSubmit={onSubmit} />
      );

      expect(getByTestId('gpt-response-view')).toBeTruthy();
    });

    it('renders LoadingIndicator for loading states', () => {
      const uiState: NodeUIState = {
        type: 'loading',
        nodeId: 'n22',
      };
      const { getByTestId } = render(
        <NodeRenderer uiState={uiState} onSubmit={onSubmit} />
      );

      expect(getByTestId('loading-indicator')).toBeTruthy();
    });

    it('renders QuizQuestion for quiz states', () => {
      const uiState: NodeUIState = {
        type: 'quiz',
        nodeId: 'n23',
        question: 'What is 2+2?',
        options: [
          { id: 'a', label: '3' },
          { id: 'b', label: '4', isCorrect: true },
        ],
      };
      const { getByTestId } = render(
        <NodeRenderer uiState={uiState} onSubmit={onSubmit} />
      );

      expect(getByTestId('quiz-question')).toBeTruthy();
    });

    it('uses the custom renderer for custom states', () => {
      const { Text } = require('react-native');
      const uiState = {
        type: 'custom',
        nodeId: 'n24',
        componentName: 'MyWidget',
        props: { foo: 'bar' },
      } as unknown as NodeUIState;

      const customRenderer = jest.fn(() => (
        <Text testID="custom-widget">Custom!</Text>
      ));

      const { getByTestId } = render(
        <NodeRenderer
          uiState={uiState}
          onSubmit={onSubmit}
          customRenderer={customRenderer}
        />
      );

      expect(getByTestId('custom-widget')).toBeTruthy();
      expect(customRenderer).toHaveBeenCalledWith(
        'MyWidget',
        { foo: 'bar' },
        onSubmit
      );
    });

    it('falls back to MessageBubble for custom states without a renderer', () => {
      const uiState = {
        type: 'custom',
        nodeId: 'n25',
        componentName: 'MyWidget',
        props: {},
      } as unknown as NodeUIState;

      const { getByTestId } = render(
        <NodeRenderer uiState={uiState} onSubmit={onSubmit} />
      );

      expect(getByTestId('message-bubble')).toBeTruthy();
    });
  });

  // ========================================
  // LOADING AND INTERACTIONS
  // ========================================

  describe('Loading State', () => {
    it('shows the loading indicator while isLoading is true', () => {
      const uiState: NodeUIState = {
        type: 'message',
        nodeId: 'n26',
        text: 'Hello',
      };
      const { getByTestId, queryByTestId } = render(
        <NodeRenderer uiState={uiState} onSubmit={onSubmit} isLoading={true} />
      );

      expect(getByTestId('loading-indicator')).toBeTruthy();
      expect(queryByTestId('message-bubble')).toBeNull();
    });
  });

  describe('Interactions', () => {
    it('passes onSubmit through to selection components', () => {
      const uiState: NodeUIState = {
        type: 'buttons',
        nodeId: 'n27',
        question: 'Pick',
        buttons: [{ id: 'b1', label: 'One' }],
      };
      const { getByTestId } = render(
        <NodeRenderer uiState={uiState} onSubmit={onSubmit} />
      );

      fireEvent.press(getByTestId('button-group'));

      expect(onSubmit).toHaveBeenCalledWith({ buttonId: 'b1', value: 'one' });
    });

    it('passes onSubmit through to input components', () => {
      const uiState: NodeUIState = {
        type: 'textInput',
        nodeId: 'n28',
        question: 'Name?',
        variableName: 'name',
        inputType: 'text',
      };
      const { getByTestId } = render(
        <NodeRenderer uiState={uiState} onSubmit={onSubmit} />
      );

      fireEvent(getByTestId('text-input-component'), 'submitEditing', {
        nativeEvent: { text: 'user input' },
      });

      expect(onSubmit).toHaveBeenCalledWith('user input');
    });
  });

  // ========================================
  // EDGE CASES
  // ========================================

  describe('Edge Cases', () => {
    it('renders nothing for a null uiState', () => {
      const { toJSON } = render(
        <NodeRenderer uiState={null} onSubmit={onSubmit} />
      );

      expect(toJSON()).toBeNull();
    });

    it('renders nothing for an unknown state type', () => {
      const uiState = { type: 'unknownType', nodeId: 'n29' } as any;
      const { toJSON } = render(
        <NodeRenderer uiState={uiState} onSubmit={onSubmit} />
      );

      expect(toJSON()).toBeNull();
    });
  });
});
