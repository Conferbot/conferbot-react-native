/**
 * Waiting games: the in-chat card as a state machine, with no UI. Ported
 * from the web widget's conferbot-widget src/ts/chat/games/ui.ts
 * (mountGamesCard and the seven game factories): the offer (the owner's
 * line and a chip per game), then the game itself, then "Play again" /
 * "Another game"; folded away when a teammate joins ("Finish my game").
 * The DOM is gone: every change is a new `getState()` snapshot that a view
 * draws (RN: components/LiveChat/GamesCard.tsx), and every tap is a call.
 *
 * Timers go through the injected clock. A game's pending steps (the bot's
 * move, cards turning back, the next round) are held while the card is
 * paused and run on resume, as the web's ctx.queued. With `reducedMotion`
 * the rock-paper-scissors shake is skipped and the bot moves sooner.
 *
 * Nothing here is sent anywhere or stored: the games are the visitor's own
 * and leave no trace in the transcript.
 */
import { GAMES, GameId, GameMeta, gameMeta, gamesForLanguage, waitingGamesOf, offerLine } from './waitingGames';
import { t as tr, localized, I18nKey, widgetLanguage } from './i18n';
import {
  Rng,
  Hand,
  HANDS,
  HAND_EMOJI,
  HAND_NAME,
  rpsOutcome,
  rpsWinner,
  Cell,
  tttWinner,
  tttBotMove,
  memoryDeck,
  memoryFlip,
  memoryHide,
  memoryStars,
  MemoryState,
  quizFromArticles,
  buildQuiz,
  quizVerdict,
  reactionDelay,
  reactionVerdict,
  reactionCounts,
  average,
  scrambleWord,
  scrambleSolved,
  riddleOptions,
  shuffle,
  triviaFor,
  wordsFor,
  RIDDLES,
  MEMORY_FACES,
} from './gamesLogic';

type Timer = unknown;

/** The card's words (web ui.ts, "games.*"), in the active language. */
export const GAMES_TEXT = Object.assign(
  localized({
    card: 'games.card',
    close: 'games.close',
    pick: 'games.pick',
    again: 'games.again',
    another: 'games.another',
    notNow: 'common.notNow',
    pausedSomeone: 'games.paused.someone',
    pausedSaved: 'games.paused.saved',
    resume: 'games.paused.resume',
  }),
  { pausedNamed: (name: string): string => tr('games.paused.named', { name }) }
);

export interface FootButton {
  key: 'notNow' | 'again' | 'another' | 'action' | 'resume';
  label: string;
  primary: boolean;
}

export type RpsBoard = {
  kind: 'rps';
  you: string;
  bot: string;
  outcome: 'win' | 'lose' | 'draw' | null;
  shaking: boolean;
  busy: boolean;
  hands: { hand: Hand; emoji: string; name: string }[];
};
export type TttBoard = { kind: 'ttt'; cells: Cell[]; line: number[]; over: boolean; thinking: boolean };
export type MemoryBoard = { kind: 'memory'; cards: { face: string; up: boolean; matched: boolean }[]; pop: number[] };
export type ChoiceBoard = {
  kind: 'choice';
  game: 'quiz' | 'emoji';
  tag?: string;
  big?: string;
  q: string;
  options: string[];
  answer: number;
  picked: number | null;
};
export type ReactionBoard = { kind: 'reaction'; state: 'idle' | 'wait' | 'go' | 'between' | 'done'; big: string; line: string };
export type ScrambleBoard = {
  kind: 'scramble';
  hint: string;
  letters: string[];
  /** Slot i holds letters[placed[i]]. */
  placed: number[];
  solved: boolean;
  revealed: boolean;
  /** Bumped on a wrong word (the slots shake). */
  nope: number;
  skipLabel: string;
};
export type Board = RpsBoard | TttBoard | MemoryBoard | ChoiceBoard | ReactionBoard | ScrambleBoard;

