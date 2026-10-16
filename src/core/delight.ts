/**
 * The conversation's small human touches, as the web widget judges them.
 * Ported from conferbot-widget src/ts/chat/delight/rules.ts (which answers
 * can be changed and when going back is safe, the bot's tapback, the
 * moments that earn a celebration, the gentle nudge), delight/index.ts
 * (the timings, the owner's on/off settings), delight/stallNudge.ts (when
 * the nudge shows), delight/celebrate.ts (the confetti's fan) and
 * ratingFx.ts (the rating's sparks).
 *
 * Restraint is the point: a reaction on every answer, or confetti for an
 * email address, would feel like a toy. These fire on the moments a person
 * would react to, and each can be switched off by the owner:
 * customizations.botReactions, celebrations, stallNudges, allowChangeAnswer
 * (all on unless false). Motion is skipped for visitors who ask for less.
 * Pure.
 */
import { t, I18nKey } from './i18n';

// ---------------------------------------------------------------------------
// The owner's switches
// ---------------------------------------------------------------------------

export type Touch = 'botReactions' | 'celebrations' | 'stallNudges' | 'allowChangeAnswer';

/** On unless the owner set it to false (web delight/index.ts `on`). */
export const touchOn = (c: any, key: Touch): boolean => c?.[key] !== false;

/** The reaction and the burst wait this long after the answer (web REACT_AFTER_MS). */
export const REACT_AFTER_MS = 550;
/** "Edit" shows once the bot has been quiet this long (web QUIET_BEFORE_CHANGE_MS). */
export const QUIET_BEFORE_CHANGE_MS = 900;
/** Only the recent past can be changed (web keeps 30 question points). */
export const MAX_QUESTION_POINTS = 30;

// ---------------------------------------------------------------------------
// Changing an answer
// ---------------------------------------------------------------------------

/** Questions whose answer can be taken back and given again. */
export const CHANGEABLE_TYPES = new Set<string>([
  // v2 questions
  'ask-name-node',
  'ask-email-node',
  'ask-phone-number-node',
  'ask-number-node',
  'ask-url-node',
  'ask-location-node',
  'ask-custom-question-node',
  // choices
  'n-choices-node',
  'n-select-option-node',
  'n-check-options-node',
  'yes-or-no-choice-node',
  'image-choice-node',
  'rating-choice-node',
  'opinion-scale-choice-node',
  'dynamic-choices-node',
  // rich inputs with no side effect
  'slider-node',
  'datetime-node',
  'ranking-node',
  'matrix-node',
  'address-node',
  // classic
  'two-choices-node',
  'three-choices-node',
  'select-option-node',
  'user-rating-node',
  'user-range-node',
  'user-input-node',
]);

/**
 * Steps that show something but act on the world (a booking made, a code
 * sent, a payment, a file uploaded, a signature given, an AI call): once
 * one has run, going back would not undo it, so the answer before it stays.
 */
const ACTS_ON_THE_WORLD = new Set<string>([
  'calendar-node',
  'payment-node',
  'otp-node',
  'ask-file-node',
  'signature-node',
  'ai-extract-node',
  'ai-route-node',
  'kb-answer-node',
  'quiz-node',
  'consent-node',
  'ask-multiple-questions-node',
]);

/** The web's display steps (core/node-processors/nodeTypeCategories.ts DISPLAY_NODE_TYPES). */
const DISPLAY_TYPES = new Set<string>([
  'two-choices-node', 'three-choices-node', 'select-option-node', 'user-rating-node', 'quiz-node', 'user-input-node',
  'user-range-node', 'message-node', 'image-node', 'video-node', 'audio-node', 'file-node', 'ask-name-node',
  'ask-email-node', 'ask-phone-number-node', 'ask-number-node', 'ask-url-node', 'ask-file-node', 'ask-location-node',
  'ask-custom-question-node', 'ask-multiple-questions-node', 'calendar-node', 'n-select-option-node',
  'n-check-options-node', 'n-choices-node', 'image-choice-node', 'carousel-node', 'rating-choice-node',
  'yes-or-no-choice-node', 'opinion-scale-choice-node', 'user-redirect-node', 'html-node', 'navigate-node',
  'dynamic-choices-node', 'consent-node', 'product-card-node', 'slider-node', 'datetime-node', 'ranking-node',
  'otp-node', 'address-node', 'matrix-node', 'ai-extract-node', 'ai-route-node', 'kb-answer-node', 'signature-node',
  'payment-node',
]);

/** The web's logic steps (LOGIC_NODE_TYPES). */
const LOGIC_TYPES = new Set<string>([
  'condition-node', 'boolean-logic-node', 'random-flow-node', 'math-operation-node', 'variable-node', 'jump-to-node',
  'business-hours-node',
]);

/** A step after the answer that going back can safely undo. */
export const isSafeToUndo = (type: string): boolean =>
  (DISPLAY_TYPES.has(type) && !ACTS_ON_THE_WORLD.has(type)) || LOGIC_TYPES.has(type) || type === 'delay-node';

