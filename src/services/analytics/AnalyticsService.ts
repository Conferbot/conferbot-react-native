/**
 * AnalyticsService.ts
 *
 * Core analytics service for the Conferbot React Native SDK.
 * Handles tracking of session metrics, node analytics, user behavior,
 * and attribution with batching, persistence, and retry logic.
 */

import { AppState, AppStateStatus } from 'react-native';
import type ConferBotSocket from '../socket';
import { AnalyticsStorage, PersistedSessionData } from './AnalyticsStorage';
import { getMobileAttribution, getEnvironmentData } from './DeviceInfo';
import {
  AnalyticsEvent,
  AnalyticsEventType,
  AnalyticsConfig,
  DEFAULT_ANALYTICS_CONFIG,
  AnalyticsSocketEvents,
  NodeVisitData,
  NodeExitType,
  SessionMetrics,
  MessageCounts,
  TypingBehavior,
  DropOffReason,
  MobileAttribution,
} from './types';

// ========================================
// ANALYTICS SERVICE CLASS
// ========================================

export class AnalyticsService {
  // Configuration
  private config: AnalyticsConfig;

  // Socket client reference
  private socketClient: ConferBotSocket | null = null;

  // Storage for persistence
  private storage: AnalyticsStorage;

  // Session identification
  private chatSessionId: string | null = null;
  private botId: string | null = null;
  private visitorId: string | null = null;

  // Session timing
  private sessionStartTime: number = 0;
  private lastActivityTime: number = 0;
  private totalIdleTime: number = 0;
  private firstMessageTime: number | null = null;

  // Current node tracking
  private currentNodeData: NodeVisitData | null = null;

  // Message tracking
  private messageCount: number = 0;
  private userMessageCount: number = 0;
  private botMessageCount: number = 0;
  private agentMessageCount: number = 0;
  private totalMessageLength: number = 0;

  // Typing tracking
  private typingStartTime: number = 0;
  private totalTypingTime: number = 0;
  private deletionCount: number = 0;
  private abandonedMessageCount: number = 0;

  // Event queue for batching
  private eventQueue: AnalyticsEvent[] = [];
  private batchTimer: ReturnType<typeof setInterval> | null = null;
  private engagementTimer: ReturnType<typeof setInterval> | null = null;

  // App state tracking
  private appStateSubscription: any = null;
  private isAppActive: boolean = true;
  private backgroundTime: number = 0;

  // Retry tracking
  private retryCount: number = 0;
  private isSending: boolean = false;

  // Initialization state
  private isInitialized: boolean = false;

  constructor(config?: Partial<AnalyticsConfig>) {
    this.config = { ...DEFAULT_ANALYTICS_CONFIG, ...config };
    this.storage = new AnalyticsStorage({
      storageKeyPrefix: this.config.storageKeyPrefix,
      debug: this.config.debug,
    });
  }

  // ========================================
  // INITIALIZATION
  // ========================================

  /**
   * Initialize analytics tracking for a chat session
   */
  async initialize(
    chatSessionId: string,
    botId: string,
    socketClient: ConferBotSocket,
    options?: {
      visitorId?: string;
      appVersion?: string;
      buildNumber?: string;
      entryPoint?: string;
      deepLink?: string;
      pushNotificationId?: string;
    }
  ): Promise<void> {
    if (!this.config.enabled) {
      this.log('Analytics disabled');
      return;
    }

    if (this.isInitialized) {
      this.log('Already initialized, resetting first');
      await this.finalize();
    }

    this.chatSessionId = chatSessionId;
    this.botId = botId;
    this.visitorId = options?.visitorId;
    this.socketClient = socketClient;
    this.sessionStartTime = Date.now();
    this.lastActivityTime = this.sessionStartTime;
    this.isInitialized = true;

    // Get attribution data
    const attribution = getMobileAttribution({
      appVersion: options?.appVersion,
      buildNumber: options?.buildNumber,
      entryPoint: options?.entryPoint,
      deepLink: options?.deepLink,
      pushNotificationId: options?.pushNotificationId,
    });

    // Emit session start event via socket
    this.emitSocketEvent(AnalyticsSocketEvents.TRACK_CHAT_START, {
      chatSessionId,
      botId,
      visitorId: this.visitorId,
      attribution,
    });

    // Queue session start event
    this.queueEvent({
      eventId: this.generateEventId(),
      eventType: AnalyticsEventType.SESSION_START,
      timestamp: this.sessionStartTime,
      chatSessionId,
      botId,
      visitorId: this.visitorId,
      attribution,
    });

    // Start batch timer
    this.startBatchTimer();

    // Start periodic engagement updates
    this.startEngagementTimer();

    // Subscribe to app state changes
    this.subscribeToAppState();

    // Load any pending events from storage
    await this.loadPendingEvents();

    // Persist session data
    await this.persistSessionData();

    this.log('Analytics initialized', { chatSessionId, botId });
  }