export interface GamesCardState {
  view: 'menu' | 'game' | 'paused' | 'gone';
  title: string;
  titleEmoji: string;
  /** The score or progress at the card's top right. */
  meta: string;
  /** The line under the game (announced politely). */
  status: string;
  result: 'win' | 'done' | null;
  /** A finished game left as a result when a teammate joined: no buttons, no close. */
  settled: boolean;
  closable: boolean;
  /** The menu's games (the owner's, for the language). */
  chips: GameMeta[];
  game: GameId | null;
  board: Board | null;
  foot: FootButton[];
  /** Bumped for a small "nice!" and for a win's confetti. */
  cheer: number;
  confetti: number;
}

export type GameInput =
  | { type: 'rps'; hand: Hand }
  | { type: 'ttt'; i: number }
  | { type: 'memory'; i: number }
  | { type: 'choice'; i: number }
  | { type: 'reaction' }
  | { type: 'tile'; i: number }
  | { type: 'slot'; i: number }
  | { type: 'skip' }
  /** A hardware key in the word scramble: a letter, or Backspace. */
  | { type: 'key'; key: string };

export interface GamesCardOptions {
  customizations: any;
  categories?: any[];
  recentArticles?: any[];
  /** "offer": the owner's line; "menu": the visitor asked for the games. */
  mode?: 'offer' | 'menu';
  rng?: Rng;
  reducedMotion?: boolean;
  /** The language the games are offered in (the emoji riddles are English only). */
  lang?: string;
  /** The card was closed ("Not now", the x). */
  onDismiss?: () => void;
  setTimer?: (fn: () => void, ms: number) => Timer;
  clearTimer?: (t: Timer) => void;
  /** A clock in milliseconds, for the reflex test (performance.now). */
  now?: () => number;
}

interface Ctx {
  rng: Rng;
  reduced: boolean;
  now: () => number;
  meta: (text: string) => void;
  status: (text: string) => void;
  finish: (text: string, win: boolean) => void;
  cheer: () => void;
  /** The main button in the footer ("Next"), gone once pressed. */
  action: (label: string, fn: () => void) => void;
  /** A pending step, held while paused. */
  later: (fn: () => void, ms: number) => void;
  /** A timer that a pause drops (the reflex test's wait for green). */
  timer: (fn: () => void, ms: number) => Timer;
  clear: (t: Timer) => void;
  categories: any[];
  recent: any[];
  c: any;
  plays: number;
  /** The language the quiz and the scramble are in. */
  lang: string;
}

interface Game {
  input: (a: GameInput) => void;
  board: () => Board;
  pause?: () => void;
}

// ------------------------------------------------------------------ games

// German nouns keep their capital (web ui.ts handLower).
const handLower = (h: Hand) => (widgetLanguage() === 'de' ? HAND_NAME[h] : HAND_NAME[h].toLowerCase());

const rps = (ctx: Ctx): Game => {
  const score = { you: 0, bot: 0 };
  let you = HAND_EMOJI.rock;
  let bot = HAND_EMOJI.rock;
  let outcome: RpsBoard['outcome'] = null;
  let shaking = false;
  let busy = false;
  const show = () => ctx.meta(tr('games.rps.score', { you: score.you, bot: score.bot }));
  show();
  ctx.status(tr('games.rps.intro'));
  return {
    board: () => ({ kind: 'rps', you, bot, outcome, shaking, busy, hands: HANDS.map((hand) => ({ hand, emoji: HAND_EMOJI[hand], name: HAND_NAME[hand] })) }),
    input: (a) => {
      if (a.type !== 'rps' || busy) return;
      const mine = a.hand;
      const theirs = HANDS[Math.floor(ctx.rng() * 3)];
      busy = true;
      you = HAND_EMOJI.rock;
      bot = HAND_EMOJI.rock;
      outcome = null;
      const reveal = () => {
        shaking = false;
        you = HAND_EMOJI[mine];
        bot = HAND_EMOJI[theirs];
        const r = rpsOutcome(mine, theirs);
        outcome = r;
        if (r === 'win') score.you += 1;
        if (r === 'lose') score.bot += 1;
        show();
        const line =
          r === 'draw'
            ? tr('games.rps.draw', { a: HAND_NAME[mine], b: handLower(theirs) })
            : r === 'win'
              ? tr('games.rps.youPoint', { a: HAND_NAME[mine], b: handLower(theirs) })
              : tr('games.rps.botPoint', { a: HAND_NAME[theirs], b: handLower(mine) });
        const w = rpsWinner(score);
        if (w) {
          ctx.finish(
            w === 'you' ? `${line} You win ${score.you}-${score.bot}! 🎉` : `${line} The bot takes it ${score.bot}-${score.you}. Rematch? 🤖`,
            w === 'you'
          );
          return;
        }
        ctx.status(line);
        busy = false;
      };
      if (ctx.reduced) reveal();
      else {
        shaking = true;
        ctx.status(tr('games.rps.shake'));
        ctx.later(reveal, 900);
      }
    },
  };
};

