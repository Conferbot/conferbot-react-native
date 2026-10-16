/**
 * DisplayNodeHandlers.ts
 *
 * The steps that show something and move on: welcome, message, image,
 * video, audio, file, html, user-redirect - and navigate, which waits for
 * Done. Field names and behaviour follow the flow-node spec
 * (scripts/parity/flows/nodes.spec.json) and the web widget's
 * ts/chat/displayStep.ts. The engine paces the typing dots and moves on
 * (images and videos when their media settles, at 4000 ms at most).
 */

import { BaseNodeHandler, NodeResult, NodeUIState, NodeHandler } from '../NodeHandler';
import { ChatState } from '../../state/ChatState';
import { NodeHandlerRegistry } from '../NodeHandlerRegistry';
import { DisplayNodes } from '../NodeTypes';
import { fillLinkVariables, fillVariables, sanitizeOwnerHtml, stripHtmlAndDecode } from '../../flow/text';
import { botSay, pushAnswer, shownText, userSay } from './flowKit';
import { linkHref } from '../../flow/inputs';
import { t } from '../../i18n';

export { linkHref };

/** Where a redirect / navigate link goes: answers filled in, a same-site path kept (web redirectHref). */
export const redirectHref = (link: any, state: ChatState): string => {
  const filled = fillLinkVariables(link, (k) => state.lookupVariable(k));
  return linkHref(filled) || (/^[/#?](?!\/)/.test(filled) ? filled : '');
};

/** The file name a download card shows, from the URL. */
const fileNameOf = (url: string): string => {
  try {
    const path = url.split(/[?#]/)[0];
    const name = decodeURIComponent(path.substring(path.lastIndexOf('/') + 1));
    return name || 'download';
  } catch {
    return 'download';
  }
};

// ========================================
// WELCOME
// ========================================

/** welcome-node: data.text, then data.image unless disableImage. */
export class WelcomeNodeHandler extends BaseNodeHandler {
  readonly nodeType = 'welcome-node';

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const data = node.data || {};
    const nodeId = this.getNodeId(node);
    const text = shownText(state, data.text);
    botSay(state, text, nodeId, this.nodeType);
    const image = typeof data.image === 'string' ? data.image.trim() : '';
    if (image && !data.disableImage) botSay(state, '', nodeId, this.nodeType, { imageUrl: image });
    return NodeResult.displayUI({ type: 'message', nodeId, text, showAvatar: true });
  }
}

// ========================================
// MESSAGE
// ========================================

/** message-node: data.text, filled from the answers. Blank text is skipped by the engine. */
export class MessageHandler extends BaseNodeHandler {
  readonly nodeType = DisplayNodes.MESSAGE;

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const nodeId = this.getNodeId(node);
    const text = shownText(state, node.data?.text);
    botSay(state, text, nodeId, this.nodeType);
    return NodeResult.displayUI({ type: 'message', nodeId, text, showAvatar: true });
  }
}

// ========================================
// MEDIA
// ========================================

/** image-node: data.image (not filled). Moves on when it loads, or at the cap. */
export class ImageHandler extends BaseNodeHandler {
  readonly nodeType = DisplayNodes.IMAGE;

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const nodeId = this.getNodeId(node);
    const url = String(node.data?.image ?? '').trim();
    botSay(state, '', nodeId, this.nodeType, { imageUrl: url, mediaNodeId: nodeId });
    return NodeResult.displayUI({ type: 'image', nodeId, url, alt: 'Image' });
  }
}

/** video-node: data.video (an mp4), allowDownload only when true. */
export class VideoHandler extends BaseNodeHandler {
  readonly nodeType = DisplayNodes.VIDEO;

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const nodeId = this.getNodeId(node);
    const url = typeof node.data?.video === 'string' ? node.data.video.trim() : '';
    botSay(state, url, nodeId, this.nodeType, { videoUrl: url, mediaNodeId: nodeId, allowDownload: node.data?.allowDownload === true });
    return NodeResult.displayUI({ type: 'video', nodeId, url, autoplay: true });
  }
}

/**
 * audio-node: data.audio. Some live nodes saved a list there, which the web
 * does not read (a broken player) - the step still moves on.
 */
export class AudioHandler extends BaseNodeHandler {
  readonly nodeType = DisplayNodes.AUDIO;

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const nodeId = this.getNodeId(node);
    const url = typeof node.data?.audio === 'string' ? node.data.audio.trim() : '';
    botSay(state, url, nodeId, this.nodeType, { audioUrl: url });
    return NodeResult.displayUI({ type: 'audio', nodeId, url });
  }
}

/** file-node: a download card for data.file, named from the URL. */
export class FileHandler extends BaseNodeHandler {
  readonly nodeType = DisplayNodes.FILE;

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const nodeId = this.getNodeId(node);
    const url = typeof node.data?.file === 'string' ? node.data.file.trim() : '';
    const filename = url ? fileNameOf(url) : 'download';
    botSay(state, url, nodeId, this.nodeType, { fileUrl: url, fileName: filename });
    return NodeResult.displayUI({ type: 'file', nodeId, url, filename });
  }
}