  /**
   * Finalize analytics when chat ends
   */
  async finalize(): Promise<void> {
    if (!this.isInitialized || !this.chatSessionId) {
      return;
    }

    // Stop timers
    this.stopBatchTimer();
    this.stopEngagementTimer();

    // Unsubscribe from app state
    this.unsubscribeFromAppState();

    // Exit current node if any
    if (this.currentNodeData) {
      this.trackNodeExit('abandoned');
    }

    // Calculate final metrics
    const endTime = Date.now();
    const totalDuration = Math.floor((endTime - this.sessionStartTime) / 1000);
    const activeDuration = Math.max(0, totalDuration - Math.floor(this.totalIdleTime / 1000));

    const finalMetrics = {
      totalDuration,
      activeDuration,
      idleTime: Math.floor(this.totalIdleTime / 1000),
      messageCounts: this.getMessageCounts(),
      typingBehavior: this.getTypingBehavior(),
      environment: getEnvironmentData(),
    };

    // Emit finalize event via socket
    this.emitSocketEvent(AnalyticsSocketEvents.FINALIZE_ANALYTICS, {
      chatSessionId: this.chatSessionId,
      finalMetrics,
    });

    // Queue session end event
    this.queueEvent({
      eventId: this.generateEventId(),
      eventType: AnalyticsEventType.SESSION_END,
      timestamp: endTime,
      chatSessionId: this.chatSessionId,
      botId: this.botId!,
      visitorId: this.visitorId,
      finalMetrics,
    });

    // Flush remaining events
    await this.flushEvents();

    // Clear session data
    await this.storage.clearSessionData();

    // Reset state
    this.resetState();

    this.log('Analytics finalized');
  }

  // ========================================
  // NODE TRACKING
  // ========================================

  /**
   * Track node entry
   */
  trackNodeEntry(nodeId: string, nodeType: string, nodeName: string): void {
    if (!this.isInitialized || !this.chatSessionId) return;

    // Exit previous node if exists
    if (this.currentNodeData) {
      this.trackNodeExitInternal('proceeded');
    }

    this.currentNodeData = {
      nodeId,
      nodeType,
      nodeName,
      enteredAt: Date.now(),
    };

    // Emit via socket
    this.emitSocketEvent(AnalyticsSocketEvents.TRACK_NODE_VISIT, {
      chatSessionId: this.chatSessionId,
      nodeId,
      nodeType,
      nodeName,
      enteredAt: this.currentNodeData.enteredAt,
    });

    // Queue event
    this.queueEvent({
      eventId: this.generateEventId(),
      eventType: AnalyticsEventType.NODE_VISIT,
      timestamp: this.currentNodeData.enteredAt,
      chatSessionId: this.chatSessionId,
      botId: this.botId!,
      visitorId: this.visitorId,
      nodeId,
      nodeType,
      nodeName,
      enteredAt: this.currentNodeData.enteredAt,
    });

    this.updateActivity();
    this.log('Node entry tracked', { nodeId, nodeType });
  }

  /**
   * Track node exit
   */
  trackNodeExit(
    exitType: NodeExitType,
    userInput?: string,
    selectedOption?: string
  ): void {
    this.trackNodeExitInternal(exitType, userInput, selectedOption);
  }

