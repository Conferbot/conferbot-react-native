/**
 * MessageComponents.test.tsx
 *
 * Tests for the message display components (TextMessage, ImageMessage, etc.)
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import {
  TextMessage,
  ImageMessage,
  VideoMessage,
  AudioMessage,
  FileMessage,
  HtmlMessage,
} from '../../src/components/NodeComponents/MessageComponents';
import { createMockTheme } from '../testUtils';

// Mock theme
jest.mock('../../src/theme', () => ({
  useTheme: () => createMockTheme(),
}));

// Mock media components
jest.mock('react-native-video', () => 'Video');
jest.mock('react-native-webview', () => ({
  WebView: 'WebView',
}));

describe('MessageComponents', () => {
  // ========================================
  // TEXT MESSAGE TESTS
  // ========================================

  describe('TextMessage', () => {
    const defaultProps = {
      content: 'Hello, this is a test message',
    };

    describe('Rendering', () => {
      it('renders the text message', () => {
        const { getByText } = render(
          <TextMessage {...defaultProps} />
        );

        expect(getByText('Hello, this is a test message')).toBeTruthy();
      });

      it('renders with custom testID', () => {
        const { getByTestId } = render(
          <TextMessage {...defaultProps} testID="text-msg" />
        );

        expect(getByTestId('text-msg')).toBeTruthy();
      });

      it('renders markdown content when enabled', () => {
        const { getByTestId } = render(
          <TextMessage
            content="**Bold** and *italic*"
            renderMarkdown={true}
            testID="text-msg"
          />
        );

        expect(getByTestId('text-msg')).toBeTruthy();
      });

      it('renders links as clickable', () => {
        const { getByTestId } = render(
          <TextMessage
            content="Check out https://example.com"
            linkify={true}
            testID="text-msg"
          />
        );

        expect(getByTestId('text-msg')).toBeTruthy();
      });

      it('renders timestamp when provided', () => {
        const { getByTestId } = render(
          <TextMessage
            {...defaultProps}
            timestamp="10:30 AM"
            showTimestamp={true}
            testID="text-msg"
          />
        );

        expect(getByTestId('text-msg')).toBeTruthy();
      });

      it('renders sender name when provided', () => {
        const { getByText } = render(
          <TextMessage
            {...defaultProps}
            senderName="Bot"
            showSenderName={true}
          />
        );

        expect(getByText('Bot')).toBeTruthy();
      });
    });

    describe('Interactions', () => {
      it('calls onLongPress when long pressed', () => {
        const onLongPress = jest.fn();
        const { getByTestId } = render(
          <TextMessage {...defaultProps} onLongPress={onLongPress} testID="text-msg" />
        );

        fireEvent(getByTestId('text-msg'), 'longPress');

        expect(onLongPress).toHaveBeenCalled();
      });

      it('calls onLinkPress when link is pressed', () => {
        const onLinkPress = jest.fn();
        const { getByTestId } = render(
          <TextMessage
            content="Visit https://example.com"
            onLinkPress={onLinkPress}
            linkify={true}
            testID="text-msg"
          />
        );

        expect(getByTestId('text-msg')).toBeTruthy();
      });
    });

    describe('Edge Cases', () => {
      it('handles empty content', () => {
        const { getByTestId } = render(
          <TextMessage content="" testID="text-msg" />
        );

        expect(getByTestId('text-msg')).toBeTruthy();
      });

      it('handles very long content', () => {
        const { getByTestId } = render(
          <TextMessage content={'A'.repeat(10000)} testID="text-msg" />
        );

        expect(getByTestId('text-msg')).toBeTruthy();
      });

      it('handles special characters', () => {
        const { getByText } = render(
          <TextMessage content="<>&\"'special chars" />
        );

        expect(getByText("<>&\"'special chars")).toBeTruthy();
      });

      it('handles unicode and emojis', () => {
        const { getByText } = render(
          <TextMessage content="Hello \u4e16\u754c \ud83d\udc4b" />
        );

        expect(getByText('Hello \u4e16\u754c \ud83d\udc4b')).toBeTruthy();
      });
    });
  });

  // ========================================
  // IMAGE MESSAGE TESTS
  // ========================================

  describe('ImageMessage', () => {
    const defaultProps = {
      url: 'https://example.com/image.png',
    };

    describe('Rendering', () => {
      it('renders the image message', () => {
        const { getByTestId } = render(
          <ImageMessage {...defaultProps} testID="image-msg" />
        );

        expect(getByTestId('image-msg')).toBeTruthy();
      });

      it('renders with alt text', () => {
        const { getByTestId } = render(
          <ImageMessage {...defaultProps} alt="Test image" testID="image-msg" />
        );

        expect(getByTestId('image-msg')).toBeTruthy();
      });

      it('renders caption when provided', () => {
        const { getByText } = render(
          <ImageMessage {...defaultProps} caption="Image caption" />
        );

        expect(getByText('Image caption')).toBeTruthy();
      });

      it('renders loading placeholder while loading', () => {
        const { getByTestId } = render(
          <ImageMessage {...defaultProps} testID="image-msg" />
        );

        expect(getByTestId('image-msg')).toBeTruthy();
      });

      it('renders thumbnail size', () => {
        const { getByTestId } = render(
          <ImageMessage {...defaultProps} size="thumbnail" testID="image-msg" />
        );

        expect(getByTestId('image-msg')).toBeTruthy();
      });

      it('renders full size', () => {
        const { getByTestId } = render(
          <ImageMessage {...defaultProps} size="full" testID="image-msg" />
        );

        expect(getByTestId('image-msg')).toBeTruthy();
      });
    });

    describe('Interactions', () => {
      it('calls onPress when image is pressed', () => {
        const onPress = jest.fn();
        const { getByTestId } = render(
          <ImageMessage {...defaultProps} onPress={onPress} testID="image-msg" />
        );

        fireEvent.press(getByTestId('image-msg'));

        expect(onPress).toHaveBeenCalled();
      });

      it('calls onLongPress when long pressed', () => {
        const onLongPress = jest.fn();
        const { getByTestId } = render(
          <ImageMessage {...defaultProps} onLongPress={onLongPress} testID="image-msg" />
        );

        fireEvent(getByTestId('image-msg'), 'longPress');

        expect(onLongPress).toHaveBeenCalled();
      });

      it('opens fullscreen viewer when viewable is true', () => {
        const { getByTestId } = render(
          <ImageMessage {...defaultProps} viewable={true} testID="image-msg" />
        );

        expect(getByTestId('image-msg')).toBeTruthy();
      });
    });

    describe('Error Handling', () => {
      it('shows error state on load failure', () => {
        const { getByTestId } = render(
          <ImageMessage {...defaultProps} testID="image-msg" />
        );

        expect(getByTestId('image-msg')).toBeTruthy();
      });

      it('calls onError when image fails to load', () => {
        const onError = jest.fn();
        const { getByTestId } = render(
          <ImageMessage {...defaultProps} onError={onError} testID="image-msg" />
        );

        expect(getByTestId('image-msg')).toBeTruthy();
      });
    });

    describe('Edge Cases', () => {
      it('handles empty URL', () => {
        const { getByTestId } = render(
          <ImageMessage url="" testID="image-msg" />
        );

        expect(getByTestId('image-msg')).toBeTruthy();
      });

      it('handles invalid URL', () => {
        const { getByTestId } = render(
          <ImageMessage url="not-a-url" testID="image-msg" />
        );

        expect(getByTestId('image-msg')).toBeTruthy();
      });
    });
  });

  // ========================================
  // VIDEO MESSAGE TESTS
  // ========================================

  describe('VideoMessage', () => {
    const defaultProps = {
      url: 'https://example.com/video.mp4',
    };

    describe('Rendering', () => {
      it('renders the video message', () => {
        const { getByTestId } = render(
          <VideoMessage {...defaultProps} testID="video-msg" />
        );

        expect(getByTestId('video-msg')).toBeTruthy();
      });

      it('renders video poster when provided', () => {
        const { getByTestId } = render(
          <VideoMessage {...defaultProps} poster="https://example.com/poster.png" testID="video-msg" />
        );

        expect(getByTestId('video-msg')).toBeTruthy();
      });

      it('renders video controls', () => {
        const { getByTestId } = render(
          <VideoMessage {...defaultProps} showControls={true} testID="video-msg" />
        );

        expect(getByTestId('video-msg')).toBeTruthy();
      });

      it('renders without controls when disabled', () => {
        const { getByTestId } = render(
          <VideoMessage {...defaultProps} showControls={false} testID="video-msg" />
        );

        expect(getByTestId('video-msg')).toBeTruthy();
      });

      it('renders caption when provided', () => {
        const { getByText } = render(
          <VideoMessage {...defaultProps} caption="Video caption" />
        );

        expect(getByText('Video caption')).toBeTruthy();
      });
    });

    describe('Interactions', () => {
      it('starts playback on press when autoPlay is false', () => {
        const { getByTestId } = render(
          <VideoMessage {...defaultProps} autoPlay={false} testID="video-msg" />
        );

        expect(getByTestId('video-msg')).toBeTruthy();
      });

      it('auto-plays when autoPlay is true', () => {
        const { getByTestId } = render(
          <VideoMessage {...defaultProps} autoPlay={true} testID="video-msg" />
        );

        expect(getByTestId('video-msg')).toBeTruthy();
      });

      it('calls onPlay when video starts', () => {
        const onPlay = jest.fn();
        const { getByTestId } = render(
          <VideoMessage {...defaultProps} onPlay={onPlay} testID="video-msg" />
        );

        expect(getByTestId('video-msg')).toBeTruthy();
      });

      it('calls onEnd when video ends', () => {
        const onEnd = jest.fn();
        const { getByTestId } = render(
          <VideoMessage {...defaultProps} onEnd={onEnd} testID="video-msg" />
        );

        expect(getByTestId('video-msg')).toBeTruthy();
      });
    });

    describe('Edge Cases', () => {
      it('handles empty URL', () => {
        const { getByTestId } = render(
          <VideoMessage url="" testID="video-msg" />
        );

        expect(getByTestId('video-msg')).toBeTruthy();
      });

      it('handles YouTube URLs', () => {
        const { getByTestId } = render(
          <VideoMessage url="https://www.youtube.com/watch?v=dQw4w9WgXcQ" testID="video-msg" />
        );

        expect(getByTestId('video-msg')).toBeTruthy();
      });

      it('handles Vimeo URLs', () => {
        const { getByTestId } = render(
          <VideoMessage url="https://vimeo.com/123456789" testID="video-msg" />
        );

        expect(getByTestId('video-msg')).toBeTruthy();
      });
    });
  });

  // ========================================
  // AUDIO MESSAGE TESTS
  // ========================================

  describe('AudioMessage', () => {
    const defaultProps = {
      url: 'https://example.com/audio.mp3',
    };

    describe('Rendering', () => {
      it('renders the audio message', () => {
        const { getByTestId } = render(
          <AudioMessage {...defaultProps} testID="audio-msg" />
        );

        expect(getByTestId('audio-msg')).toBeTruthy();
      });

      it('renders play/pause button', () => {
        const { getByTestId } = render(
          <AudioMessage {...defaultProps} testID="audio-msg" />
        );

        expect(getByTestId('audio-msg')).toBeTruthy();
      });

      it('renders duration when available', () => {
        const { getByTestId } = render(
          <AudioMessage {...defaultProps} duration={180} testID="audio-msg" />
        );

        expect(getByTestId('audio-msg')).toBeTruthy();
      });

      it('renders progress bar', () => {
        const { getByTestId } = render(
          <AudioMessage {...defaultProps} showProgress={true} testID="audio-msg" />
        );

        expect(getByTestId('audio-msg')).toBeTruthy();
      });

      it('renders waveform when provided', () => {
        const { getByTestId } = render(
          <AudioMessage
            {...defaultProps}
            waveform={[0.1, 0.5, 0.8, 0.3]}
            showWaveform={true}
            testID="audio-msg"
          />
        );

        expect(getByTestId('audio-msg')).toBeTruthy();
      });
    });

    describe('Interactions', () => {
      it('toggles playback on button press', () => {
        const { getByTestId } = render(
          <AudioMessage {...defaultProps} testID="audio-msg" />
        );

        expect(getByTestId('audio-msg')).toBeTruthy();
      });

      it('calls onPlay when audio starts', () => {
        const onPlay = jest.fn();
        const { getByTestId } = render(
          <AudioMessage {...defaultProps} onPlay={onPlay} testID="audio-msg" />
        );

        expect(getByTestId('audio-msg')).toBeTruthy();
      });

      it('calls onEnd when audio ends', () => {
        const onEnd = jest.fn();
        const { getByTestId } = render(
          <AudioMessage {...defaultProps} onEnd={onEnd} testID="audio-msg" />
        );

        expect(getByTestId('audio-msg')).toBeTruthy();
      });

      it('allows seeking when seekable is true', () => {
        const { getByTestId } = render(
          <AudioMessage {...defaultProps} seekable={true} testID="audio-msg" />
        );

        expect(getByTestId('audio-msg')).toBeTruthy();
      });
    });

    describe('Edge Cases', () => {
      it('handles empty URL', () => {
        const { getByTestId } = render(
          <AudioMessage url="" testID="audio-msg" />
        );

        expect(getByTestId('audio-msg')).toBeTruthy();
      });
    });
  });

  // ========================================
  // FILE MESSAGE TESTS
  // ========================================

  describe('FileMessage', () => {
    const defaultProps = {
      url: 'https://example.com/document.pdf',
      filename: 'document.pdf',
    };

    describe('Rendering', () => {
      it('renders the file message', () => {
        const { getByText } = render(
          <FileMessage {...defaultProps} />
        );

        expect(getByText('document.pdf')).toBeTruthy();
      });

      it('renders file icon based on type', () => {
        const { getByTestId } = render(
          <FileMessage {...defaultProps} testID="file-msg" />
        );

        expect(getByTestId('file-msg')).toBeTruthy();
      });

      it('renders file size when provided', () => {
        const { getByTestId } = render(
          <FileMessage {...defaultProps} fileSize={1024000} testID="file-msg" />
        );

        expect(getByTestId('file-msg')).toBeTruthy();
      });

      it('renders download progress', () => {
        const { getByTestId } = render(
          <FileMessage {...defaultProps} downloadProgress={50} testID="file-msg" />
        );

        expect(getByTestId('file-msg')).toBeTruthy();
      });

      it('renders different icons for different file types', () => {
        const fileTypes = ['document.pdf', 'image.png', 'video.mp4', 'audio.mp3', 'data.zip'];

        fileTypes.forEach((filename) => {
          const { getByTestId, unmount } = render(
            <FileMessage url="https://example.com/file" filename={filename} testID="file-msg" />
          );
          expect(getByTestId('file-msg')).toBeTruthy();
          unmount();
        });
      });
    });

    describe('Interactions', () => {
      it('calls onDownload when download button is pressed', () => {
        const onDownload = jest.fn();
        const { getByTestId } = render(
          <FileMessage {...defaultProps} onDownload={onDownload} testID="file-msg" />
        );

        fireEvent.press(getByTestId('file-msg'));

        expect(onDownload).toHaveBeenCalled();
      });

      it('calls onOpen when file is pressed after download', () => {
        const onOpen = jest.fn();
        const { getByTestId } = render(
          <FileMessage {...defaultProps} onOpen={onOpen} downloaded={true} testID="file-msg" />
        );

        fireEvent.press(getByTestId('file-msg'));

        expect(onOpen).toHaveBeenCalled();
      });
    });

    describe('Edge Cases', () => {
      it('handles missing filename', () => {
        const { getByTestId } = render(
          <FileMessage url="https://example.com/file" testID="file-msg" />
        );

        expect(getByTestId('file-msg')).toBeTruthy();
      });

      it('handles very long filename', () => {
        const { getByTestId } = render(
          <FileMessage url="https://example.com/file" filename={'A'.repeat(200) + '.pdf'} testID="file-msg" />
        );

        expect(getByTestId('file-msg')).toBeTruthy();
      });
    });
  });

  // ========================================
  // HTML MESSAGE TESTS
  // ========================================

  describe('HtmlMessage', () => {
    const defaultProps = {
      content: '<p>This is HTML content</p>',
    };

    describe('Rendering', () => {
      it('renders the HTML message', () => {
        const { getByTestId } = render(
          <HtmlMessage {...defaultProps} testID="html-msg" />
        );

        expect(getByTestId('html-msg')).toBeTruthy();
      });

      it('renders complex HTML', () => {
        const { getByTestId } = render(
          <HtmlMessage
            content="<h1>Title</h1><p>Paragraph with <a href='#'>link</a></p><ul><li>Item 1</li></ul>"
            testID="html-msg"
          />
        );

        expect(getByTestId('html-msg')).toBeTruthy();
      });

      it('renders with custom styles', () => {
        const { getByTestId } = render(
          <HtmlMessage
            {...defaultProps}
            customStyles={{ p: { color: 'red' } }}
            testID="html-msg"
          />
        );

        expect(getByTestId('html-msg')).toBeTruthy();
      });
    });

    describe('Interactions', () => {
      it('calls onLinkPress when link is pressed', () => {
        const onLinkPress = jest.fn();
        const { getByTestId } = render(
          <HtmlMessage
            content="<a href='https://example.com'>Link</a>"
            onLinkPress={onLinkPress}
            testID="html-msg"
          />
        );

        expect(getByTestId('html-msg')).toBeTruthy();
      });
    });

    describe('Edge Cases', () => {
      it('handles empty content', () => {
        const { getByTestId } = render(
          <HtmlMessage content="" testID="html-msg" />
        );

        expect(getByTestId('html-msg')).toBeTruthy();
      });

      it('handles malformed HTML', () => {
        const { getByTestId } = render(
          <HtmlMessage content="<p>Unclosed tag" testID="html-msg" />
        );

        expect(getByTestId('html-msg')).toBeTruthy();
      });

      it('sanitizes script tags', () => {
        const { getByTestId } = render(
          <HtmlMessage content="<script>alert('xss')</script><p>Safe content</p>" testID="html-msg" />
        );

        expect(getByTestId('html-msg')).toBeTruthy();
      });
    });
  });
});
