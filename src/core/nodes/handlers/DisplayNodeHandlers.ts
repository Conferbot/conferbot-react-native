/**
 * DisplayNodeHandlers.ts
 *
 * Display Node Handlers for the Conferbot React Native SDK.
 * Handles basic display nodes: message, image, video, audio, file, html, redirect.
 * These nodes display content to the user and auto-continue to the next node.
 */

import {
  BaseNodeHandler,
  NodeResult,
  NodeUIState,
  NodeHandler,
} from '../NodeHandler';
import { ChatState } from '../../state/ChatState';
import { NodeHandlerRegistry } from '../NodeHandlerRegistry';
import { DisplayNodes } from '../NodeTypes';

// ========================================
// MESSAGE HANDLER
// ========================================

/**
 * Handles 'message' nodes - displays a text message to the user
 */
export class MessageHandler extends BaseNodeHandler {
  readonly nodeType = DisplayNodes.MESSAGE;

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const data = this.getNodeData(node);
    if (!data) {
      return this.createError('Message node has no data');
    }

    const nodeId = this.getNodeId(node);

    // Get message text - support multiple possible field names
    let text = this.getString(data, 'text') ||
               this.getString(data, 'message') ||
               this.getString(data, 'content', '');

    // Resolve variables in the message text
    text = this.resolveText(text, state);

    // Check for typing indicator delay
    const typingDelay = this.getNumber(data, 'typingDelay', 0);
    const showTyping = this.getBoolean(data, 'showTyping', true);

    // Add to transcript
    state.addBotMessage(text, nodeId, this.nodeType);

    // Create UI state for message display
    const uiState: NodeUIState.Message = {
      type: 'message',
      nodeId,
      text,
      showAvatar: this.getBoolean(data, 'showAvatar', true),
      typing: showTyping && typingDelay > 0,
    };

    // If typing delay, use delayed proceed
    if (typingDelay > 0) {
      return NodeResult.delayedProceed(
        this.getNextNodeId(node),
        typingDelay,
        { displayedMessage: text }
      );
    }

    // For messages, we display and auto-proceed
    // The flow engine will handle the transition after displaying
    return NodeResult.displayUI(uiState);
  }
}

// ========================================
// IMAGE HANDLER
// ========================================

/**
 * Handles 'image' nodes - displays an image with optional caption
 */
export class ImageHandler extends BaseNodeHandler {
  readonly nodeType = DisplayNodes.IMAGE;

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const data = this.getNodeData(node);
    if (!data) {
      return this.createError('Image node has no data');
    }

    const nodeId = this.getNodeId(node);

    // Get image URL
    const url = this.getString(data, 'url') ||
                this.getString(data, 'src') ||
                this.getString(data, 'imageUrl', '');

    if (!url) {
      return this.createError('Image node has no URL');
    }

    // Get optional caption and alt text
    let caption = this.getString(data, 'caption', '');
    const alt = this.getString(data, 'alt') ||
                this.getString(data, 'altText', 'Image');

    // Resolve variables in caption
    caption = caption ? this.resolveText(caption, state) : '';

    // Add to transcript
    const transcriptText = caption ? `[Image: ${caption}]` : '[Image]';
    state.addBotMessage(transcriptText, nodeId, this.nodeType);

    // Create UI state
    const uiState: NodeUIState.Image = {
      type: 'image',
      nodeId,
      url,
      alt,
      caption: caption || undefined,
    };

    return NodeResult.displayUI(uiState);
  }
}

// ========================================
// VIDEO HANDLER
// ========================================

/**
 * Handles 'video' nodes - displays a video player
 */
export class VideoHandler extends BaseNodeHandler {
  readonly nodeType = DisplayNodes.VIDEO;

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const data = this.getNodeData(node);
    if (!data) {
      return this.createError('Video node has no data');
    }

    const nodeId = this.getNodeId(node);

    // Get video URL - support multiple sources
    const url = this.getString(data, 'url') ||
                this.getString(data, 'src') ||
                this.getString(data, 'videoUrl') ||
                this.getString(data, 'embedUrl', '');

    if (!url) {
      return this.createError('Video node has no URL');
    }

    // Get optional poster/thumbnail
    const poster = this.getString(data, 'poster') ||
                   this.getString(data, 'thumbnail') ||
                   this.getString(data, 'thumbnailUrl', '');

    // Autoplay settings
    const autoplay = this.getBoolean(data, 'autoplay', false);

    // Add to transcript
    state.addBotMessage('[Video]', nodeId, this.nodeType);

    // Create UI state
    const uiState: NodeUIState.Video = {
      type: 'video',
      nodeId,
      url,
      poster: poster || undefined,
      autoplay,
    };

    return NodeResult.displayUI(uiState);
  }
}

// ========================================
// AUDIO HANDLER
// ========================================

/**
 * Handles 'audio' nodes - displays an audio player
 */
export class AudioHandler extends BaseNodeHandler {
  readonly nodeType = DisplayNodes.AUDIO;

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const data = this.getNodeData(node);
    if (!data) {
      return this.createError('Audio node has no data');
    }

    const nodeId = this.getNodeId(node);

    // Get audio URL
    const url = this.getString(data, 'url') ||
                this.getString(data, 'src') ||
                this.getString(data, 'audioUrl', '');