  /**
   * Internal node exit tracking
   */
  private trackNodeExitInternal(
    exitType: NodeExitType,
    userInput?: string,
    selectedOption?: string
  ): void {
    if (!this.isInitialized || !this.chatSessionId || !this.currentNodeData) return;

    const exitedAt = Date.now();
    const dwellTime = Math.floor((exitedAt - this.currentNodeData.enteredAt) / 1000);

    // Emit via socket
    this.emitSocketEvent(AnalyticsSocketEvents.TRACK_NODE_EXIT, {
      chatSessionId: this.chatSessionId,
      nodeId: this.currentNodeData.nodeId,
      exitedAt,
      exitType,
      dwellTime,
      userInput,
      selectedOption,
    });

    // Queue event
    this.queueEvent({
      eventId: this.generateEventId(),
      eventType: AnalyticsEventType.NODE_EXIT,
      timestamp: exitedAt,
      chatSessionId: this.chatSessionId,
      botId: this.botId!,
      visitorId: this.visitorId,
      nodeId: this.currentNodeData.nodeId,
      exitedAt,
      exitType,
      dwellTime,
      userInput,
      selectedOption,
    });

    this.currentNodeData = null;
    this.updateActivity();
  }

  // ========================================
  // MESSAGE TRACKING
  // ========================================

  /**
   * Track user message sent
   */
  trackUserMessage(text: string, messageIndex?: number): void {
    if (!this.isInitialized || !this.chatSessionId) return;

    // Calculate response time if we have first message time
    let responseTimeMs: number | undefined;
    if (this.lastActivityTime && this.lastActivityTime !== this.sessionStartTime) {
      responseTimeMs = Date.now() - this.lastActivityTime;
    }

    // Update counters
    this.messageCount++;
    this.userMessageCount++;
    this.totalMessageLength += text.length;

    // Set first message time
    if (!this.firstMessageTime) {
      this.firstMessageTime = Date.now();
    }

    // Emit sentiment tracking via socket
    this.emitSocketEvent(AnalyticsSocketEvents.TRACK_SENTIMENT, {
      chatSessionId: this.chatSessionId,
      messageIndex: messageIndex ?? this.userMessageCount,
      text,
      messageType: 'user',
    });

    // Queue event
    this.queueEvent({
      eventId: this.generateEventId(),
      eventType: AnalyticsEventType.MESSAGE_SENT,
      timestamp: Date.now(),
      chatSessionId: this.chatSessionId,
      botId: this.botId!,
      visitorId: this.visitorId,
      messageIndex: messageIndex ?? this.userMessageCount,
      text,
      nodeId: this.currentNodeData?.nodeId,
      responseTimeMs,
    });

    this.updateActivity();
    this.log('User message tracked', { length: text.length });
  }

  /**
   * Track bot message received
   */
  trackBotMessage(): void {
    if (!this.isInitialized) return;

    this.messageCount++;
    this.botMessageCount++;
    this.updateActivity();
  }

  /**
   * Track agent message received
   */
  trackAgentMessage(): void {
    if (!this.isInitialized) return;

    this.messageCount++;
    this.agentMessageCount++;
    this.updateActivity();
  }

  // ========================================
  // TYPING TRACKING
  // ========================================

  /**
   * Track typing start
   */
  trackTypingStart(): void {
    if (!this.isInitialized) return;

    this.typingStartTime = Date.now();
    this.updateActivity();
  }

  /**
   * Track typing end
   */
  trackTypingEnd(wasSent: boolean = true): void {
    if (!this.isInitialized || this.typingStartTime === 0) return;

    const typingDuration = Date.now() - this.typingStartTime;
    this.totalTypingTime += typingDuration;

    if (!wasSent) {
      this.abandonedMessageCount++;
    }

    this.typingStartTime = 0;
    this.updateActivity();
  }

  /**
   * Track text deletion (backspace)
   */
  trackDeletion(): void {
    if (!this.isInitialized) return;
    this.deletionCount++;
  }

  // ========================================
  // INTERACTION TRACKING
  // ========================================