const ttt = (ctx: Ctx): Game => {
  const board: Cell[] = Array(9).fill(null);
  let over = false;
  let busy = false;
  let line: number[] = [];
  const check = () => {
    const w = tttWinner(board);
    if (!w) return false;
    over = true;
    line = w.line;
    if (w.winner === 'X') ctx.finish(tr('games.ttt.win'), true);
    else if (w.winner === 'O') ctx.finish(tr('games.ttt.lose'), false);
    else ctx.finish(tr('games.ttt.draw'), false);
    return true;
  };
  const botTurn = () => {
    busy = true;
    ctx.status(tr('games.ttt.thinking'));
    ctx.later(() => {
      const m = tttBotMove(board, ctx.rng);
      if (m >= 0) board[m] = 'O';
      busy = false;
      if (!check()) ctx.status(tr('games.ttt.yourMove'));
    }, ctx.reduced ? 250 : 550);
  };
  ctx.meta(tr('games.ttt.meta'));
  // Turns alternate between games: the bot opens every second one.
  if (ctx.plays % 2 === 1) botTurn();
  else ctx.status(tr('games.ttt.youFirst'));
  return {
    board: () => ({ kind: 'ttt', cells: board.slice(), line: line.slice(), over, thinking: busy }),
    input: (a) => {
      if (a.type !== 'ttt' || over || busy) return;
      if (a.i < 0 || a.i > 8 || board[a.i]) return;
      board[a.i] = 'X';
      if (!check()) botTurn();
    },
  };
};

const memory = (ctx: Ctx): Game => {
  let s: MemoryState = { cards: memoryDeck(MEMORY_FACES, 6, ctx.rng), open: [], moves: 0 };
  let waiting = false;
  let pop: number[] = [];
  const paint = () => {
    const pairs = s.cards.filter((c) => c.matched).length / 2;
    ctx.meta(tr('games.memory.meta', { moves: s.moves, pairs }));
  };
  paint();
  ctx.status(tr('games.memory.intro'));
  return {
    board: () => ({
      kind: 'memory',
      cards: s.cards.map((c, i) => ({ face: c.face, up: c.matched || s.open.includes(i), matched: c.matched })),
      pop: pop.slice(),
    }),
    input: (a) => {
      if (a.type !== 'memory' || waiting) return;
      const r = memoryFlip(s, a.i);
      if (r.result === 'ignored') return;
      s = r.state;
      pop = [];
      paint();
      if (r.result === 'match') {
        ctx.status(tr('games.memory.pair'));
        // The pair just made (the card tapped and its twin).
        const face = s.cards[a.i]?.face;
        pop = s.cards.map((c, i) => (c.face === face ? i : -1)).filter((i) => i >= 0);
      } else if (r.result === 'miss') {
        ctx.status(tr('games.memory.noPair'));
        waiting = true;
        ctx.later(() => {
          s = memoryHide(s);
          waiting = false;
          paint();
        }, 850);
      } else if (r.result === 'done') {
        ctx.finish(`${tr('games.memory.done', { moves: s.moves })} ${'⭐'.repeat(memoryStars(s.moves))}`, true);
      }
    },
  };
};

interface Round {
  q: string;
  big?: string;
  tag?: string;
  options: string[];
  answer: number;
}

const RIGHT: I18nKey[] = ['games.right.1', 'games.right.2', 'games.right.3', 'games.right.4'];
const pickLine = (xs: string[], rng: Rng) => xs[Math.floor(rng() * xs.length) % xs.length];