    if (!url) {
      return this.createError('Audio node has no URL');
    }

    // Autoplay settings
    const autoplay = this.getBoolean(data, 'autoplay', false);

    // Add to transcript
    state.addBotMessage('[Audio]', nodeId, this.nodeType);

    // Create UI state
    const uiState: NodeUIState.Audio = {
      type: 'audio',
      nodeId,
      url,
      autoplay,
    };

    return NodeResult.displayUI(uiState);
  }
}

// ========================================
// FILE HANDLER
// ========================================

/**
 * Handles 'file' nodes - displays a file download link
 */
export class FileHandler extends BaseNodeHandler {
  readonly nodeType = DisplayNodes.FILE;

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const data = this.getNodeData(node);
    if (!data) {
      return this.createError('File node has no data');
    }

    const nodeId = this.getNodeId(node);

    // Get file URL
    const url = this.getString(data, 'url') ||
                this.getString(data, 'src') ||
                this.getString(data, 'fileUrl', '');

    if (!url) {
      return this.createError('File node has no URL');
    }

    // Get filename - try to extract from URL if not provided
    let filename = this.getString(data, 'filename') ||
                   this.getString(data, 'name', '');

    if (!filename) {
      // Try to extract filename from URL
      try {
        const urlPath = new URL(url).pathname;
        filename = urlPath.split('/').pop() || 'download';
      } catch {
        filename = 'download';
      }
    }

    // Get file metadata
    const size = this.getNumber(data, 'size', 0);
    const mimeType = this.getString(data, 'mimeType') ||
                     this.getString(data, 'type', '');

    // Add to transcript
    state.addBotMessage(`[File: ${filename}]`, nodeId, this.nodeType);

    // Create UI state
    const uiState: NodeUIState.File = {
      type: 'file',
      nodeId,
      url,
      filename,
      size: size || undefined,
      mimeType: mimeType || undefined,
    };

    return NodeResult.displayUI(uiState);
  }
}

// ========================================
// HTML HANDLER
// ========================================

/**
 * Handles 'html' nodes - displays custom HTML content
 */
export class HTMLHandler extends BaseNodeHandler {
  readonly nodeType = DisplayNodes.HTML;

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const data = this.getNodeData(node);
    if (!data) {
      return this.createError('HTML node has no data');
    }

    const nodeId = this.getNodeId(node);

    // Get HTML content
    let content = this.getString(data, 'html') ||
                  this.getString(data, 'content') ||
                  this.getString(data, 'code', '');

    if (!content) {
      return this.createError('HTML node has no content');
    }

    // Resolve variables in HTML content
    content = this.resolveText(content, state);

    // Sanitization should be handled by the UI layer
    // Here we just pass through the content

    // Add to transcript (simplified representation)
    state.addBotMessage('[HTML Content]', nodeId, this.nodeType);

    // Create UI state
    const uiState: NodeUIState.HTML = {
      type: 'html',
      nodeId,
      content,
    };

    return NodeResult.displayUI(uiState);
  }
}

// ========================================
// REDIRECT HANDLER
// ========================================

/**
 * Handles 'redirect' nodes - redirects the user to a URL
 */
export class RedirectHandler extends BaseNodeHandler {
  readonly nodeType = DisplayNodes.REDIRECT;

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const data = this.getNodeData(node);
    if (!data) {
      return this.createError('Redirect node has no data');
    }

    const nodeId = this.getNodeId(node);

    // Get redirect URL
    let url = this.getString(data, 'url') ||
              this.getString(data, 'redirectUrl') ||
              this.getString(data, 'href', '');

    if (!url) {
      return this.createError('Redirect node has no URL');
    }

    // Resolve variables in URL
    url = this.resolveText(url, state);

    // Get redirect options
    const openInNewTab = this.getBoolean(data, 'openInNewTab') ||
                         this.getBoolean(data, 'newWindow') ||
                         this.getBoolean(data, 'target', true);

    const delay = this.getNumber(data, 'delay', 0);

    // Add to transcript
    state.addBotMessage(`[Redirect: ${url}]`, nodeId, this.nodeType);

    // Store redirect info in state for the UI to handle
    state.setVariable('_redirect', {
      url,
      openInNewTab,
      delay,
      timestamp: new Date().toISOString(),
    });

    // In React Native, the UI component will handle the actual navigation
    // We proceed to the next node after triggering the redirect
    if (delay > 0) {
      return NodeResult.delayedProceed(
        this.getNextNodeId(node),
        delay,
        { redirectUrl: url, openInNewTab }
      );
    }

    return NodeResult.proceed(this.getNextNodeId(node), {
      redirectUrl: url,
      openInNewTab,
    });
  }
}

// ========================================
// DISPLAY HANDLER COLLECTION
// ========================================

/**
 * Array of all display node handlers
 */
export const displayHandlers: NodeHandler[] = [
  new MessageHandler(),
  new ImageHandler(),
  new VideoHandler(),
  new AudioHandler(),
  new FileHandler(),
  new HTMLHandler(),
  new RedirectHandler(),
];

/**
 * Registers all display node handlers with the registry
 */
export function registerDisplayHandlers(registry: NodeHandlerRegistry): void {
  registry.registerAll(displayHandlers);
}

export default displayHandlers;