  /**
   * Track button click
   */
  trackButtonClick(buttonId: string, buttonLabel?: string): void {
    this.trackInteraction(AnalyticsEventType.BUTTON_CLICK, 'buttonsClicked', {
      buttonId,
      buttonLabel,
    });
  }

  /**
   * Track choice selection
   */
  trackChoiceSelect(choiceId: string, choiceLabel?: string): void {
    this.trackInteraction(AnalyticsEventType.CHOICE_SELECT, 'choiceSelected', {
      choiceId,
      choiceLabel,
    });
  }

  /**
   * Track link click
   */
  trackLinkClick(url: string): void {
    this.trackInteraction(AnalyticsEventType.LINK_CLICK, 'linksClicked', { url });
  }

  /**
   * Track file upload
   */
  trackFileUpload(fileName: string, fileType: string, fileSize?: number): void {
    this.trackInteraction(AnalyticsEventType.FILE_UPLOAD, 'filesUploaded', {
      fileName,
      fileType,
      fileSize,
    });
  }

  /**
   * Track image view
   */
  trackImageView(imageUrl: string): void {
    this.trackInteraction(AnalyticsEventType.IMAGE_VIEW, 'imagesViewed', { imageUrl });
  }

  /**
   * Track video watch
   */
  trackVideoWatch(videoUrl: string, watchDuration?: number): void {
    this.trackInteraction(AnalyticsEventType.VIDEO_WATCH, 'videosWatched', {
      videoUrl,
      watchDuration,
    });
  }

  /**
   * Track carousel interaction
   */
  trackCarouselInteraction(action: 'swipe' | 'click', itemIndex: number): void {
    this.trackInteraction(AnalyticsEventType.CAROUSEL_INTERACT, 'carouselInteractions', {
      action,
      itemIndex,
    });
  }

  /**
   * Generic interaction tracking
   */
  private trackInteraction(
    eventType: AnalyticsEventType,
    interactionType: string,
    data: Record<string, any>
  ): void {
    if (!this.isInitialized || !this.chatSessionId) return;

    // Emit via socket
    this.emitSocketEvent(AnalyticsSocketEvents.TRACK_INTERACTION, {
      chatSessionId: this.chatSessionId,
      type: interactionType,
      nodeId: this.currentNodeData?.nodeId,
      ...data,
    });

    // Queue event
    this.queueEvent({
      eventId: this.generateEventId(),
      eventType,
      timestamp: Date.now(),
      chatSessionId: this.chatSessionId,
      botId: this.botId!,
      visitorId: this.visitorId,
      interactionType,
      nodeId: this.currentNodeData?.nodeId,
      data,
    });

    this.updateActivity();
    this.log('Interaction tracked', { type: interactionType });
  }

  // ========================================
  // GOAL & RATING TRACKING
  // ========================================

  /**
   * Track goal completion
   */
  trackGoalCompletion(
    goalId: string,
    conversionEvent?: string,
    conversionValue?: number
  ): void {
    if (!this.isInitialized || !this.chatSessionId) return;

    // Emit via socket
    this.emitSocketEvent(AnalyticsSocketEvents.TRACK_GOAL_COMPLETION, {
      chatSessionId: this.chatSessionId,
      goalId,
      conversionEvent,
      conversionValue,
    });

    // Queue event
    this.queueEvent({
      eventId: this.generateEventId(),
      eventType: AnalyticsEventType.GOAL_COMPLETION,
      timestamp: Date.now(),
      chatSessionId: this.chatSessionId,
      botId: this.botId!,
      visitorId: this.visitorId,
      goalId,
      conversionEvent,
      conversionValue,
    });

    this.updateActivity();
    this.log('Goal completion tracked', { goalId });
  }

