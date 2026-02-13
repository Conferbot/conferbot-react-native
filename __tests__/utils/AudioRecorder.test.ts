/**
 * AudioRecorder Tests
 *
 * Tests for the AudioRecorder utility functions.
 * Note: Native module tests (expo-av, react-native-audio-recorder-player)
 * require the actual native modules to be installed and are skipped in unit tests.
 * These should be covered by integration tests with actual native modules.
 */

import {
  AudioRecorderError,
  formatDuration,
  formatDurationDetailed,
  normalizeMeteringLevel,
  isAudioRecorderAvailable,
  getAvailableAudioLibrary,
} from '../../src/utils/AudioRecorder';

describe('AudioRecorder', () => {
  // ========================================
  // UTILITY FUNCTION TESTS
  // ========================================

  describe('Utility Functions', () => {
    describe('formatDuration', () => {
      it('should format 0 milliseconds', () => {
        expect(formatDuration(0)).toBe('0:00');
      });

      it('should format seconds only', () => {
        expect(formatDuration(5000)).toBe('0:05');
        expect(formatDuration(30000)).toBe('0:30');
        expect(formatDuration(59000)).toBe('0:59');
      });

      it('should format minutes and seconds', () => {
        expect(formatDuration(60000)).toBe('1:00');
        expect(formatDuration(90000)).toBe('1:30');
        expect(formatDuration(125000)).toBe('2:05');
        expect(formatDuration(3600000)).toBe('60:00');
      });

      it('should pad seconds with leading zero', () => {
        expect(formatDuration(5000)).toBe('0:05');
        expect(formatDuration(65000)).toBe('1:05');
      });

      it('should handle negative values', () => {
        // Note: Implementation does not clamp negative values
        const result = formatDuration(-1000);
        expect(typeof result).toBe('string');
      });

      it('should handle very large values', () => {
        expect(formatDuration(7200000)).toBe('120:00');
      });
    });

    describe('formatDurationDetailed', () => {
      it('should include milliseconds', () => {
        expect(formatDurationDetailed(0)).toBe('0:00.00');
        expect(formatDurationDetailed(1500)).toBe('0:01.50');
        expect(formatDurationDetailed(65750)).toBe('1:05.75');
      });

      it('should format full precision', () => {
        expect(formatDurationDetailed(123456)).toBe('2:03.45');
      });

      it('should handle edge cases', () => {
        expect(formatDurationDetailed(999)).toBe('0:00.99');
        expect(formatDurationDetailed(1001)).toBe('0:01.00');
      });
    });

    describe('normalizeMeteringLevel', () => {
      it('should normalize -60 dB to 0', () => {
        expect(normalizeMeteringLevel(-60)).toBe(0);
      });

      it('should normalize 0 dB to 1', () => {
        expect(normalizeMeteringLevel(0)).toBe(1);
      });

      it('should normalize -30 dB to 0.5', () => {
        expect(normalizeMeteringLevel(-30)).toBe(0.5);
      });

      it('should normalize intermediate values', () => {
        expect(normalizeMeteringLevel(-45)).toBe(0.25);
        expect(normalizeMeteringLevel(-15)).toBe(0.75);
      });

      it('should clamp values below -60 dB', () => {
        expect(normalizeMeteringLevel(-100)).toBe(0);
        expect(normalizeMeteringLevel(-160)).toBe(0);
      });

      it('should clamp values above 0 dB', () => {
        expect(normalizeMeteringLevel(10)).toBe(1);
        expect(normalizeMeteringLevel(100)).toBe(1);
      });
    });

    describe('isAudioRecorderAvailable', () => {
      it('should be a function', () => {
        expect(typeof isAudioRecorderAvailable).toBe('function');
      });

      it('should return a boolean', () => {
        const result = isAudioRecorderAvailable();
        expect(typeof result).toBe('boolean');
      });
    });

    describe('getAvailableAudioLibrary', () => {
      it('should be a function', () => {
        expect(typeof getAvailableAudioLibrary).toBe('function');
      });

      it('should return string or null', () => {
        const result = getAvailableAudioLibrary();
        expect(result === null || typeof result === 'string').toBe(true);
      });
    });
  });

  // ========================================
  // AUDIO RECORDER ERROR TESTS
  // ========================================

  describe('AudioRecorderError', () => {
    it('should create error with code and message', () => {
      const error = new AudioRecorderError('PERMISSION_DENIED', 'Microphone permission denied');

      expect(error.code).toBe('PERMISSION_DENIED');
      expect(error.message).toBe('Microphone permission denied');
      expect(error.name).toBe('AudioRecorderError');
    });

    it('should be instanceof Error', () => {
      const error = new AudioRecorderError('TEST', 'Test error');
      expect(error instanceof Error).toBe(true);
    });

    it('should have proper stack trace', () => {
      const error = new AudioRecorderError('STACK_TEST', 'Stack trace test');
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('AudioRecorderError');
    });

    it('should support different error codes', () => {
      const codes = ['PERMISSION_DENIED', 'NOT_AVAILABLE', 'RECORDING_FAILED', 'PLAYBACK_FAILED'];

      codes.forEach(code => {
        const error = new AudioRecorderError(code as any, `Error: ${code}`);
        expect(error.code).toBe(code);
      });
    });
  });

  // ========================================
  // INTEGRATION TESTS (Skipped - require native modules)
  // ========================================

  describe.skip('Native Module Integration', () => {
    // These tests require actual native modules to be installed
    // They should be run in an integration test environment

    it('should request microphone permission', async () => {
      // Requires expo-av or react-native-audio-recorder-player
    });

    it('should start recording', async () => {
      // Requires native audio module
    });

    it('should stop recording and return audio file', async () => {
      // Requires native audio module
    });

    it('should play audio file', async () => {
      // Requires native audio module
    });

    it('should handle pause/resume during recording', async () => {
      // Requires native audio module
    });

    it('should provide metering data for waveform visualization', async () => {
      // Requires native audio module with metering support
    });
  });
});
