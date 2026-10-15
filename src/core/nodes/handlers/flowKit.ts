/**
 * Small helpers the step handlers share: owner text filled from the answers
 * as the visitor sees it, record entries in the web's shapes, bot and
 * visitor lines on the transcript (which the chat UI draws).
 */
import type { ChatState, RecordEntry } from '../../state/ChatState';
import { bubbleText, plainText, stripHtmlAndDecode } from '../../flow/text';

/** Owner HTML with the answers filled in (values escaped), as one native bubble's text. */
export const shownText = (state: ChatState, html: any): string => bubbleText(state.resolveVariables(String(html ?? ''), 'html'));

/** Owner HTML filled in, as one line (labels of buttons and options). */
export const shownLabel = (state: ChatState, html: any): string => plainText(state.resolveVariables(String(html ?? ''), 'html'));

/** What an option saves: its own text, HTML stripped and entities decoded (never filled). */
export const savedText = (html: any): string => stripHtmlAndDecode(html);

/** A non-blank text after stripping tags. */
export const notBlank = (v: any): boolean => plainText(v) !== '';

/** The visitor's answer on the record (shape "user-..."), merged as the web does. */
export const pushAnswer = (state: ChatState, entry: Record<string, any>): void => {
  state.addRecord({ ...entry, _id: entry.id, time: new Date().toISOString() } as RecordEntry);
};

/** A bot bubble in the chat (the transcript drives the UI). */
export const botSay = (state: ChatState, text: string, nodeId: string, nodeType: string, data?: Record<string, any>): void => {
  if (!text && !data) return;
  state.addToTranscript({ type: 'bot', text, nodeId, nodeType, timestamp: new Date().toISOString(), ...(data ? { data } : {}) });
};

/** The visitor's line on the transcript (as typed: the transcript is never masked). */
export const userSay = (state: ChatState, text: string, nodeId: string): void => {
  state.addUserMessage(text, nodeId);
};

/** A typed answer, trimmed: from a string or the text input's {value}. */
export const typedText = (response: any): string => {
  if (typeof response === 'string') return response.trim();
  if (response && typeof response === 'object') {
    const v = response.value ?? response.text ?? response.message;
    if (v !== undefined && v !== null && typeof v !== 'object') return String(v).trim();
  }
  return '';
};

/** The id of the button / option the visitor picked. */
export const pickedId = (response: any): string | undefined => {
  if (response === null || response === undefined) return undefined;
  if (typeof response !== 'object') return String(response);
  const id = response.buttonId ?? response.choiceId ?? response.optionId ?? response.id ?? response.selectedId;
  return id === undefined || id === null ? undefined : String(id);
};