  /**
   * Submit chat rating
   */
  submitRating(options: {
    csatScore?: number;
    feedback?: string;
    thumbsUp?: boolean;
    npsScore?: number;
    source?: string;
  }): void {
    if (!this.isInitialized || !this.chatSessionId) return;

    const source = options.source || 'mobile_app';

    // Emit via socket
    this.emitSocketEvent(AnalyticsSocketEvents.SUBMIT_CHAT_RATING, {
      chatSessionId: this.chatSessionId,
      csatScore: options.csatScore,
      feedback: options.feedback,
      thumbsUp: options.thumbsUp,
      npsScore: options.npsScore,
      source,
    });

    // Queue event
    this.queueEvent({
      eventId: this.generateEventId(),
      eventType: AnalyticsEventType.RATING_SUBMIT,
      timestamp: Date.now(),
      chatSessionId: this.chatSessionId,
      botId: this.botId!,
      visitorId: this.visitorId,
      csatScore: options.csatScore,
      feedback: options.feedback,
      thumbsUp: options.thumbsUp,
      npsScore: options.npsScore,
      source,
    });

    this.log('Rating submitted', { csatScore: options.csatScore });
  }

  // ========================================
  // DROP-OFF TRACKING
  // ========================================

  /**
   * Track drop-off event
   */
  trackDropOff(reason: DropOffReason, lastUserAction?: string): void {
    if (!this.isInitialized || !this.chatSessionId) return;

    const timeBeforeDropOff = Math.floor((Date.now() - this.lastActivityTime) / 1000);

    // Emit via socket
    this.emitSocketEvent(AnalyticsSocketEvents.TRACK_DROP_OFF, {
      chatSessionId: this.chatSessionId,
      nodeId: this.currentNodeData?.nodeId,
      nodeType: this.currentNodeData?.nodeType,
      nodeName: this.currentNodeData?.nodeName,
      reason,
      timeBeforeDropOff,
      lastUserAction,
    });

    // Queue event
    this.queueEvent({
      eventId: this.generateEventId(),
      eventType: AnalyticsEventType.DROP_OFF,
      timestamp: Date.now(),
      chatSessionId: this.chatSessionId,
      botId: this.botId!,
      visitorId: this.visitorId,
      nodeId: this.currentNodeData?.nodeId,
      nodeType: this.currentNodeData?.nodeType,
      nodeName: this.currentNodeData?.nodeName,
      reason,
      timeBeforeDropOff,
      lastUserAction,
    });

    this.log('Drop-off tracked', { reason });
  }

  // ========================================
  // CUSTOM EVENT TRACKING
  // ========================================

  /**
   * Track a custom event
   */
  trackEvent(eventName: string, properties?: Record<string, any>): void {
    if (!this.isInitialized || !this.chatSessionId) return;

    // Queue as generic event
    this.queueEvent({
      eventId: this.generateEventId(),
      eventType: eventName as AnalyticsEventType,
      timestamp: Date.now(),
      chatSessionId: this.chatSessionId,
      botId: this.botId!,
      visitorId: this.visitorId,
      ...properties,
    } as AnalyticsEvent);

    this.updateActivity();
    this.log('Custom event tracked', { eventName, properties });
  }

  // ========================================
  // BATCHING & SENDING
  // ========================================

  /**
   * Queue an event for batching
   */
  private queueEvent(event: AnalyticsEvent): void {
    this.eventQueue.push(event);

    // Check if we should flush based on batch size
    if (this.eventQueue.length >= this.config.batchSize) {
      this.flushEvents();
    }
  }

  /**
   * Start the batch timer
   */
  private startBatchTimer(): void {
    if (this.batchTimer) return;

    this.batchTimer = setInterval(() => {
      this.flushEvents();
    }, this.config.batchIntervalMs);
  }

