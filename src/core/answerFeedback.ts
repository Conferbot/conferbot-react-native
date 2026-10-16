/**
 * "Helpful?" under an AI answer, as the web widget's ts/chat/answerFeedback.ts.
 *
 *   ask     "Helpful?" with a thumb up and a thumb down, on the newest
 *           answer only (an older unrated one steps aside).
 *   up      sent at once ({helpful:true}); "Thanks for letting us know!",
 *           then the quiet rated line.
 *   down    sent at once ({helpful:false}) - a No never waits for a reason.
 *           "Sorry about that. What went wrong?" with four reasons; a reason
 *           is sent too and opens an optional comment. "Talk to a person"
 *           (only while nobody is coming or here) and "Ask another way"
 *           stay right there.
 *   rated   both thumbs, the chosen one pressed, and the reason. Tapping the
 *           other thumb changes the vote. A restored answer draws this.
 *
 * Pure: `helpfulStep` says what a tap does (the vote to send and the view
 * next); the caller sends it (`ai-answer-feedback`) and keeps it on the
 * answer's record entry (`withFeedback`) so a restore draws it.
 */
import { t, localized, I18nKey } from './i18n';

export type FeedbackReason = 'wrong' | 'outdated' | 'unanswered' | 'other';
export interface AnswerFeedback {
  helpful: boolean;
  reason?: FeedbackReason;
  comment?: string;
}

export type HelpfulView = 'ask' | 'thanks' | 'down' | 'rated';

/** A [reason, words] pair whose words are read in the active language. */
const reasonPair = (k: FeedbackReason): readonly [FeedbackReason, string] => {
  const pair = [k, ''] as [FeedbackReason, string];
  Object.defineProperty(pair, 1, { enumerable: true, get: () => t(`helpful.reason.${k}` as I18nKey) });
  return pair;
};

/** The reasons and their words (web FEEDBACK_REASONS, i18n helpful.reason.*). */
export const FEEDBACK_REASONS: ReadonlyArray<readonly [FeedbackReason, string]> = [
  reasonPair('wrong'),
  reasonPair('outdated'),
  reasonPair('unanswered'),
  reasonPair('other'),
];

/** The web's strings (ts/i18n helpful.*, chat.talkToPerson*), in the active language. */
export const HELPFUL_TEXT = localized({
  ask: 'helpful.ask',
  groupLabel: 'helpful.groupLabel',
  yes: 'helpful.yes',
  no: 'helpful.no',
  ratedUp: 'helpful.rated.up',
  ratedDown: 'helpful.rated.down',
  thanks: 'helpful.thanks',
  sorry: 'helpful.sorry',
  whatWentWrong: 'helpful.whatWentWrong',
  comment: 'helpful.comment',
  sendFeedback: 'helpful.sendFeedback',
  retry: 'helpful.retry',
  thanksComment: 'helpful.thanksComment',
  talkToPerson: 'chat.talkToPerson',
  talkToPersonAsk: 'chat.talkToPersonAsk',
});

/** How long "Thanks for letting us know!" shows before the rated line (web: 1800 + 350 ms fade). */
export const THANKS_MS = 1800;

const isReason = (r: unknown): r is FeedbackReason => FEEDBACK_REASONS.some(([k]) => k === r);

export const reasonLabel = (r?: string): string => FEEDBACK_REASONS.find(([k]) => k === r)?.[1] || '';

/** A stored vote, or null when it is not one (web normalizeFeedback). */
export const normalizeFeedback = (raw: any): AnswerFeedback | null => {
  if (!raw || typeof raw.helpful !== 'boolean') return null;
  const out: AnswerFeedback = { helpful: raw.helpful };
  if (!raw.helpful && isReason(raw.reason)) out.reason = raw.reason;
  if (!raw.helpful && typeof raw.comment === 'string' && raw.comment.trim()) out.comment = raw.comment.trim().slice(0, 500);
  return out;
};

