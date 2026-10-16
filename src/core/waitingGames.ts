/**
 * Waiting games: the owner's settings, the catalogue, and when the offer is
 * made and when it steps aside. Ported from the web widget:
 * conferbot-widget src/ts/chat/games/settings.ts (waitingGamesOf, GAMES,
 * PLAY_RE) and src/ts/chat/games/wire.ts (OFFER_DELAY_MS, the offer's
 * retries, "Not now", the typed "play"), with nodeKit.ts pickAccent for the
 * card's accent. Pure: the card itself is core/gamesCard.ts, and the
 * provider (context/hooks/useWaitingExtras.ts) feeds the signals in.
 *
 *   waitingGames: { enabled: boolean, games: string[], offerText: string }
 *
 * Unset means on with every game: the offer only ever appears while a
 * visitor is waiting for a person (cb:waiting-for-human), never starts a
 * game by itself, and goes away the moment a teammate joins.
 *
 *   cb:waiting-for-human  after OFFER_DELAY_MS, one offer card per wait.
 *   cb:human-joined       a game in progress is saved and folded away
 *                         (wrapUp), an unused offer leaves.
 *   cb:wait-over          no offer any more; an unused card leaves, a game
 *                         being played stays to finish.
 *
 * While waiting, a visitor who types "play" or "games" gets the menu instead
 * of sending it. "Not now" (or the x) means no more offers for this app
 * session (the web: this page view). Nothing is stored or sent.
 */

export type GameId = 'rps' | 'ttt' | 'quiz' | 'memory' | 'reaction' | 'emoji' | 'scramble';

export interface GameMeta {
  id: GameId;
  emoji: string;
  name: string;
  /** One line for the menu. */
  blurb: string;
}

export const GAMES: readonly GameMeta[] = [
  { id: 'rps', emoji: '✊', name: 'Rock paper scissors', blurb: 'Best of three against the bot' },
  { id: 'ttt', emoji: '⭕', name: 'Tic-tac-toe', blurb: 'Three in a row beats the bot' },
  { id: 'quiz', emoji: '🧠', name: 'Quick quiz', blurb: 'Three quick questions' },
  { id: 'memory', emoji: '🃏', name: 'Memory match', blurb: 'Find the six pairs' },
  { id: 'reaction', emoji: '⚡', name: 'Reflex test', blurb: 'Tap the moment it turns green' },
  { id: 'emoji', emoji: '🤔', name: 'Emoji riddles', blurb: 'Guess the phrase from the emoji' },
  { id: 'scramble', emoji: '🔤', name: 'Word scramble', blurb: 'Unscramble the letters' },
];

export const GAME_IDS: readonly GameId[] = GAMES.map((g) => g.id);

export const gameMeta = (id: string): GameMeta | undefined => GAMES.find((g) => g.id === id);

export const DEFAULT_OFFER_TEXT = 'While you wait - fancy a quick game? 🎮';
export const OFFER_TEXT_MAX = 140;

/**
 * The games that work in a language: the emoji riddles are English
 * wordplay ("Bookworm", "Hot dog"), so they are offered in English only.
 */
export const gamesForLanguage = <T extends { id: GameId }>(games: readonly T[], lang: string): T[] =>
  games.filter((g) => g.id !== 'emoji' || lang === 'en');

export interface WaitingGamesSettings {
  enabled: boolean;
  games: GameId[];
  offerText: string;
}

/** The settings as the widget uses them, from whatever was stored. */
export const waitingGamesOf = (c: any): WaitingGamesSettings => {
  const w = c?.waitingGames && typeof c.waitingGames === 'object' ? c.waitingGames : {};
  const games = Array.isArray(w.games)
    ? (w.games as unknown[]).filter(
        (g, i, all): g is GameId => typeof g === 'string' && GAME_IDS.includes(g as GameId) && all.indexOf(g) === i
      )
    : [...GAME_IDS];
  const text = typeof w.offerText === 'string' ? w.offerText.replace(/\s+/g, ' ').trim().slice(0, OFFER_TEXT_MAX) : '';
  return { enabled: w.enabled !== false && games.length > 0, games, offerText: text || DEFAULT_OFFER_TEXT };
};