  /**
   * Stop the batch timer
   */
  private stopBatchTimer(): void {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = null;
    }
  }

  /**
   * Flush events to server
   */
  async flushEvents(): Promise<void> {
    if (this.isSending || this.eventQueue.length === 0) return;

    this.isSending = true;
    const eventsToSend = [...this.eventQueue];
    this.eventQueue = [];

    try {
      // In a real implementation, this would send to a REST endpoint
      // For now, events are sent via socket.emit in real-time
      // Store events in case socket is disconnected

      await this.storage.addPendingEvents(eventsToSend);
      await this.storage.saveLastSync(Date.now());

      // Clear sent events from storage after successful socket connection
      if (this.socketClient?.isConnected()) {
        const eventIds = eventsToSend.map((e) => e.eventId);
        await this.storage.removePendingEvents(eventIds);
      }

      this.retryCount = 0;
      this.log('Events flushed', { count: eventsToSend.length });
    } catch (error) {
      this.log('Error flushing events', { error });

      // Put events back in queue for retry
      this.eventQueue = [...eventsToSend, ...this.eventQueue];
      this.retryCount++;

      if (this.retryCount < this.config.maxRetries) {
        setTimeout(() => {
          this.flushEvents();
        }, this.config.retryDelayMs * this.retryCount);
      }
    } finally {
      this.isSending = false;
    }
  }

  /**
   * Load pending events from storage
   */
  private async loadPendingEvents(): Promise<void> {
    const pendingEvents = await this.storage.getPendingEvents();
    if (pendingEvents.length > 0) {
      this.log('Loaded pending events', { count: pendingEvents.length });
      // Don't add to queue - they're already persisted
    }
  }

  // ========================================
  // ENGAGEMENT UPDATES
  // ========================================

  /**
   * Start periodic engagement updates
   */
  private startEngagementTimer(): void {
    if (this.engagementTimer) return;

    // Send engagement update every 30 seconds
    this.engagementTimer = setInterval(() => {
      this.sendEngagementUpdate();
    }, 30000);
  }

  /**
   * Stop engagement timer
   */
  private stopEngagementTimer(): void {
    if (this.engagementTimer) {
      clearInterval(this.engagementTimer);
      this.engagementTimer = null;
    }
  }

  /**
   * Send engagement update
   */
  private sendEngagementUpdate(): void {
    if (!this.isInitialized || !this.chatSessionId) return;

    const sessionMetrics = this.getSessionMetrics();
    const typingBehavior = this.getTypingBehavior();

    // Emit via socket
    this.emitSocketEvent(AnalyticsSocketEvents.TRACK_CHAT_ENGAGEMENT, {
      chatSessionId: this.chatSessionId,
      sessionMetrics,
      typingBehavior,
    });

    this.log('Engagement update sent');
  }

  // ========================================
  // APP STATE HANDLING
  // ========================================

  /**
   * Subscribe to app state changes
   */
  private subscribeToAppState(): void {
    this.appStateSubscription = AppState.addEventListener(
      'change',
      this.handleAppStateChange.bind(this)
    );
  }

  /**
   * Unsubscribe from app state changes
   */
  private unsubscribeFromAppState(): void {
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
  }

  /**
   * Handle app state change
   */
  private handleAppStateChange(nextAppState: AppStateStatus): void {
    if (nextAppState === 'active') {
      // App came to foreground
      if (!this.isAppActive) {
        const idleTime = Date.now() - this.backgroundTime;
        this.totalIdleTime += idleTime;
        this.isAppActive = true;
        this.updateActivity();
        this.log('App resumed', { idleTimeMs: idleTime });
      }
    } else if (nextAppState === 'background' || nextAppState === 'inactive') {
      // App went to background
      if (this.isAppActive) {
        this.isAppActive = false;
        this.backgroundTime = Date.now();

        // Track potential drop-off
        this.trackDropOff('app_backgrounded');

        // Persist session data
        this.persistSessionData();

        this.log('App backgrounded');
      }
    }
  }

  // ========================================
  // HELPERS
  // ========================================

  /**
   * Update last activity time and calculate idle time
   */
  private updateActivity(): void {
    const now = Date.now();
    const timeSinceLastActivity = now - this.lastActivityTime;

    // If idle for more than threshold, count as idle time
    if (timeSinceLastActivity > this.config.idleThresholdMs) {
      this.totalIdleTime += timeSinceLastActivity - this.config.idleThresholdMs;
    }

    this.lastActivityTime = now;
  }

  /**
   * Get session metrics
   */
  private getSessionMetrics(): SessionMetrics {
    const now = Date.now();
    const totalDuration = Math.floor((now - this.sessionStartTime) / 1000);
    const activeDuration = Math.max(0, totalDuration - Math.floor(this.totalIdleTime / 1000));

    return {
      startedAt: this.sessionStartTime,
      firstMessageAt: this.firstMessageTime ?? undefined,
      lastMessageAt: this.lastActivityTime,
      totalDuration,
      activeDuration,
      idleTime: Math.floor(this.totalIdleTime / 1000),
    };
  }

  /**
   * Get message counts
   */
  private getMessageCounts(): MessageCounts {
    return {
      total: this.messageCount,
      userMessages: this.userMessageCount,
      botMessages: this.botMessageCount,
      agentMessages: this.agentMessageCount,
    };
  }

  /**
   * Get typing behavior metrics
   */
  private getTypingBehavior(): TypingBehavior {
    return {
      totalTypingTime: Math.floor(this.totalTypingTime / 1000),
      deletions: this.deletionCount,
      abandonedMessages: this.abandonedMessageCount,
      avgMessageLength:
        this.userMessageCount > 0
          ? Math.floor(this.totalMessageLength / this.userMessageCount)
          : 0,
    };
  }

  /**
   * Persist session data for recovery
   */
  private async persistSessionData(): Promise<void> {
    if (!this.chatSessionId || !this.botId) return;

    const sessionData: PersistedSessionData = {
      chatSessionId: this.chatSessionId,
      botId: this.botId,
      visitorId: this.visitorId,
      startedAt: this.sessionStartTime,
      lastActivityAt: this.lastActivityTime,
      totalIdleTime: this.totalIdleTime,
      messageCount: this.messageCount,
      totalMessageLength: this.totalMessageLength,
      totalTypingTime: this.totalTypingTime,
      deletionCount: this.deletionCount,
    };

    await this.storage.saveSessionData(sessionData);
  }

  /**
   * Emit socket event
   */
  private emitSocketEvent(eventName: string, data: Record<string, any>): void {
    if (!this.socketClient) return;

    try {
      // Access the underlying socket to emit custom events
      // Note: This requires the socket client to expose the emit method
      (this.socketClient as any).socket?.emit(eventName, data);
    } catch (error) {
      this.log('Error emitting socket event', { eventName, error });
    }
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Reset internal state
   */
  private resetState(): void {
    this.chatSessionId = null;
    this.botId = null;
    this.visitorId = null;
    this.socketClient = null;
    this.sessionStartTime = 0;
    this.lastActivityTime = 0;
    this.totalIdleTime = 0;
    this.firstMessageTime = null;
    this.currentNodeData = null;
    this.messageCount = 0;
    this.userMessageCount = 0;
    this.botMessageCount = 0;
    this.agentMessageCount = 0;
    this.totalMessageLength = 0;
    this.typingStartTime = 0;
    this.totalTypingTime = 0;
    this.deletionCount = 0;
    this.abandonedMessageCount = 0;
    this.eventQueue = [];
    this.retryCount = 0;
    this.isSending = false;
    this.isInitialized = false;
    this.isAppActive = true;
    this.backgroundTime = 0;
  }

  /**
   * Debug logging
   */
  private log(message: string, data?: Record<string, any>): void {
    if (this.config.debug) {
      console.log(`[AnalyticsService] ${message}`, data || '');
    }
  }

  // ========================================
  // PUBLIC GETTERS
  // ========================================

  /**
   * Check if analytics is initialized
   */
  get initialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Get current session ID
   */
  get currentSessionId(): string | null {
    return this.chatSessionId;
  }

  /**
   * Get current node ID
   */
  get currentNodeId(): string | null {
    return this.currentNodeData?.nodeId ?? null;
  }
}

// ========================================
// SINGLETON EXPORT
// ========================================

// Export singleton instance
let analyticsInstance: AnalyticsService | null = null;

export const getAnalyticsService = (config?: Partial<AnalyticsConfig>): AnalyticsService => {
  if (!analyticsInstance) {
    analyticsInstance = new AnalyticsService(config);
  }
  return analyticsInstance;
};

export const resetAnalyticsService = (): void => {
  if (analyticsInstance) {
    analyticsInstance.finalize();
    analyticsInstance = null;
  }
};

export default AnalyticsService;
