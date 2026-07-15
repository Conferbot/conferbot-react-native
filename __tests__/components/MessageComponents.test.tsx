/**
 * MessageComponents.test.tsx
 *
 * Tests for message display components (MessageBubble, ImageDisplay,
 * VideoPlayer, AudioPlayer, FileDownload, HTMLView).
 *
 * Rewritten against the real component API: these components take NodeUIState
 * props (nodeId, text/url/content, ...). The previous tests imported
 * TextMessage/ImageMessage/... which never existed in this SDK.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Linking } from 'react-native';
import {
  MessageBubble,
  ImageDisplay,
  VideoPlayer,
  AudioPlayer,
  FileDownload,
  HTMLView,
} from '../../src/components/NodeComponents/MessageComponents';
import { createMockTheme } from '../testUtils';

// Mock theme
jest.mock('../../src/theme', () => ({
  useTheme: () => createMockTheme(),
}));

describe('MessageComponents', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ========================================
  // MESSAGE BUBBLE
  // ========================================

  describe('MessageBubble', () => {
    const defaultProps = {
      type: 'message' as const,
      nodeId: 'node-1',
      text: 'Hello world',
    };

    describe('Rendering', () => {
      it('renders the message text', () => {
        const { getByText } = render(<MessageBubble {...defaultProps} />);

        expect(getByText('Hello world')).toBeTruthy();
      });

      it('renders with custom testID', () => {
        const { getByTestId } = render(
          <MessageBubble {...defaultProps} testID="text-message" />
        );

        expect(getByTestId('text-message')).toBeTruthy();
      });

      it('labels bot messages for accessibility', () => {
        const { getByLabelText } = render(
          <MessageBubble {...defaultProps} isBot={true} />
        );

        expect(getByLabelText('Bot message: Hello world')).toBeTruthy();
      });

      it('labels user messages for accessibility', () => {
        const { getByLabelText } = render(
          <MessageBubble {...defaultProps} isBot={false} />
        );

        expect(getByLabelText('Your message: Hello world')).toBeTruthy();
      });

      it('shows the bot avatar by default', () => {
        const { getByLabelText } = render(
          <MessageBubble {...defaultProps} isBot={true} />
        );

        expect(getByLabelText('Bot avatar')).toBeTruthy();
      });

      it('hides the avatar when showAvatar is false', () => {
        const { queryByLabelText } = render(
          <MessageBubble {...defaultProps} showAvatar={false} />
        );

        expect(queryByLabelText('Bot avatar')).toBeNull();
      });

      it('shows typing dots instead of text while typing', () => {
        const { queryByText } = render(
          <MessageBubble {...defaultProps} typing={true} />
        );

        expect(queryByText('Hello world')).toBeNull();
      });
    });

    describe('Edge Cases', () => {
      it('handles empty text', () => {
        const { getByTestId } = render(
          <MessageBubble {...defaultProps} text="" testID="text-message" />
        );

        expect(getByTestId('text-message')).toBeTruthy();
      });

      it('handles very long text', () => {
        const longText = 'Lorem ipsum '.repeat(500);
        const { getByText } = render(
          <MessageBubble {...defaultProps} text={longText} />
        );

        expect(getByText(longText)).toBeTruthy();
      });

      it('handles unicode and emojis', () => {
        const { getByText } = render(
          <MessageBubble {...defaultProps} text="Hi 👋 你好 مرحبا" />
        );

        expect(getByText('Hi 👋 你好 مرحبا')).toBeTruthy();
      });
    });
  });

  // ========================================
  // IMAGE DISPLAY
  // ========================================

  describe('ImageDisplay', () => {
    const defaultProps = {
      type: 'image' as const,
      nodeId: 'node-2',
      url: 'https://example.com/image.png',
    };

    describe('Rendering', () => {
      it('renders the image container', () => {
        const { getByTestId } = render(
          <ImageDisplay {...defaultProps} testID="image-message" />
        );

        expect(getByTestId('image-message')).toBeTruthy();
      });

      it('uses alt text as the accessibility label', () => {
        const { getByLabelText } = render(
          <ImageDisplay {...defaultProps} alt="A cute cat" />
        );

        expect(getByLabelText('A cute cat')).toBeTruthy();
      });

      it('falls back to a generic label without alt or caption', () => {
        const { getByLabelText } = render(<ImageDisplay {...defaultProps} />);

        expect(getByLabelText('Image')).toBeTruthy();
      });

      it('renders the caption when provided', () => {
        const { getByText } = render(
          <ImageDisplay {...defaultProps} caption="Team photo" />
        );

        expect(getByText('Team photo')).toBeTruthy();
      });
    });

    describe('Error Handling', () => {
      it('shows an error message when the image fails to load', () => {
        const { getByTestId, getByText, UNSAFE_getByType } = render(
          <ImageDisplay {...defaultProps} testID="image-message" />
        );

        const { Image } = require('react-native');
        fireEvent(UNSAFE_getByType(Image), 'error');

        expect(getByTestId('image-message')).toBeTruthy();
        expect(getByText('Failed to load image')).toBeTruthy();
      });
    });
  });

  // ========================================
  // VIDEO PLAYER
  // ========================================

  describe('VideoPlayer', () => {
    const defaultProps = {
      type: 'video' as const,
      nodeId: 'node-3',
      url: 'https://example.com/video.mp4',
    };

    describe('Rendering', () => {
      it('renders the video player container', () => {
        const { getByTestId } = render(
          <VideoPlayer {...defaultProps} testID="video-message" />
        );

        expect(getByTestId('video-message')).toBeTruthy();
      });

      it('renders a play button', () => {
        const { getByLabelText } = render(<VideoPlayer {...defaultProps} />);

        expect(getByLabelText('Play video')).toBeTruthy();
      });
    });

    describe('Interactions', () => {
      it('opens the video URL when play is pressed', () => {
        const { getByLabelText } = render(<VideoPlayer {...defaultProps} />);

        fireEvent.press(getByLabelText('Play video'));

        expect(Linking.openURL).toHaveBeenCalledWith(
          'https://example.com/video.mp4'
        );
      });
    });
  });

  // ========================================
  // AUDIO PLAYER
  // ========================================

  describe('AudioPlayer', () => {
    const defaultProps = {
      type: 'audio' as const,
      nodeId: 'node-4',
      url: 'https://example.com/audio.mp3',
    };

    describe('Rendering', () => {
      it('renders the audio player container', () => {
        const { getByTestId } = render(
          <AudioPlayer {...defaultProps} testID="audio-message" />
        );

        expect(getByTestId('audio-message')).toBeTruthy();
      });

      it('starts in the paused state', () => {
        const { getByLabelText } = render(<AudioPlayer {...defaultProps} />);

        expect(getByLabelText('Play audio')).toBeTruthy();
      });
    });

    describe('Interactions', () => {
      it('toggles between play and pause', () => {
        const { getByLabelText } = render(<AudioPlayer {...defaultProps} />);

        fireEvent.press(getByLabelText('Play audio'));
        expect(getByLabelText('Pause audio')).toBeTruthy();

        fireEvent.press(getByLabelText('Pause audio'));
        expect(getByLabelText('Play audio')).toBeTruthy();
      });
    });
  });

  // ========================================
  // FILE DOWNLOAD
  // ========================================

  describe('FileDownload', () => {
    const defaultProps = {
      type: 'file' as const,
      nodeId: 'node-5',
      url: 'https://example.com/report.pdf',
      filename: 'report.pdf',
    };

    describe('Rendering', () => {
      it('renders the filename', () => {
        const { getByText } = render(<FileDownload {...defaultProps} />);

        expect(getByText('report.pdf')).toBeTruthy();
      });

      it('renders with custom testID', () => {
        const { getByTestId } = render(
          <FileDownload {...defaultProps} testID="file-message" />
        );

        expect(getByTestId('file-message')).toBeTruthy();
      });

      it('formats the file size in KB', () => {
        const { getByText } = render(
          <FileDownload {...defaultProps} size={2048} />
        );

        expect(getByText('2.0 KB')).toBeTruthy();
      });

      it('formats the file size in MB', () => {
        const { getByText } = render(
          <FileDownload {...defaultProps} size={3 * 1024 * 1024} />
        );

        expect(getByText('3.0 MB')).toBeTruthy();
      });

      it('omits the size when not provided', () => {
        const { queryByText } = render(<FileDownload {...defaultProps} />);

        expect(queryByText(/KB|MB/)).toBeNull();
      });
    });

    describe('Interactions', () => {
      it('opens the file URL on press', () => {
        const { getByLabelText } = render(<FileDownload {...defaultProps} />);

        fireEvent.press(getByLabelText('Download file: report.pdf'));

        expect(Linking.openURL).toHaveBeenCalledWith(
          'https://example.com/report.pdf'
        );
      });
    });
  });

  // ========================================
  // HTML VIEW
  // ========================================

  describe('HTMLView', () => {
    const defaultProps = {
      type: 'html' as const,
      nodeId: 'node-6',
      content: '<p>Hello <b>world</b></p>',
    };

    describe('Rendering', () => {
      it('renders stripped HTML content as text', () => {
        const { getByText } = render(<HTMLView {...defaultProps} />);

        expect(getByText('Hello world')).toBeTruthy();
      });

      it('renders with custom testID', () => {
        const { getByTestId } = render(
          <HTMLView {...defaultProps} testID="html-message" />
        );

        expect(getByTestId('html-message')).toBeTruthy();
      });

      it('decodes HTML entities', () => {
        // Pass as a JS string so JSX does not pre-decode the entities
        const { getByText } = render(
          <HTMLView {...defaultProps} content={'Fish &amp; Chips &quot;tasty&quot;'} />
        );

        expect(getByText('Fish & Chips "tasty"')).toBeTruthy();
      });
    });

    describe('Edge Cases', () => {
      it('handles empty content', () => {
        const { getByTestId } = render(
          <HTMLView {...defaultProps} content="" testID="html-message" />
        );

        expect(getByTestId('html-message')).toBeTruthy();
      });

      it('handles plain text without tags', () => {
        const { getByText } = render(
          <HTMLView {...defaultProps} content="Just plain text" />
        );

        expect(getByText('Just plain text')).toBeTruthy();
      });
    });
  });
});