/** Typed while waiting, these open the games menu: "play", "games", "let's play", "play a game". */
export const PLAY_RE = /^\s*(?:let'?s\s+)?(?:play(?:\s+a)?(?:\s+game)?|games?|i\s+want\s+to\s+play)\s*[!.?]*\s*$/i;

// ------------------------------------------------------------ the accent

const hexToRgb = (hex: string): [number, number, number] | null => {
  const m = String(hex || '').trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** Relative luminance (0 black .. 1 white), or null for non-hex input (web nodeKit.ts). */
export const luminance = (hex: string): number | null => {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/**
 * The card's accent (web nodeKit.ts pickAccent): the header colour unless
 * it is too pale to carry white text, then the bot bubble's, the visitor
 * bubble's, the choice text's, then Conferbot blue.
 */
export const pickAccent = (c: any): string => {
  for (const v of [c?.headerBgColor, c?.botMsgColor, c?.userMsgColor, c?.optionBubbleTextColor]) {
    const l = luminance(v);
    if (l !== null && l < 0.5) return v;
  }
  return '#0808EE';
};

// ------------------------------------------------------------ the offer

/** The offer card comes this long after the waiting signal. */
export const OFFER_DELAY_MS = 2500;
/** A card that could not be drawn is tried again this often, OFFER_RETRIES times. */
export const OFFER_RETRY_MS = 1500;
export const OFFER_RETRIES = 3;

type Timer = unknown;

/** What the offer needs of the card on screen (core/gamesCard.ts). */
export interface OfferCard {
  /** Still on screen. */
  up: () => boolean;
  /** A game is under way. */
  playing: () => boolean;
  /** Back to the menu. */
  menu: () => void;
  remove: () => void;
  /** A teammate joined: save a game in progress, or step aside. */
  wrapUp: (name: string) => void;
}

export interface GamesOfferOptions {
  /** The owner's waitingGames allow it now. */
  enabled: () => boolean;
  /** Draw a new card ("offer": the owner's line; "menu": the visitor asked). Null when it cannot. */
  mount: (mode: 'offer' | 'menu') => OfferCard | null;
  setTimer?: (fn: () => void, ms: number) => Timer;
  clearTimer?: (t: Timer) => void;
}

/**
 * The offer's rules (web wire.ts wireWaitingGames). Feed it the signals:
 * waiting() on cb:waiting-for-human, joined(name) on cb:human-joined,
 * waitOver() on cb:wait-over; play(text) before sending the visitor's
 * words; dismissed() when the card's "Not now" or x closes it.
 */
export const createGamesOffer = (o: GamesOfferOptions) => {
  const setTimer = o.setTimer || ((fn: () => void, ms: number) => setTimeout(fn, ms));
  const clearTimer = o.clearTimer || ((t: Timer) => clearTimeout(t as ReturnType<typeof setTimeout>));
  let waiting = false;
  let offered = false;
  let dismissed = false;
  let card: OfferCard | null = null;
  let timer: Timer | null = null;

  const cancel = () => {
    if (timer) clearTimer(timer);
    timer = null;
  };

  const show = (mode: 'offer' | 'menu'): boolean => {
    if (!o.enabled()) return false;
    if (card && card.up() && mode === 'menu') {
      // Mid-game, "play" brings the game back into view instead.
      if (!card.playing()) card.menu();
      return true;
    }
    card = o.mount(mode);
    return !!card;
  };

  return {
    /** cb:waiting-for-human: after OFFER_DELAY_MS, one offer per wait. */
    waiting: () => {
      if (waiting) return;
      waiting = true;
      offered = false;
      cancel();
      // The chat may still be drawing: a few more tries before giving up.
      const attempt = (left: number) => {
        timer = setTimer(() => {
          timer = null;
          if (!waiting || offered || dismissed) return;
          if (card && card.up()) return;
          offered = show('offer');
          if (!offered && left > 0) attempt(left - 1);
        }, left === OFFER_RETRIES ? OFFER_DELAY_MS : OFFER_RETRY_MS);
      };
      attempt(OFFER_RETRIES);
    },
    /** cb:wait-over: no more offers; an unused card leaves, a game being played stays. */
    waitOver: () => {
      waiting = false;
      cancel();
      if (card && card.up() && !card.playing()) {
        card.remove();
        card = null;
      }
    },
    /** cb:human-joined: a game in progress is saved and folded away, an unused card leaves. */
    joined: (name?: unknown) => {
      waiting = false;
      cancel();
      if (card && card.up()) card.wrapUp(typeof name === 'string' ? name : '');
    },
    /**
     * The visitor's words while waiting: "play" opens the menu instead of
     * being sent. True when it did (do not send them).
     */
    play: (text: string): boolean => {
      if (!waiting || !PLAY_RE.test(text || '')) return false;
      if (!show('menu')) return false;
      dismissed = false;
      return true;
    },
    /** The card's "Not now" or x: no more offers for this session. */
    dismissed: () => {
      dismissed = true;
      card = null;
    },
    isWaiting: () => waiting,
    /** A new conversation: the wait is gone ("Not now" still holds, as on the web's page view). */
    reset: () => {
      cancel();
      waiting = false;
      offered = false;
      card = null;
    },
  };
};

export type GamesOffer = ReturnType<typeof createGamesOffer>;