/** Shared by the quiz and the emoji riddles: a round at a time, three in all. */
const choiceRounds = (
  ctx: Ctx,
  game: 'quiz' | 'emoji',
  rounds: Round[],
  summary: (score: number, total: number) => { text: string; win: boolean }
): Game => {
  let at = 0;
  let score = 0;
  let picked: number | null = null;
  let shown = 0;
  const meta = () => ctx.meta(tr('games.choice.meta', { n: shown + 1, total: rounds.length, score }));
  const showRound = () => {
    shown = at;
    picked = null;
    meta();
  };
  showRound();
  return {
    board: () => {
      const r = rounds[shown];
      return { kind: 'choice', game, tag: r.tag, big: r.big, q: r.q, options: r.options.slice(), answer: r.answer, picked };
    },
    input: (a) => {
      if (a.type !== 'choice' || picked !== null) return;
      const r = rounds[shown];
      if (a.i < 0 || a.i >= r.options.length) return;
      picked = a.i;
      const right = a.i === r.answer;
      if (right) score += 1;
      meta();
      if (right) ctx.cheer();
      const fb = right ? pickLine(RIGHT.map((k) => tr(k)), ctx.rng) : tr('games.choice.wrong', { answer: r.options[r.answer] });
      at += 1;
      if (at >= rounds.length) {
        const s = summary(score, rounds.length);
        ctx.finish(`${fb}. ${s.text}`, s.win);
        return;
      }
      ctx.status(fb);
      ctx.action(at === rounds.length - 1 ? tr('games.choice.last') : tr('games.choice.next'), showRound);
    },
  };
};

const quiz = (ctx: Ctx): Game => {
  const kb = ctx.c?.enableKnowledgeBase === true ? quizFromArticles(ctx.categories, ctx.recent, ctx.rng) : [];
  const qs = buildQuiz(triviaFor(ctx.lang), kb, ctx.rng);
  ctx.status(kb.length ? tr('games.quiz.introKb') : tr('games.quiz.intro'));
  return choiceRounds(
    ctx,
    'quiz',
    qs.map((q) => ({ q: q.q, options: q.options, answer: q.answer, tag: q.source === 'kb' ? tr('games.quiz.fromKb') : undefined })),
    (score, total) => ({ text: `${tr('games.quiz.score', { score, total })} ${quizVerdict(score, total)}`, win: score === total })
  );
};

const emoji = (ctx: Ctx): Game => {
  const picked = shuffle(RIDDLES, ctx.rng).slice(0, 3);
  ctx.status(tr('games.emoji.intro'));
  return choiceRounds(
    ctx,
    'emoji',
    picked.map((r) => ({ big: r.e, q: tr('games.emoji.q'), ...riddleOptions(r, ctx.rng) })),
    (score, total) => ({ text: `${tr('games.emoji.score', { score, total })} ${quizVerdict(score, total)}`, win: score === total })
  );
};

export const REACTION_ROUNDS = 3;

const reaction = (ctx: Ctx): Game => {
  const times: number[] = [];
  let state: ReactionBoard['state'] = 'idle';
  let big = '⚡';
  let line = tr('games.reaction.start');
  let goAt = 0;
  let timer: Timer | null = null;
  const set = (s: ReactionBoard['state'], e: string, text: string) => {
    state = s;
    big = e;
    line = text;
  };
  ctx.meta(tr('games.reaction.round', { n: 1, total: REACTION_ROUNDS }));
  ctx.status(tr('games.reaction.intro'));
  const start = () => {
    set('wait', '👀', tr('games.reaction.wait'));
    ctx.meta(tr('games.reaction.round', { n: times.length + 1, total: REACTION_ROUNDS }));
    timer = ctx.timer(() => {
      timer = null;
      goAt = ctx.now();
      set('go', '🟢', tr('games.reaction.go'));
    }, reactionDelay(ctx.rng));
  };
  return {
    board: () => ({ kind: 'reaction', state, big, line }),
    // On press, not on release, so the time is the visitor's.
    input: (a) => {
      if (a.type !== 'reaction') return;
      if (state === 'idle' || state === 'between') start();
      else if (state === 'wait') {
        if (timer) ctx.clear(timer);
        timer = null;
        set('between', '🙈', tr('games.reaction.tooSoon'));
        ctx.status(tr('games.reaction.tooSoonHint'));
      } else if (state === 'go') {
        const ms = Math.round(ctx.now() - goAt);
        if (!reactionCounts(ms)) {
          set('between', '🙈', tr('games.reaction.lucky'));
          ctx.status(tr('games.reaction.luckyHint'));
          return;
        }
        times.push(ms);
        if (times.length >= REACTION_ROUNDS) {
          const avg = average(times);
          set('done', '🏁', tr('sdk.games.reactionAvg', { ms: avg }));
          ctx.meta(times.map((t) => `${t}`).join(' · ') + ' ms');
          ctx.finish(`${reactionVerdict(avg)} - ${tr('games.reaction.avg', { ms: avg })}`, avg < 350);
          return;
        }
        set('between', '⏱️', tr('games.reaction.next', { ms }));
        ctx.status(tr('games.reaction.ms', { ms }));
      }
    },
    pause: () => {
      if (timer) ctx.clear(timer);
      timer = null;
      if (state === 'wait' || state === 'go') set('between', '⏸️', tr('games.reaction.resume'));
    },
  };
};

