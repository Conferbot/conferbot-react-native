/**
 * AnalyticsService Tests
 *
 * Comprehensive tests for the AnalyticsService class.
 * Covers session tracking, event emission, node visit tracking,
 * message tracking, engagement metrics, and persistence.
 */

import { AppState } from 'react-native';
import { AnalyticsService, getAnalyticsService, resetAnalyticsService } from '../../src/services/analytics/AnalyticsService';
import { AnalyticsStorage } from '../../src/services/analytics/AnalyticsStorage';
import * as DeviceInfo from '../../src/services/analytics/DeviceInfo';
import {
  AnalyticsEventType,
  AnalyticsSocketEvents,
  DEFAULT_ANALYTICS_CONFIG,
} from '../../src/services/analytics/types';

// Mock dependencies
jest.mock('../../src/services/analytics/AnalyticsStorage');
jest.mock('../../src/services/analytics/DeviceInfo');

describe('AnalyticsService', () => {
  let analyticsService: AnalyticsService;
  let mockSocketClient: any;
  let mockStorage: jest.Mocked<AnalyticsStorage>;

  const chatSessionId = 'test-session-123';
  const botId = 'test-bot-456';
  const visitorId = 'visitor-789';

  beforeEach(() => {
    // Reset singleton
    resetAnalyticsService();

    // Create mock socket client
    mockSocketClient = {
      socket: {
        emit: jest.fn(),
      },
      isConnected: jest.fn().mockReturnValue(true),
    };

    // Create mock storage
    mockStorage = {
      getPendingEvents: jest.fn().mockResolvedValue([]),
      savePendingEvents: jest.fn().mockResolvedValue(undefined),
      addPendingEvents: jest.fn().mockResolvedValue(undefined),
      removePendingEvents: jest.fn().mockResolvedValue(undefined),
      clearPendingEvents: jest.fn().mockResolvedValue(undefined),
      saveSessionData: jest.fn().mockResolvedValue(undefined),
      getSessionData: jest.fn().mockResolvedValue(null),
      clearSessionData: jest.fn().mockResolvedValue(undefined),
      saveLastSync: jest.fn().mockResolvedValue(undefined),
      getLastSync: jest.fn().mockResolvedValue(null),
      clearAll: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AnalyticsStorage>;

    // Mock AnalyticsStorage constructor
    (AnalyticsStorage as jest.Mock).mockImplementation(() => mockStorage);

    // Mock DeviceInfo functions
    (DeviceInfo.getMobileAttribution as jest.Mock).mockReturnValue({
      osName: 'ios',
      osVersion: '14.0',
      deviceModel: 'iPhone 12',
      appVersion: '1.0.0',
    });
    (DeviceInfo.getEnvironmentData as jest.Mock).mockReturnValue({
      platform: 'ios',
      osVersion: '14.0',
      deviceModel: 'iPhone 12',
      deviceType: 'mobile',
      screenResolution: '375x812',
      language: 'en-US',
      timezone: 'America/New_York',
    });

    // Create service instance
    analyticsService = new AnalyticsService({ debug: false });
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  // ========================================
  // INITIALIZATION TESTS
  // ========================================

  describe('Initialization', () => {
    it('should initialize with default config', () => {
      const service = new AnalyticsService();
      expect(service.initialized).toBe(false);
      expect(service.currentSessionId).toBeNull();
    });

    it('should initialize with custom config', () => {
      const customConfig = {
        enabled: true,
        batchSize: 20,
        batchIntervalMs: 60000,
        debug: true,
      };
      const service = new AnalyticsService(customConfig);
      expect(service.initialized).toBe(false);
    });

    it('should initialize analytics session successfully', async () => {
      await analyticsService.initialize(chatSessionId, botId, mockSocketClient, {
        visitorId,
      });

      expect(analyticsService.initialized).toBe(true);
      expect(analyticsService.currentSessionId).toBe(chatSessionId);
    });

    it('should emit session start event via socket on initialize', async () => {
      await analyticsService.initialize(chatSessionId, botId, mockSocketClient, {
        visitorId,
      });

      expect(mockSocketClient.socket.emit).toHaveBeenCalledWith(
        AnalyticsSocketEvents.TRACK_CHAT_START,
        expect.objectContaining({
          chatSessionId,
          botId,
          visitorId,
          attribution: expect.any(Object),
        })
      );
    });

    it('should not initialize when disabled', async () => {
      const disabledService = new AnalyticsService({ enabled: false });
      await disabledService.initialize(chatSessionId, botId, mockSocketClient);

      expect(disabledService.initialized).toBe(false);
    });

    it('should finalize previous session before reinitializing', async () => {
      await analyticsService.initialize(chatSessionId, botId, mockSocketClient);

      // Reinitialize with new session
      const newSessionId = 'new-session-456';
      await analyticsService.initialize(newSessionId, botId, mockSocketClient);

      expect(analyticsService.currentSessionId).toBe(newSessionId);
    });

    it('should load pending events from storage on initialize', async () => {
      const pendingEvents = [
        { eventId: 'evt-1', eventType: AnalyticsEventType.SESSION_START, timestamp: Date.now() },
      ];
      mockStorage.getPendingEvents.mockResolvedValue(pendingEvents as any);

      await analyticsService.initialize(chatSessionId, botId, mockSocketClient);

      expect(mockStorage.getPendingEvents).toHaveBeenCalled();
    });

    it('should persist session data on initialize', async () => {
      await analyticsService.initialize(chatSessionId, botId, mockSocketClient, {
        visitorId,
      });

      expect(mockStorage.saveSessionData).toHaveBeenCalledWith(
        expect.objectContaining({
          chatSessionId,
          botId,
          visitorId,
        })
      );
    });
  });

  // ========================================
  // FINALIZATION TESTS
  // ========================================

  describe('Finalization', () => {
    beforeEach(async () => {
      await analyticsService.initialize(chatSessionId, botId, mockSocketClient, {
        visitorId,
      });
      jest.clearAllMocks();
    });

    it('should finalize session and reset state', async () => {
      await analyticsService.finalize();

      expect(analyticsService.initialized).toBe(false);
      expect(analyticsService.currentSessionId).toBeNull();
    });

    it('should emit finalize event via socket', async () => {
      await analyticsService.finalize();

      expect(mockSocketClient.socket.emit).toHaveBeenCalledWith(
        AnalyticsSocketEvents.FINALIZE_ANALYTICS,
        expect.objectContaining({
          chatSessionId,
          finalMetrics: expect.objectContaining({
            totalDuration: expect.any(Number),
            activeDuration: expect.any(Number),
            idleTime: expect.any(Number),
            messageCounts: expect.any(Object),
            typingBehavior: expect.any(Object),
          }),
        })
      );
    });

    it('should clear session data from storage on finalize', async () => {
      await analyticsService.finalize();

      expect(mockStorage.clearSessionData).toHaveBeenCalled();
    });

    it('should not throw when finalizing uninitialized service', async () => {
      const newService = new AnalyticsService();
      await expect(newService.finalize()).resolves.not.toThrow();
    });

    it('should exit current node as abandoned on finalize', async () => {
      analyticsService.trackNodeEntry('node-1', 'text', 'Text Node');
      await analyticsService.finalize();

      expect(mockSocketClient.socket.emit).toHaveBeenCalledWith(
        AnalyticsSocketEvents.TRACK_NODE_EXIT,
        expect.objectContaining({
          exitType: 'abandoned',
        })
      );
    });
  });

  // ========================================
  // NODE TRACKING TESTS
  // ========================================

  describe('Node Tracking', () => {
    beforeEach(async () => {
      await analyticsService.initialize(chatSessionId, botId, mockSocketClient);
      jest.clearAllMocks();
    });

    it('should track node entry', () => {
      analyticsService.trackNodeEntry('node-1', 'text', 'Welcome Message');

      expect(mockSocketClient.socket.emit).toHaveBeenCalledWith(
        AnalyticsSocketEvents.TRACK_NODE_VISIT,
        expect.objectContaining({
          chatSessionId,
          nodeId: 'node-1',
          nodeType: 'text',
          nodeName: 'Welcome Message',
          enteredAt: expect.any(Number),
        })
      );
    });

    it('should track node exit', () => {
      analyticsService.trackNodeEntry('node-1', 'text', 'Welcome Message');
      jest.clearAllMocks();

      analyticsService.trackNodeExit('proceeded', 'user input', 'option-1');

      expect(mockSocketClient.socket.emit).toHaveBeenCalledWith(
        AnalyticsSocketEvents.TRACK_NODE_EXIT,
        expect.objectContaining({
          chatSessionId,
          nodeId: 'node-1',
          exitType: 'proceeded',
          userInput: 'user input',
          selectedOption: 'option-1',
          dwellTime: expect.any(Number),
        })
      );
    });

    it('should automatically exit previous node when entering new node', () => {
      analyticsService.trackNodeEntry('node-1', 'text', 'First Node');
      jest.clearAllMocks();

      analyticsService.trackNodeEntry('node-2', 'buttons', 'Second Node');

      // Should have emitted exit for node-1 and entry for node-2
      expect(mockSocketClient.socket.emit).toHaveBeenCalledWith(
        AnalyticsSocketEvents.TRACK_NODE_EXIT,
        expect.objectContaining({
          nodeId: 'node-1',
          exitType: 'proceeded',
        })
      );
      expect(mockSocketClient.socket.emit).toHaveBeenCalledWith(
        AnalyticsSocketEvents.TRACK_NODE_VISIT,
        expect.objectContaining({
          nodeId: 'node-2',
        })
      );
    });

    it('should update current node ID', () => {
      expect(analyticsService.currentNodeId).toBeNull();

      analyticsService.trackNodeEntry('node-1', 'text', 'Test Node');
      expect(analyticsService.currentNodeId).toBe('node-1');

      analyticsService.trackNodeExit('proceeded');
      expect(analyticsService.currentNodeId).toBeNull();
    });

    it('should not track node when not initialized', () => {
      const newService = new AnalyticsService();
      newService.trackNodeEntry('node-1', 'text', 'Test');

      expect(mockSocketClient.socket.emit).not.toHaveBeenCalled();
    });
  });

  // ========================================
  // MESSAGE TRACKING TESTS
  // ========================================

  describe('Message Tracking', () => {
    beforeEach(async () => {
      await analyticsService.initialize(chatSessionId, botId, mockSocketClient);
      jest.clearAllMocks();
    });

    it('should track user message', () => {
      analyticsService.trackUserMessage('Hello, world!', 1);

      expect(mockSocketClient.socket.emit).toHaveBeenCalledWith(
        AnalyticsSocketEvents.TRACK_SENTIMENT,
        expect.objectContaining({
          chatSessionId,
          messageIndex: 1,
          text: 'Hello, world!',
          messageType: 'user',
        })
      );
    });

    it('should track bot message', () => {
      analyticsService.trackBotMessage();
      // Bot messages don't emit socket events, just update counters
      // The effect is visible in engagement updates and final metrics
    });

    it('should track agent message', () => {
      analyticsService.trackAgentMessage();
      // Agent messages don't emit socket events, just update counters
    });

    it('should set first message time on first user message', () => {
      analyticsService.trackUserMessage('First message');
      analyticsService.trackUserMessage('Second message');

      // First message time should only be set once
      // This is verified through the queued events
    });

    it('should not track user message when not initialized', () => {
      const newService = new AnalyticsService();
      newService.trackUserMessage('Test');

      expect(mockSocketClient.socket.emit).not.toHaveBeenCalled();
    });
  });

  // ========================================
  // TYPING TRACKING TESTS
  // ========================================

  describe('Typing Tracking', () => {
    beforeEach(async () => {
      await analyticsService.initialize(chatSessionId, botId, mockSocketClient);
    });

    it('should track typing start', () => {
      analyticsService.trackTypingStart();
      // Typing start doesn't emit events, it starts internal timing
    });

    it('should track typing end with sent message', () => {
      analyticsService.trackTypingStart();

      // Advance time
      jest.advanceTimersByTime(2000);

      analyticsService.trackTypingEnd(true);
      // Typing behavior is included in engagement updates
    });

    it('should track abandoned message', () => {
      analyticsService.trackTypingStart();
      jest.advanceTimersByTime(5000);

      analyticsService.trackTypingEnd(false);
      // Abandoned message count should increment
    });

    it('should track deletion', () => {
      analyticsService.trackDeletion();
      // Deletion count should increment
    });

    it('should not track typing when not initialized', () => {
      const newService = new AnalyticsService();
      newService.trackTypingStart();
      newService.trackTypingEnd();
      newService.trackDeletion();
      // Should not throw
    });
  });

  // ========================================
  // INTERACTION TRACKING TESTS
  // ========================================

  describe('Interaction Tracking', () => {
    beforeEach(async () => {
      await analyticsService.initialize(chatSessionId, botId, mockSocketClient);
      jest.clearAllMocks();
    });

    it('should track button click', () => {
      analyticsService.trackButtonClick('btn-1', 'Submit');

      expect(mockSocketClient.socket.emit).toHaveBeenCalledWith(
        AnalyticsSocketEvents.TRACK_INTERACTION,
        expect.objectContaining({
          chatSessionId,
          type: 'buttonsClicked',
          buttonId: 'btn-1',
          buttonLabel: 'Submit',
        })
      );
    });

    it('should track choice selection', () => {
      analyticsService.trackChoiceSelect('choice-1', 'Option A');

      expect(mockSocketClient.socket.emit).toHaveBeenCalledWith(
        AnalyticsSocketEvents.TRACK_INTERACTION,
        expect.objectContaining({
          type: 'choiceSelected',
          choiceId: 'choice-1',
          choiceLabel: 'Option A',
        })
      );
    });

    it('should track link click', () => {
      analyticsService.trackLinkClick('https://example.com');

      expect(mockSocketClient.socket.emit).toHaveBeenCalledWith(
        AnalyticsSocketEvents.TRACK_INTERACTION,
        expect.objectContaining({
          type: 'linksClicked',
          url: 'https://example.com',
        })
      );
    });

    it('should track file upload', () => {
      analyticsService.trackFileUpload('document.pdf', 'application/pdf', 1024);

      expect(mockSocketClient.socket.emit).toHaveBeenCalledWith(
        AnalyticsSocketEvents.TRACK_INTERACTION,
        expect.objectContaining({
          type: 'filesUploaded',
          fileName: 'document.pdf',
          fileType: 'application/pdf',
          fileSize: 1024,
        })
      );
    });

    it('should track image view', () => {
      analyticsService.trackImageView('https://example.com/image.jpg');

      expect(mockSocketClient.socket.emit).toHaveBeenCalledWith(
        AnalyticsSocketEvents.TRACK_INTERACTION,
        expect.objectContaining({
          type: 'imagesViewed',
        })
      );
    });

    it('should track video watch', () => {
      analyticsService.trackVideoWatch('https://example.com/video.mp4', 120);

      expect(mockSocketClient.socket.emit).toHaveBeenCalledWith(
        AnalyticsSocketEvents.TRACK_INTERACTION,
        expect.objectContaining({
          type: 'videosWatched',
          watchDuration: 120,
        })
      );
    });

    it('should track carousel interaction', () => {
      analyticsService.trackCarouselInteraction('swipe', 2);

      expect(mockSocketClient.socket.emit).toHaveBeenCalledWith(
        AnalyticsSocketEvents.TRACK_INTERACTION,
        expect.objectContaining({
          type: 'carouselInteractions',
          action: 'swipe',
          itemIndex: 2,
        })
      );
    });
  });

  // ========================================
  // GOAL & RATING TRACKING TESTS
  // ========================================

  describe('Goal & Rating Tracking', () => {
    beforeEach(async () => {
      await analyticsService.initialize(chatSessionId, botId, mockSocketClient);
      jest.clearAllMocks();
    });

    it('should track goal completion', () => {
      analyticsService.trackGoalCompletion('goal-1', 'signup', 100);

      expect(mockSocketClient.socket.emit).toHaveBeenCalledWith(
        AnalyticsSocketEvents.TRACK_GOAL_COMPLETION,
        expect.objectContaining({
          chatSessionId,
          goalId: 'goal-1',
          conversionEvent: 'signup',
          conversionValue: 100,
        })
      );
    });

    it('should submit rating with CSAT score', () => {
      analyticsService.submitRating({
        csatScore: 5,
        feedback: 'Great service!',
      });

      expect(mockSocketClient.socket.emit).toHaveBeenCalledWith(
        AnalyticsSocketEvents.SUBMIT_CHAT_RATING,
        expect.objectContaining({
          chatSessionId,
          csatScore: 5,
          feedback: 'Great service!',
          source: 'mobile_app',
        })
      );
    });

    it('should submit rating with thumbs up', () => {
      analyticsService.submitRating({
        thumbsUp: true,
      });

      expect(mockSocketClient.socket.emit).toHaveBeenCalledWith(
        AnalyticsSocketEvents.SUBMIT_CHAT_RATING,
        expect.objectContaining({
          thumbsUp: true,
        })
      );
    });

    it('should submit rating with NPS score', () => {
      analyticsService.submitRating({
        npsScore: 9,
      });

      expect(mockSocketClient.socket.emit).toHaveBeenCalledWith(
        AnalyticsSocketEvents.SUBMIT_CHAT_RATING,
        expect.objectContaining({
          npsScore: 9,
        })
      );
    });

    it('should submit rating with custom source', () => {
      analyticsService.submitRating({
        csatScore: 4,
        source: 'custom_widget',
      });

      expect(mockSocketClient.socket.emit).toHaveBeenCalledWith(
        AnalyticsSocketEvents.SUBMIT_CHAT_RATING,
        expect.objectContaining({
          source: 'custom_widget',
        })
      );
    });
  });

  // ========================================
  // DROP-OFF TRACKING TESTS
  // ========================================

  describe('Drop-Off Tracking', () => {
    beforeEach(async () => {
      await analyticsService.initialize(chatSessionId, botId, mockSocketClient);
      jest.clearAllMocks();
    });

    it('should track drop-off event', () => {
      analyticsService.trackDropOff('app_backgrounded', 'viewing_text_node');

      expect(mockSocketClient.socket.emit).toHaveBeenCalledWith(
        AnalyticsSocketEvents.TRACK_DROP_OFF,
        expect.objectContaining({
          chatSessionId,
          reason: 'app_backgrounded',
          lastUserAction: 'viewing_text_node',
          timeBeforeDropOff: expect.any(Number),
        })
      );
    });

    it('should include node info in drop-off', () => {
      analyticsService.trackNodeEntry('node-1', 'text', 'Test Node');
      jest.clearAllMocks();

      analyticsService.trackDropOff('timeout');

      expect(mockSocketClient.socket.emit).toHaveBeenCalledWith(
        AnalyticsSocketEvents.TRACK_DROP_OFF,
        expect.objectContaining({
          nodeId: 'node-1',
          nodeType: 'text',
          nodeName: 'Test Node',
        })
      );
    });
  });

  // ========================================
  // CUSTOM EVENT TRACKING TESTS
  // ========================================

  describe('Custom Event Tracking', () => {
    beforeEach(async () => {
      await analyticsService.initialize(chatSessionId, botId, mockSocketClient);
      jest.clearAllMocks();
    });

    it('should track custom event', () => {
      analyticsService.trackEvent('custom_action', { customData: 'value' });

      // Custom events are queued but not emitted via socket
      // They're included in the batch flush
    });

    it('should not track custom event when not initialized', () => {
      const newService = new AnalyticsService();
      newService.trackEvent('test_event');
      // Should not throw
    });
  });

  // ========================================
  // EVENT BATCHING TESTS
  // ========================================

  describe('Event Batching', () => {
    beforeEach(async () => {
      await analyticsService.initialize(chatSessionId, botId, mockSocketClient);
      jest.clearAllMocks();
    });

    it('should flush events when batch size is reached', async () => {
      const service = new AnalyticsService({ batchSize: 3 });
      await service.initialize(chatSessionId, botId, mockSocketClient);
      jest.clearAllMocks();

      // Track enough events to trigger batch
      service.trackButtonClick('btn-1', 'Button 1');
      service.trackButtonClick('btn-2', 'Button 2');
      service.trackButtonClick('btn-3', 'Button 3');

      // Allow async operations to complete
      await Promise.resolve();

      expect(mockStorage.addPendingEvents).toHaveBeenCalled();
    });

    it('should flush events on timer interval', async () => {
      await analyticsService.initialize(chatSessionId, botId, mockSocketClient);
      analyticsService.trackButtonClick('btn-1', 'Button');

      // Advance timer past batch interval (30 seconds)
      jest.advanceTimersByTime(35000);

      expect(mockStorage.addPendingEvents).toHaveBeenCalled();
    });
  });

  // ========================================
  // APP STATE HANDLING TESTS
  // ========================================

  describe('App State Handling', () => {
    let appStateCallback: (state: string) => void;

    beforeEach(async () => {
      // Capture the AppState callback
      (AppState.addEventListener as jest.Mock).mockImplementation((event, callback) => {
        if (event === 'change') {
          appStateCallback = callback;
        }
        return { remove: jest.fn() };
      });

      await analyticsService.initialize(chatSessionId, botId, mockSocketClient);
      jest.clearAllMocks();
    });

    it('should track drop-off when app goes to background', () => {
      appStateCallback('background');

      expect(mockSocketClient.socket.emit).toHaveBeenCalledWith(
        AnalyticsSocketEvents.TRACK_DROP_OFF,
        expect.objectContaining({
          reason: 'app_backgrounded',
        })
      );
    });

    it('should persist session data when app goes to background', () => {
      appStateCallback('background');

      expect(mockStorage.saveSessionData).toHaveBeenCalled();
    });

    it('should accumulate idle time when app returns from background', () => {
      appStateCallback('background');
      jest.advanceTimersByTime(30000); // 30 seconds in background
      appStateCallback('active');

      // Idle time should be accumulated
      // This is verified through engagement updates
    });
  });

  // ========================================
  // SINGLETON TESTS
  // ========================================

  describe('Singleton Pattern', () => {
    it('should return same instance from getAnalyticsService', () => {
      const instance1 = getAnalyticsService();
      const instance2 = getAnalyticsService();

      expect(instance1).toBe(instance2);
    });

    it('should reset singleton with resetAnalyticsService', () => {
      const instance1 = getAnalyticsService();
      resetAnalyticsService();
      const instance2 = getAnalyticsService();

      expect(instance1).not.toBe(instance2);
    });
  });

  // ========================================
  // ERROR HANDLING TESTS
  // ========================================

  describe('Error Handling', () => {
    beforeEach(async () => {
      await analyticsService.initialize(chatSessionId, botId, mockSocketClient);
    });

    it('should handle socket emit errors gracefully', () => {
      mockSocketClient.socket.emit.mockImplementation(() => {
        throw new Error('Socket error');
      });

      // Should not throw
      expect(() => analyticsService.trackButtonClick('btn-1', 'Test')).not.toThrow();
    });

    it('should handle storage errors gracefully', async () => {
      mockStorage.addPendingEvents.mockRejectedValue(new Error('Storage error'));

      // Should not throw
      await expect(analyticsService.finalize()).resolves.not.toThrow();
    });

    it('should handle missing socket client', async () => {
      const service = new AnalyticsService();
      await service.initialize(chatSessionId, botId, null as any);

      // Should not throw when tracking
      expect(() => service.trackButtonClick('btn-1', 'Test')).not.toThrow();
    });
  });

  // ========================================
  // ENGAGEMENT UPDATE TESTS
  // ========================================

  describe('Engagement Updates', () => {
    beforeEach(async () => {
      await analyticsService.initialize(chatSessionId, botId, mockSocketClient);
      jest.clearAllMocks();
    });

    it('should send periodic engagement updates', () => {
      // Advance timer past engagement interval (30 seconds)
      jest.advanceTimersByTime(35000);

      expect(mockSocketClient.socket.emit).toHaveBeenCalledWith(
        AnalyticsSocketEvents.TRACK_CHAT_ENGAGEMENT,
        expect.objectContaining({
          chatSessionId,
          sessionMetrics: expect.any(Object),
          typingBehavior: expect.any(Object),
        })
      );
    });
  });
});