/**
 * Can the visitor change their answer to `questionType`, given the step
 * types that have run since it was asked (the question itself excluded)?
 * A person in the conversation since then counts as "agent" (not safe).
 */
export const canChangeAnswer = (questionType: string, typesSince: string[]): boolean =>
  CHANGEABLE_TYPES.has(questionType) && typesSince.every(isSafeToUndo);

/**
 * Steps that wait for the visitor's answer: the ones a question point is
 * kept for (what an answer belongs to, and what to go back to).
 */
export const waitsForAnswer = (questionType: string): boolean =>
  CHANGEABLE_TYPES.has(questionType) || ACTS_ON_THE_WORLD.has(questionType);

/**
 * Whether "Edit" shows under the visitor's latest answer: the owner allows
 * it, nothing locks the conversation (a person in it, or over), the bot is
 * not mid-reply, the answer is the visitor's latest bubble, and nothing
 * irreversible ran since (web delight/index.ts refreshChange).
 */
export const showChangeFor = (o: {
  customizations: any;
  locked: boolean;
  botBusy: boolean;
  isLatestAnswer: boolean;
  questionType: string;
  typesSince: string[];
}): boolean =>
  touchOn(o.customizations, 'allowChangeAnswer') &&
  !o.locked &&
  !o.botBusy &&
  o.isLatestAnswer &&
  canChangeAnswer(o.questionType, o.typesSince);

// ---------------------------------------------------------------------------
// Reading an answer
// ---------------------------------------------------------------------------

/**
 * A rating or scale answer as a share of the best (0 to 1), from the reply
 * text: "★★★★ Good" (stars out of 5), "8/10", "7/10". null when the text
 * is not a score. This SDK's star answers are "⭐⭐⭐⭐": counted the same.
 */
export const scoreShare = (text: string): number | null => {
  const s = String(text || '').trim();
  const frac = s.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+)\b/);
  if (frac) {
    const max = Number(frac[2]);
    return max > 0 ? Math.max(0, Math.min(1, Number(frac[1]) / max)) : null;
  }
  const stars = (s.match(/★|⭐/g) || []).length;
  if (stars) return Math.min(1, stars / 5);
  return null;
};

const SCORE_TYPES = new Set(['rating-choice-node', 'opinion-scale-choice-node', 'user-rating-node']);

/**
 * The answer's text as the web would read it for a score: a rating of n
 * out of `max` stars as "n/max", a scale value as "v/to" (its top).
 */
export const scoreText = (questionType: string, value: number, max: number): string =>
  SCORE_TYPES.has(questionType) && Number.isFinite(value) && max > 0 ? `${value}/${max}` : '';

// ---------------------------------------------------------------------------
// The bot's reaction
// ---------------------------------------------------------------------------

/**
 * The tapback the bot puts on the visitor's answer, or null for none.
 * Names get a wave, scores a heart or a thumbs up (a low score gets a
 * quiet "thank you for telling us", never a cheer), a booking a party.
 * Everything else goes unremarked - a reaction on every answer is noise.
 */
export const reactionFor = (questionType: string, answerText: string): string | null => {
  if (questionType === 'ask-name-node') return '👋';
  if (questionType === 'calendar-node') return '🎉';
  if (questionType === 'payment-node') return '🎉';
  if (SCORE_TYPES.has(questionType)) {
    const s = scoreShare(answerText);
    if (s === null) return null;
    if (s >= 0.8) return '❤️';
    if (s >= 0.55) return '👍';
    return '🙏';
  }
  return null;
};

const REACTION_LABELS: Record<string, I18nKey> = {
  '👋': 'reaction.waved',
  '🎉': 'reaction.celebrated',
  '❤️': 'reaction.loved',
  '👍': 'reaction.liked',
  '🙏': 'reaction.thanked',
};

/** What a screen reader says for the badge (web reactions.ts LABELS). */
export const reactionLabel = (emoji: string): string => t(REACTION_LABELS[emoji] || 'reaction.reacted');

// ---------------------------------------------------------------------------
// Celebrations
// ---------------------------------------------------------------------------

export type Celebration = 'big' | null;

/** The moments that earn a burst: a booking made, a payment through, a top score. */
export const celebrationFor = (questionType: string, answerText: string): Celebration => {
  if (questionType === 'calendar-node' || questionType === 'payment-node') return 'big';
  if (SCORE_TYPES.has(questionType)) {
    const s = scoreShare(answerText);
    // The rating card already sparks on a pick; a perfect score adds the burst.
    return s !== null && s >= 0.999 && questionType !== 'rating-choice-node' ? 'big' : null;
  }
  return null;
};

/** What an answer gets, a beat after it lands: a tapback and / or a burst (web delight/index.ts onAnswer). */
export const touchesFor = (
  c: any,
  questionType: string,
  answerText: string,
  reducedMotion: boolean
): { reaction: string | null; celebrate: boolean } => ({
  reaction: touchOn(c, 'botReactions') ? reactionFor(questionType, answerText) : null,
  celebrate: !reducedMotion && touchOn(c, 'celebrations') && celebrationFor(questionType, answerText) === 'big',
});