export const SCRAMBLE_ROUNDS = 3;

const scramble = (ctx: Ctx): Game => {
  const words = shuffle(wordsFor(ctx.lang), ctx.rng).slice(0, SCRAMBLE_ROUNDS);
  let at = 0;
  let solved = 0;
  let letters: string[] = [];
  let placed: number[] = [];
  let isSolved = false;
  let revealed = false;
  let nope = 0;
  let word = '';
  let hint = '';
  const round = () => {
    word = words[at].w;
    hint = words[at].hint;
    letters = scrambleWord(word, ctx.rng);
    placed = [];
    isSolved = false;
    revealed = false;
    ctx.meta(tr('games.scramble.meta', { n: at + 1, total: SCRAMBLE_ROUNDS, solved }));
  };
  const next = (msg: string, win: boolean) => {
    at += 1;
    if (win) solved += 1;
    ctx.meta(tr('games.scramble.meta', { n: Math.min(at + 1, SCRAMBLE_ROUNDS), total: SCRAMBLE_ROUNDS, solved }));
    if (at >= SCRAMBLE_ROUNDS) {
      const verdict =
        solved === SCRAMBLE_ROUNDS ? tr('games.scramble.verdict.all') : solved ? tr('games.verdict.nice') : tr('games.scramble.verdict.none');
      ctx.finish(`${msg} ${tr('games.scramble.score', { solved, total: SCRAMBLE_ROUNDS })} ${verdict}`, solved === SCRAMBLE_ROUNDS);
      return;
    }
    ctx.status(msg);
    ctx.later(round, win ? 1100 : 1500);
  };
  const check = () => {
    if (placed.length < letters.length) return;
    const guess = placed.map((i) => letters[i]).join('');
    if (scrambleSolved(guess, word)) {
      isSolved = true;
      ctx.cheer();
      next(tr('games.scramble.gotIt', { word }), true);
    } else {
      nope += 1;
      ctx.status(tr('games.scramble.wrong'));
    }
  };
  const put = (i: number) => {
    if (i < 0 || i >= letters.length || placed.includes(i) || placed.length >= letters.length || isSolved) return;
    placed.push(i);
    check();
  };
  // The web's intro says "or just type": a phone has no keys to type on.
  ctx.status(tr('sdk.games.scrambleIntro'));
  round();
  return {
    board: () => ({
      kind: 'scramble',
      hint,
      letters: letters.slice(),
      placed: placed.slice(),
      solved: isSolved,
      revealed,
      nope,
      skipLabel: at === SCRAMBLE_ROUNDS - 1 ? tr('games.scramble.reveal') : tr('common.skip'),
    }),
    input: (a) => {
      if (a.type === 'tile') put(a.i);
      else if (a.type === 'slot') {
        if (isSolved || placed[a.i] === undefined) return;
        placed.splice(a.i);
      } else if (a.type === 'key') {
        if (isSolved) return;
        if (a.key === 'Backspace') {
          placed.pop();
          return;
        }
        if (!/^[a-z]$/i.test(a.key)) return;
        const i = letters.findIndex((L, j) => L === a.key.toUpperCase() && !placed.includes(j));
        if (i >= 0) put(i);
      } else if (a.type === 'skip') {
        if (isSolved) return;
        isSolved = true;
        revealed = true;
        placed = [];
        word.split('').forEach((L) => placed.push(letters.findIndex((x, j) => x === L && !placed.includes(j))));
        next(tr('games.scramble.itWas', { word }), false);
      }
    },
  };
};