/** The rated line's words: "Helpful", or "Not helpful · Outdated". */
export const ratedLabel = (fb: AnswerFeedback | null): string => {
  if (!fb) return '';
  if (fb.helpful) return HELPFUL_TEXT.ratedUp;
  return `${HELPFUL_TEXT.ratedDown}${fb.reason ? ` · ${reasonLabel(fb.reason)}` : ''}`;
};

/** A comment as sent: one line, trimmed, at most 500 characters. */
export const cleanComment = (text: unknown): string => String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, 500);

export interface HelpfulState {
  view: HelpfulView;
  current: AnswerFeedback | null;
  /** The comment went: the field is replaced by "Thanks, that helps us improve." */
  commented: boolean;
}

export type HelpfulTap =
  | { kind: 'vote'; helpful: boolean }
  | { kind: 'reason'; reason: FeedbackReason }
  | { kind: 'comment'; text: string }
  | { kind: 'human' }
  | { kind: 'retry' }
  /** The thanks line's time is up. */
  | { kind: 'settle' };

/** Where a row starts: rated when the answer already has a vote. */
export const helpfulStart = (initial?: unknown): HelpfulState => {
  const current = normalizeFeedback(initial);
  return { view: current ? 'rated' : 'ask', current, commented: false };
};

/**
 * What a tap does: the next state, the vote to send (when there is one),
 * and `ask` (the visitor's words to send, for "Talk to a person") or
 * `focus` (the composer, for "Ask another way").
 */
export const helpfulStep = (
  s: HelpfulState,
  tap: HelpfulTap
): { state: HelpfulState; send?: AnswerFeedback; ask?: string; focus?: boolean } => {
  switch (tap.kind) {
    case 'vote': {
      // The same thumb again: nothing new.
      if (s.current && s.current.helpful === tap.helpful) return { state: s };
      const fb: AnswerFeedback = { helpful: tap.helpful };
      return { state: { view: tap.helpful ? 'thanks' : 'down', current: fb, commented: false }, send: fb };
    }
    case 'reason': {
      if (s.view !== 'down') return { state: s };
      const fb: AnswerFeedback = { helpful: false, reason: tap.reason };
      return { state: { ...s, current: fb }, send: fb };
    }
    case 'comment': {
      if (s.view !== 'down' || s.commented) return { state: s };
      const comment = cleanComment(tap.text);
      // An empty comment sends nothing, and the field still says thanks (web).
      const fb: AnswerFeedback | undefined = comment
        ? { helpful: false, ...(s.current?.reason ? { reason: s.current.reason } : {}), comment }
        : undefined;
      return { state: { ...s, current: fb || s.current, commented: true }, ...(fb ? { send: fb } : {}) };
    }
    case 'human':
      return { state: { ...s, view: 'rated' }, ask: HELPFUL_TEXT.talkToPersonAsk };
    case 'retry':
      return { state: { ...s, view: 'rated' }, focus: true };
    case 'settle':
      return s.view === 'thanks' && s.current?.helpful === true ? { state: { ...s, view: 'rated' } } : { state: s };
    default:
      return { state: s };
  }
};

/**
 * The record with the vote kept on the answer's agent-message entry (web
 * _sendAnswerFeedback: `entry.feedback = { ...feedback, at }`). A new list;
 * the same list when no entry matches.
 */
export const withFeedback = <T extends Record<string, any>>(
  record: readonly T[],
  agentMessageId: string,
  feedback: AnswerFeedback,
  at: string = new Date().toISOString()
): T[] => {
  let hit = false;
  const out = record.map((r) => {
    const isAnswer = r?.shape === 'agent-message' || r?.type === 'agent-message';
    if (!isAnswer || String(r.id ?? r._id) !== String(agentMessageId)) return r;
    hit = true;
    return { ...r, feedback: { ...feedback, at } };
  });
  return hit ? out : (record as T[]);
};