/** Pieces in a burst (web celebrate.ts PIECES). */
export const CONFETTI_PIECES = 28;
/** The burst is gone after this (web: the pieces removed at 1600 ms). */
export const CONFETTI_MS = 1600;

export interface ConfettiPiece {
  /** Where the piece flies to from the answer, px. */
  dx: number;
  dy: number;
  /** How far it then falls, px. */
  fall: number;
  /** Its spin, degrees. */
  rot: number;
  /** Its start delay, ms. */
  delay: number;
  /** Which of the 4 colours (the bot's own). */
  tone: 0 | 1 | 2 | 3;
  round: boolean;
}

/**
 * The burst's pieces: a fan that opens up and towards the bot's side,
 * -160 to -20 degrees with a little jitter, 56-116 px out, then a 26-56 px
 * fall (web celebrate.ts). `random` is Math.random unless a test gives one.
 */
export const confettiPieces = (random: () => number = Math.random): ConfettiPiece[] =>
  Array.from({ length: CONFETTI_PIECES }, (_, i) => {
    const angle = (-160 + (140 * i) / (CONFETTI_PIECES - 1) + (random() * 14 - 7)) * (Math.PI / 180);
    const reach = 56 + random() * 60;
    return {
      dx: Math.round(Math.cos(angle) * reach),
      dy: Math.round(Math.sin(angle) * reach),
      fall: Math.round(26 + random() * 30),
      rot: Math.round(random() * 540 - 270),
      delay: Math.round(random() * 90),
      tone: (i % 4) as 0 | 1 | 2 | 3,
      round: i % 3 === 0,
    };
  });

/** The rating's sparks on a pick: 8, or 12 for the top score, evenly round from 20 degrees (web ratingFx.ts burst). */
export const ratingSparks = (top: boolean): number[] => {
  const count = top ? 12 : 8;
  return Array.from({ length: count }, (_, i) => (360 / count) * i + 20);
};
/** The sparks are gone after this (web: removed at 1000 ms). */
export const RATING_SPARKS_MS = 1000;

// ---------------------------------------------------------------------------
// A gentle nudge when a question waits
// ---------------------------------------------------------------------------

/** How long a question waits, with the chat open and nobody busy, before the nudge. */
export const STALL_AFTER_MS = 40_000;
/** Recent activity (typing, a touch, a scroll) in the chat postpones it this long. */
export const STALL_QUIET_MS = 15_000;

const TYPED = new Set([
  'ask-name-node',
  'ask-email-node',
  'ask-phone-number-node',
  'ask-number-node',
  'ask-url-node',
  'ask-location-node',
  'ask-custom-question-node',
  'user-input-node',
  'user-range-node',
]);

/** What the nudge says: picking or typing, never pushy. */
export const stallHintFor = (questionType: string): string =>
  TYPED.has(questionType) ? t('nudge.stallType') : t('nudge.stallPick');

/** Whether a question shows a nudge at all (not for steps that already wait on their own). */
export const nudgesWhileWaiting = (questionType: string): boolean =>
  CHANGEABLE_TYPES.has(questionType) || questionType === 'calendar-node' || questionType === 'consent-node';

export interface StallWatch {
  /** Start (or restart) the wait for the question now on screen. */
  arm: (questionType: string) => void;
  /** They answered, or the question went away: the nudge goes. */
  disarm: () => void;
  /** The visitor touched, scrolled or typed in the chat. */
  touch: () => void;
}

/**
 * The nudge's timing (web delight/stallNudge.ts): STALL_AFTER_MS after the
 * question, unless the visitor was busy in the last STALL_QUIET_MS, the
 * chat is not on screen, or something is typed; then it checks again every
 * STALL_QUIET_MS. Once per question.
 */
export const createStallWatch = (o: {
  /** The chat open, on the conversation, and the app in front. */
  isVisible: () => boolean;
  composerValue: () => string;
  show: (hint: string) => void;
  hide: () => void;
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => any;
  clearTimer?: (t: any) => void;
}): StallWatch => {
  const now = o.now || (() => Date.now());
  const setTimer = o.setTimer || ((fn: () => void, ms: number) => setTimeout(fn, ms));
  const clearTimer = o.clearTimer || ((t: any) => clearTimeout(t));
  let timer: any = null;
  let armedType = '';
  let armed = false;
  let shown = false;
  let lastActivity = now();

  const clear = () => {
    if (timer) clearTimer(timer);
    timer = null;
  };

  const check = () => {
    timer = null;
    if (shown || !armed) return;
    const busy = now() - lastActivity < STALL_QUIET_MS;
    if (busy || !o.isVisible() || o.composerValue().trim()) {
      timer = setTimer(check, STALL_QUIET_MS);
      return;
    }
    shown = true;
    o.show(stallHintFor(armedType));
  };

  return {
    arm(questionType: string) {
      armedType = questionType;
      armed = true;
      if (shown) return;
      clear();
      timer = setTimer(check, STALL_AFTER_MS);
    },
    disarm() {
      clear();
      const was = shown;
      armed = false;
      shown = false;
      if (was) o.hide();
    },
    touch() {
      lastActivity = now();
    },
  };
};