const FACTORIES: Record<GameId, (ctx: Ctx) => Game> = { rps, ttt, quiz, memory, reaction, emoji, scramble };

// ------------------------------------------------------------------ the card

/**
 * One card (web mountGamesCard). Null when the owner left no game for this
 * language. Starts on the menu: with the owner's offer line for an offer,
 * "Pick a game" when the visitor asked.
 */
export const createGamesCard = (o: GamesCardOptions) => {
  const settings = waitingGamesOf(o.customizations);
  const lang = o.lang || widgetLanguage();
  const available = gamesForLanguage(GAMES.filter((g) => settings.games.includes(g.id)), lang);
  if (!available.length) return null;
  const rng = o.rng || Math.random;
  const setTimer = o.setTimer || ((fn: () => void, ms: number) => setTimeout(fn, ms));
  const clearTimer = o.clearTimer || ((t: Timer) => clearTimeout(t as ReturnType<typeof setTimeout>));
  const now = o.now || (() => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()));
  const listeners = new Set<(s: GamesCardState) => void>();

  let state: GamesCardState = {
    view: 'menu',
    title: '',
    titleEmoji: '',
    meta: '',
    status: '',
    result: null,
    settled: false,
    closable: true,
    chips: available,
    game: null,
    board: null,
    foot: [],
    cheer: 0,
    confetti: 0,
  };
  let current: { id: GameId; game: Game; timers: Set<Timer>; queued: Map<Timer, () => void>; over: boolean } | null = null;
  let plays = 0;
  let action: (() => void) | null = null;
  let held: (() => void)[] = [];

  const emit = () => {
    if (current) state = { ...state, board: current.game.board() };
    const snap = state;
    listeners.forEach((fn) => {
      try {
        fn(snap);
      } catch {
        /* a listener's error is its own */
      }
    });
  };
  const patch = (p: Partial<GamesCardState>) => {
    state = { ...state, ...p };
  };

  const stopTimers = () => current?.timers.forEach((t) => clearTimer(t));

  const quietAnother: FootButton = { key: 'another', label: GAMES_TEXT.another, primary: false };

  const showMenu = (first: boolean) => {
    stopTimers();
    current = null;
    action = null;
    patch({
      view: 'menu',
      settled: false,
      closable: true,
      game: null,
      board: null,
      titleEmoji: '',
      title:
        first && o.mode !== 'menu' ? offerLine(settings.offerText) : GAMES_TEXT.pick,
      meta: '',
      status: '',
      result: null,
      foot: [{ key: 'notNow', label: GAMES_TEXT.notNow, primary: false }],
    });
  };

  const open = (id: GameId) => {
    const g = gameMeta(id);
    if (!g || !settings.games.includes(id) || state.view === 'gone') return;
    stopTimers();
    action = null;
    patch({ view: 'game', game: id, titleEmoji: g.emoji, title: g.name, meta: '', status: '', result: null, settled: false, closable: true, foot: [quietAnother] });
    const timers = new Set<Timer>();
    const queued = new Map<Timer, () => void>();
    const entry = { id, game: null as unknown as Game, timers, queued, over: false };
    const live = () => current === entry;
    const ctx: Ctx = {
      rng,
      reduced: !!o.reducedMotion,
      now,
      c: o.customizations,
      categories: o.categories || [],
      recent: o.recentArticles || [],
      plays,
      lang,
      meta: (t) => patch({ meta: t }),
      status: (t) => patch({ status: t }),
      action: (label, fn) => {
        action = fn;
        patch({ foot: [...state.foot.filter((b) => b.key !== 'action'), { key: 'action', label, primary: true }] });
      },
      cheer: () => {
        if (!o.reducedMotion) patch({ cheer: state.cheer + 1 });
      },
      finish: (text, win) => {
        entry.over = true;
        action = null;
        patch({
          result: win ? 'win' : 'done',
          status: text,
          confetti: win && !o.reducedMotion ? state.confetti + 1 : state.confetti,
          foot: [
            { key: 'again', label: GAMES_TEXT.again, primary: true },
            { key: 'another', label: GAMES_TEXT.another, primary: false },
          ],
        });
      },
      later: (fn, ms) => {
        const t = setTimer(() => {
          timers.delete(t);
          queued.delete(t);
          if (!live()) return;
          fn();
          emit();
        }, ms);
        timers.add(t);
        queued.set(t, fn);
      },
      timer: (fn, ms) => {
        const t = setTimer(() => {
          timers.delete(t);
          if (!live()) return;
          fn();
          emit();
        }, ms);
        timers.add(t);
        return t;
      },
      clear: (t) => {
        clearTimer(t);
        timers.delete(t);
      },
    };
    plays += 1;
    current = entry;
    entry.game = FACTORIES[id](ctx);
  };

  const remove = () => {
    stopTimers();
    current = null;
    action = null;
    patch({ view: 'gone', board: null, foot: [] });
  };

  const dismiss = () => {
    if (state.view === 'gone') return;
    remove();
    emit();
    o.onDismiss?.();
  };

  const wrapUp = (name?: string) => {
    if (state.view === 'paused' || state.view === 'gone') return;
    if (!current) {
      // Only the offer or the menu: nothing to keep.
      remove();
      emit();
      return;
    }
    if (current.over) {
      // A finished game stays as a result, without its buttons.
      patch({ foot: [], settled: true, closable: false });
      emit();
      return;
    }
    current.game.pause?.();
    // Hold the game's pending steps for "Finish my game": dropped, the board would stay locked.
    held = Array.from(current.queued.values());
    stopTimers();
    current.timers.clear();
    current.queued.clear();
    action = null;
    const who = (name || '').trim().slice(0, 40);
    patch({
      view: 'paused',
      titleEmoji: '👋',
      title: who ? GAMES_TEXT.pausedNamed(who) : GAMES_TEXT.pausedSomeone,
      status: GAMES_TEXT.pausedSaved,
      foot: [{ key: 'resume', label: GAMES_TEXT.resume, primary: false }],
    });
    emit();
  };

  const resume = () => {
    if (!current || state.view !== 'paused') return;
    const g = gameMeta(current.id);
    patch({ view: 'game', titleEmoji: g?.emoji || '', title: g?.name || '', status: '', foot: [] });
    const run = held.splice(0);
    run.forEach((fn) => fn());
  };

  showMenu(true);

  return {
    getState: () => state,
    subscribe: (fn: (s: GamesCardState) => void) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    open: (id: GameId) => {
      open(id);
      emit();
    },
    menu: () => {
      if (state.view === 'gone') return;
      showMenu(false);
      emit();
    },
    /** A footer button. */
    press: (key: FootButton['key']) => {
      if (!state.foot.some((b) => b.key === key)) return;
      if (key === 'notNow') return dismiss();
      if (key === 'again' && current) open(current.id);
      else if (key === 'another') showMenu(false);
      else if (key === 'resume') resume();
      else if (key === 'action' && action) {
        const fn = action;
        action = null;
        patch({ foot: state.foot.filter((b) => b.key !== 'action') });
        fn();
      }
      emit();
    },
    /** A tap inside the game. */
    input: (a: GameInput) => {
      if (state.view !== 'game' || !current || current.over) return;
      current.game.input(a);
      emit();
    },
    /** The x. */
    dismiss,
    wrapUp,
    remove: () => {
      if (state.view === 'gone') return;
      remove();
      emit();
    },
    /** A game is under way (not the menu, not a finished one). */
    playing: () => state.view === 'game' && !!current && !current.over,
    up: () => state.view !== 'gone',
  };
};

export type GamesCard = NonNullable<ReturnType<typeof createGamesCard>>;
