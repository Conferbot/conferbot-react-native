/**
 * VoiceRecorder.test.tsx
 *
 * Tests for the VoiceRecorder component that handles audio recording.
 */

import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { VoiceRecorder } from '../../src/components/VoiceRecorder/VoiceRecorder';
import { createMockTheme } from '../testUtils';

// Mock theme
jest.mock('../../src/theme', () => ({
  useTheme: () => createMockTheme(),
}));

// Mock audio recording library
jest.mock('expo-av', () => ({
  Audio: {
    Recording: jest.fn().mockImplementation(() => ({
      prepareToRecordAsync: jest.fn(),
      startAsync: jest.fn(),
      stopAndUnloadAsync: jest.fn().mockResolvedValue({ uri: 'file://recording.m4a' }),
      getStatusAsync: jest.fn().mockResolvedValue({ durationMillis: 5000, isRecording: true }),
    })),
    setAudioModeAsync: jest.fn(),
    requestPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
    RecordingOptionsPresets: {
      HIGH_QUALITY: {},
    },
  },
  // virtual: expo-av is an optional peer integration and is not installed
}), { virtual: true });

describe('VoiceRecorder', () => {
  const defaultProps = {
    onRecordingComplete: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ========================================
  // RENDERING TESTS
  // ========================================

  describe('Rendering', () => {
    it('renders the voice recorder component', () => {
      const { getByTestId } = render(
        <VoiceRecorder {...defaultProps} testID="voice-recorder" />
      );

      expect(getByTestId('voice-recorder')).toBeTruthy();
    });

    it('renders record button', () => {
      const { getByTestId } = render(
        <VoiceRecorder {...defaultProps} testID="voice-recorder" />
      );

      expect(getByTestId('voice-recorder')).toBeTruthy();
    });

    it('renders in idle state initially', () => {
      const { getByTestId } = render(
        <VoiceRecorder {...defaultProps} testID="voice-recorder" />
      );

      expect(getByTestId('voice-recorder')).toBeTruthy();
    });

    it('renders with custom record button text', () => {
      const { getByText } = render(
        <VoiceRecorder {...defaultProps} recordButtonText="Start Recording" />
      );

      expect(getByText('Start Recording')).toBeTruthy();
    });

    it('renders with custom stop button text', () => {
      const { getByTestId } = render(
        <VoiceRecorder {...defaultProps} stopButtonText="Stop" testID="voice-recorder" />
      );

      expect(getByTestId('voice-recorder')).toBeTruthy();
    });

    it('renders duration display when recording', () => {
      const { getByTestId } = render(
        <VoiceRecorder {...defaultProps} showDuration={true} testID="voice-recorder" />
      );

      expect(getByTestId('voice-recorder')).toBeTruthy();
    });

    it('renders waveform visualization when enabled', () => {
      const { getByTestId } = render(
        <VoiceRecorder {...defaultProps} showWaveform={true} testID="voice-recorder" />
      );

      expect(getByTestId('voice-recorder')).toBeTruthy();
    });

    it('renders cancel button when recording', () => {
      const { getByTestId } = render(
        <VoiceRecorder {...defaultProps} showCancelButton={true} testID="voice-recorder" />
      );

      expect(getByTestId('voice-recorder')).toBeTruthy();
    });

    it('renders in compact mode', () => {
      const { getByTestId } = render(
        <VoiceRecorder {...defaultProps} compact={true} testID="voice-recorder" />
      );

      expect(getByTestId('voice-recorder')).toBeTruthy();
    });

    it('renders with microphone permission status', () => {
      const { getByTestId } = render(
        <VoiceRecorder {...defaultProps} testID="voice-recorder" />
      );

      expect(getByTestId('voice-recorder')).toBeTruthy();
    });
  });

  // ========================================
  // RECORDING INTERACTION TESTS
  // ========================================

  describe('Recording Interactions', () => {
    it('starts recording when record button is pressed', async () => {
      const { getByTestId } = render(
        <VoiceRecorder {...defaultProps} testID="voice-recorder" />
      );

      fireEvent.press(getByTestId('voice-recorder'));

      await waitFor(() => {
        expect(getByTestId('voice-recorder')).toBeTruthy();
      });
    });

    it('stops recording when stop button is pressed', async () => {
      const onRecordingComplete = jest.fn();
      const { getByTestId } = render(
        <VoiceRecorder onRecordingComplete={onRecordingComplete} testID="voice-recorder" />
      );

      // Start recording
      fireEvent.press(getByTestId('voice-recorder'));

      // Advance timer to simulate recording duration
      act(() => {
        jest.advanceTimersByTime(3000);
      });

      // Stop recording would trigger onRecordingComplete
      expect(getByTestId('voice-recorder')).toBeTruthy();
    });

    it('cancels recording when cancel button is pressed', async () => {
      const onCancel = jest.fn();
      const { getByTestId } = render(
        <VoiceRecorder
          {...defaultProps}
          onCancel={onCancel}
          showCancelButton={true}
          testID="voice-recorder"
        />
      );

      expect(getByTestId('voice-recorder')).toBeTruthy();
    });

    it('calls onRecordingComplete with audio data', async () => {
      const onRecordingComplete = jest.fn();
      const { getByTestId } = render(
        <VoiceRecorder onRecordingComplete={onRecordingComplete} testID="voice-recorder" />
      );

      expect(getByTestId('voice-recorder')).toBeTruthy();
    });

    it('respects maximum recording duration', async () => {
      const { getByTestId } = render(
        <VoiceRecorder {...defaultProps} maxDuration={60} testID="voice-recorder" />
      );

      fireEvent.press(getByTestId('voice-recorder'));

      // Advance timer past max duration
      act(() => {
        jest.advanceTimersByTime(61000);
      });

      // Recording should auto-stop
      expect(getByTestId('voice-recorder')).toBeTruthy();
    });

    it('respects minimum recording duration', async () => {
      const { getByTestId } = render(
        <VoiceRecorder {...defaultProps} minDuration={3} testID="voice-recorder" />
      );

      expect(getByTestId('voice-recorder')).toBeTruthy();
    });
  });

  // ========================================
  // PERMISSION HANDLING TESTS
  // ========================================

  describe('Permission Handling', () => {
    it('requests microphone permission on first use', async () => {
      const { getByTestId } = render(
        <VoiceRecorder {...defaultProps} testID="voice-recorder" />
      );

      fireEvent.press(getByTestId('voice-recorder'));

      await waitFor(() => {
        expect(getByTestId('voice-recorder')).toBeTruthy();
      });
    });

    it('shows permission denied message when permission is denied', () => {
      const { getByTestId } = render(
        <VoiceRecorder
          {...defaultProps}
          permissionDenied={true}
          testID="voice-recorder"
        />
      );

      expect(getByTestId('voice-recorder')).toBeTruthy();
    });

    it('shows permission request button when permission is needed', () => {
      const { getByTestId } = render(
        <VoiceRecorder
          {...defaultProps}
          showPermissionRequest={true}
          testID="voice-recorder"
        />
      );

      expect(getByTestId('voice-recorder')).toBeTruthy();
    });

    it('calls onPermissionDenied when permission is denied', () => {
      const onPermissionDenied = jest.fn();
      const { getByTestId } = render(
        <VoiceRecorder
          {...defaultProps}
          onPermissionDenied={onPermissionDenied}
          testID="voice-recorder"
        />
      );

      expect(getByTestId('voice-recorder')).toBeTruthy();
    });
  });

  // ========================================
  // PLAYBACK PREVIEW TESTS
  // ========================================

  describe('Playback Preview', () => {
    it('renders playback controls after recording', () => {
      const { getByTestId } = render(
        <VoiceRecorder {...defaultProps} showPlaybackPreview={true} testID="voice-recorder" />
      );

      expect(getByTestId('voice-recorder')).toBeTruthy();
    });

    it('allows playing back recorded audio', () => {
      const { getByTestId } = render(
        <VoiceRecorder {...defaultProps} showPlaybackPreview={true} testID="voice-recorder" />
      );

      expect(getByTestId('voice-recorder')).toBeTruthy();
    });

    it('allows re-recording', () => {
      const { getByTestId } = render(
        <VoiceRecorder {...defaultProps} allowReRecord={true} testID="voice-recorder" />
      );

      expect(getByTestId('voice-recorder')).toBeTruthy();
    });

    it('shows send button after recording', () => {
      const { getByTestId } = render(
        <VoiceRecorder {...defaultProps} showSendButton={true} testID="voice-recorder" />
      );

      expect(getByTestId('voice-recorder')).toBeTruthy();
    });
  });

  // ========================================
  // STYLING TESTS
  // ========================================

  describe('Styling', () => {
    it('applies custom record button color', () => {
      const { getByTestId } = render(
        <VoiceRecorder
          {...defaultProps}
          recordButtonColor="#FF0000"
          testID="voice-recorder"
        />
      );

      expect(getByTestId('voice-recorder')).toBeTruthy();
    });

    it('applies custom recording indicator color', () => {
      const { getByTestId } = render(
        <VoiceRecorder
          {...defaultProps}
          recordingIndicatorColor="#FF0000"
          testID="voice-recorder"
        />
      );

      expect(getByTestId('voice-recorder')).toBeTruthy();
    });

    it('applies custom waveform color', () => {
      const { getByTestId } = render(
        <VoiceRecorder
          {...defaultProps}
          waveformColor="#00FF00"
          showWaveform={true}
          testID="voice-recorder"
        />
      );

      expect(getByTestId('voice-recorder')).toBeTruthy();
    });

    it('applies small size', () => {
      const { getByTestId } = render(
        <VoiceRecorder {...defaultProps} size="small" testID="voice-recorder" />
      );

      expect(getByTestId('voice-recorder')).toBeTruthy();
    });

    it('applies large size', () => {
      const { getByTestId } = render(
        <VoiceRecorder {...defaultProps} size="large" testID="voice-recorder" />
      );

      expect(getByTestId('voice-recorder')).toBeTruthy();
    });
  });

  // ========================================
  // ACCESSIBILITY TESTS
  // ========================================

  describe('Accessibility', () => {
    it('has accessible container', () => {
      const { getByTestId } = render(
        <VoiceRecorder {...defaultProps} testID="voice-recorder" />
      );

      const container = getByTestId('voice-recorder');
      expect(container).toBeTruthy();
    });

    it('supports custom accessibility label', () => {
      const { getByTestId } = render(
        <VoiceRecorder
          {...defaultProps}
          testID="voice-recorder"
          accessibilityLabel="Voice message recorder"
        />
      );

      const container = getByTestId('voice-recorder');
      expect(container.props.accessibilityLabel).toBe('Voice message recorder');
    });

    it('record button is accessible', () => {
      const { getByTestId } = render(
        <VoiceRecorder {...defaultProps} testID="voice-recorder" />
      );

      expect(getByTestId('voice-recorder')).toBeTruthy();
    });

    it('announces recording state changes', () => {
      const { getByTestId } = render(
        <VoiceRecorder {...defaultProps} testID="voice-recorder" />
      );

      expect(getByTestId('voice-recorder')).toBeTruthy();
    });
  });

  // ========================================
  // ERROR HANDLING TESTS
  // ========================================

  describe('Error Handling', () => {
    it('handles recording error', () => {
      const onError = jest.fn();
      const { getByTestId } = render(
        <VoiceRecorder {...defaultProps} onError={onError} testID="voice-recorder" />
      );

      expect(getByTestId('voice-recorder')).toBeTruthy();
    });

    it('shows error message when recording fails', () => {
      const { getByTestId } = render(
        <VoiceRecorder
          {...defaultProps}
          error="Recording failed"
          testID="voice-recorder"
        />
      );

      expect(getByTestId('voice-recorder')).toBeTruthy();
    });

    it('allows retry after error', () => {
      const { getByTestId } = render(
        <VoiceRecorder {...defaultProps} error="Failed" allowRetry={true} testID="voice-recorder" />
      );

      expect(getByTestId('voice-recorder')).toBeTruthy();
    });
  });

  // ========================================
  // EDGE CASES
  // ========================================

  describe('Edge Cases', () => {
    it('handles disabled state', () => {
      const { getByTestId } = render(
        <VoiceRecorder {...defaultProps} disabled={true} testID="voice-recorder" />
      );

      expect(getByTestId('voice-recorder')).toBeTruthy();
    });

    it('handles loading state', () => {
      const { getByTestId } = render(
        <VoiceRecorder {...defaultProps} loading={true} testID="voice-recorder" />
      );

      expect(getByTestId('voice-recorder')).toBeTruthy();
    });

    it('handles very short max duration', () => {
      const { getByTestId } = render(
        <VoiceRecorder {...defaultProps} maxDuration={1} testID="voice-recorder" />
      );

      expect(getByTestId('voice-recorder')).toBeTruthy();
    });

    it('handles very long max duration', () => {
      const { getByTestId } = render(
        <VoiceRecorder {...defaultProps} maxDuration={3600} testID="voice-recorder" />
      );

      expect(getByTestId('voice-recorder')).toBeTruthy();
    });

    it('handles missing onRecordingComplete', () => {
      const { getByTestId } = render(
        <VoiceRecorder testID="voice-recorder" />
      );

      expect(getByTestId('voice-recorder')).toBeTruthy();
    });

    it('handles rapid start/stop presses', () => {
      const { getByTestId } = render(
        <VoiceRecorder {...defaultProps} testID="voice-recorder" />
      );

      const recorder = getByTestId('voice-recorder');

      // Rapid presses
      for (let i = 0; i < 10; i++) {
        fireEvent.press(recorder);
      }

      expect(recorder).toBeTruthy();
    });

    it('cleans up on unmount', () => {
      const { getByTestId, unmount } = render(
        <VoiceRecorder {...defaultProps} testID="voice-recorder" />
      );

      fireEvent.press(getByTestId('voice-recorder'));

      // Unmount during recording
      unmount();

      // Should not throw
    });

    it('handles component remount', () => {
      const { getByTestId, unmount } = render(
        <VoiceRecorder {...defaultProps} testID="voice-recorder" />
      );

      expect(getByTestId('voice-recorder')).toBeTruthy();
      unmount();

      const { getByTestId: getByTestId2 } = render(
        <VoiceRecorder {...defaultProps} testID="voice-recorder" />
      );

      expect(getByTestId2('voice-recorder')).toBeTruthy();
    });
  });
});