// ========================================
// HTML
// ========================================

/** html-node: data.html, answers filled (escaped), then sanitised. */
export class HTMLHandler extends BaseNodeHandler {
  readonly nodeType = DisplayNodes.HTML;

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const nodeId = this.getNodeId(node);
    const content = sanitizeOwnerHtml(fillVariables(node.data?.html ?? '', (k) => state.lookupVariable(k)));
    botSay(state, shownText(state, content), nodeId, this.nodeType, { html: content });
    return NodeResult.displayUI({ type: 'html', nodeId, content });
  }
}

// ========================================
// REDIRECT
// ========================================

/**
 * user-redirect-node: a link card - redirectPrompt as its label, data.link
 * as where it goes. It never navigates by itself; the flow moves on.
 */
export class RedirectHandler extends BaseNodeHandler {
  readonly nodeType = DisplayNodes.REDIRECT;

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const data = node.data || {};
    const nodeId = this.getNodeId(node);
    const href = redirectHref(data.link, state);
    const label = fillVariables(stripHtmlAndDecode(data.redirectPrompt || ''), (k) => state.lookupVariable(k), { mode: 'raw' }).trim();
    botSay(state, href ? `${label}\n${href}` : label, nodeId, this.nodeType, {
      linkUrl: href,
      linkLabel: label,
      openInNewTab: data.openInNewTab ?? true,
    });
    return NodeResult.displayUI({ type: 'message', nodeId, text: label, showAvatar: true });
  }
}

// ========================================
// NAVIGATE
// ========================================

/**
 * navigate-node: the prompt, one button per navigateOptions link (blank
 * ones hidden) and Done. A link opens its page and does not move on;
 * Done moves on after 600 ms.
 */
export class NavigateHandler extends BaseNodeHandler {
  readonly nodeType = DisplayNodes.NAVIGATE;

  private options(data: any): any[] {
    return (Array.isArray(data?.navigateOptions) ? data.navigateOptions : []).filter(
      (o: any) => String(o?.navigateText ?? '').trim() !== ''
    );
  }

  private doneLabel(data: any): string {
    return String(data?.doneNavigatingText || '').trim() || t('common.done');
  }

  private ui(node: Record<string, any>, state: ChatState): NodeUIState.Buttons {
    const data = node.data || {};
    const buttons = this.options(data).map((o: any, i: number) => ({
      id: `link-${i}`,
      label: fillVariables(stripHtmlAndDecode(o.navigateText || ''), (k) => state.lookupVariable(k), { mode: 'raw' }).trim(),
      value: redirectHref(o.navigateLink, state),
      style: 'outline' as const,
    }));
    buttons.push({ id: 'done', label: this.doneLabel(data), value: 'done', style: 'primary' as any });
    return { ...NodeUIState.buttons(this.getNodeId(node), shownText(state, data.navigatePrompt), buttons), awaitInput: true };
  }

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const nodeId = this.getNodeId(node);
    const prompt = shownText(state, node.data?.navigatePrompt);
    if (prompt) botSay(state, prompt, nodeId, this.nodeType);
    return NodeResult.displayUI(this.ui(node, state));
  }

  async handleResponse(response: any, node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const data = node.data || {};
    const nodeId = this.getNodeId(node);
    const id = String(response?.buttonId ?? '');
    const isLink = response?.action === 'link' || id.startsWith('link-');
    if (isLink) {
      const index = response?.action === 'link' ? Number(response.index) : Number(id.slice(5));
      const option = this.options(data)[index];
      if (option) {
        const text = fillVariables(stripHtmlAndDecode(option.navigateText || ''), (k) => state.lookupVariable(k), { mode: 'raw' }).trim();
        pushAnswer(state, { id: nodeId, shape: 'user-navigate-link-click', text, url: redirectHref(option.navigateLink, state) });
      }
      // A link opens its page; the step keeps waiting for Done.
      return NodeResult.displayUI(this.ui(node, state));
    }
    const text = this.doneLabel(data);
    pushAnswer(state, { id: nodeId, shape: 'user-navigate-done', text });
    userSay(state, text, nodeId);
    return NodeResult.delayedProceed(null, 600);
  }
}

// ========================================
// DISPLAY HANDLER COLLECTION
// ========================================

/**
 * Strips HTML tags from text, leaving only plain text content
 */
export function stripHtml(html: string): string {
  return String(html ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

export const displayHandlers: NodeHandler[] = [
  new WelcomeNodeHandler(),
  new MessageHandler(),
  new ImageHandler(),
  new VideoHandler(),
  new AudioHandler(),
  new FileHandler(),
  new HTMLHandler(),
  new RedirectHandler(),
  new NavigateHandler(),
];

/**
 * Registers all display node handlers with the registry
 */
export function registerDisplayHandlers(registry: NodeHandlerRegistry): void {
  registry.registerAll(displayHandlers);
}

export default displayHandlers;
