/**
 * Waiting games: the rules and the words, with no UI, so they can be tested
 * on their own. Ported from the web widget:
 * conferbot-widget src/ts/chat/games/logic.ts (every rule as it is) and
 * src/ts/chat/games/content.ts (the English lists; the other languages come
 * with i18n). The English strings of the web's i18n/en.ts "games.*" keys are
 * inlined where logic.ts called t(). Every random choice takes an `rng`
 * (Math.random by default) so tests can pin it.
 */
export type Rng = () => number;

/** A shuffled copy (Fisher-Yates). */
export const shuffle = <T>(items: readonly T[], rng: Rng = Math.random): T[] => {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

export const pick = <T>(items: readonly T[], rng: Rng = Math.random): T => items[Math.floor(rng() * items.length) % items.length];

// ---------------------------------------------------------------- content (web content.ts, English)

export type Trivia = { q: string; a: string; wrong: string[] };
export type Word = { w: string; hint: string };

export const TRIVIA: readonly Trivia[] = [
  { q: 'Which planet is known as the Red Planet?', a: 'Mars', wrong: ['Venus', 'Jupiter'] },
  { q: 'How many legs does a spider have?', a: '8', wrong: ['6', '10'] },
  { q: 'What is the largest ocean on Earth?', a: 'Pacific', wrong: ['Atlantic', 'Indian'] },
  { q: 'Which animal is called the ship of the desert?', a: 'Camel', wrong: ['Horse', 'Elephant'] },
  { q: 'How many continents are there?', a: '7', wrong: ['5', '6'] },
  { q: 'What do bees make?', a: 'Honey', wrong: ['Silk', 'Butter'] },
  { q: 'Which instrument has 88 keys?', a: 'Piano', wrong: ['Guitar', 'Violin'] },
  { q: 'Mix blue and yellow paint and you get...', a: 'Green', wrong: ['Purple', 'Orange'] },
  { q: 'How many minutes are there in a day?', a: '1,440', wrong: ['1,200', '2,400'] },
  { q: 'Which is the fastest land animal?', a: 'Cheetah', wrong: ['Horse', 'Greyhound'] },
  { q: 'What is the hardest natural substance?', a: 'Diamond', wrong: ['Gold', 'Granite'] },
  { q: 'Which gas do plants take in from the air?', a: 'Carbon dioxide', wrong: ['Oxygen', 'Helium'] },
  { q: 'How many sides does a hexagon have?', a: '6', wrong: ['5', '8'] },
  { q: 'What is the tallest animal?', a: 'Giraffe', wrong: ['Elephant', 'Ostrich'] },
  { q: 'Where does the sun rise?', a: 'In the east', wrong: ['In the west', 'In the north'] },
  { q: 'Water boils at sea level at how many degrees Celsius?', a: '100', wrong: ['90', '120'] },
  { q: 'Which is the smallest prime number?', a: '2', wrong: ['1', '3'] },
  { q: 'What is a baby kangaroo called?', a: 'A joey', wrong: ['A kit', 'A cub'] },
];

export const RIDDLES: readonly { e: string; a: string; wrong: string[] }[] = [
  { e: '☀️🌻', a: 'Sunflower', wrong: ['Daisy', 'Sunrise', 'Sunscreen'] },
  { e: '⭐🐟', a: 'Starfish', wrong: ['Goldfish', 'Swordfish', 'Shooting star'] },
  { e: '🥵🐶', a: 'Hot dog', wrong: ['Puppy love', 'Sunbathing', 'Dog days'] },
  { e: '🍿🎬', a: 'Movie night', wrong: ['Popcorn party', 'Film star', 'Snack time'] },
  { e: '🐛📚', a: 'Bookworm', wrong: ['Library', 'Caterpillar', 'Homework'] },
  { e: '🧈🪰', a: 'Butterfly', wrong: ['Dragonfly', 'Firefly', 'Bumblebee'] },
  { e: '🌙🚶', a: 'Moonwalk', wrong: ['Night shift', 'Sleepwalk', 'Stargazing'] },
  { e: '☕⏸️', a: 'Coffee break', wrong: ['Morning rush', 'Tea time', 'Wake up call'] },
  { e: '🐟🍟', a: 'Fish and chips', wrong: ['Sushi', 'Fish fingers', 'Seafood'] },
  { e: '🍯🌙', a: 'Honeymoon', wrong: ['Sweet dreams', 'Moonlight', 'Bedtime'] },
  { e: '🌧️🏹', a: 'Rainbow', wrong: ['Raincoat', 'Archery', 'Storm'] },
  { e: '☀️👓', a: 'Sunglasses', wrong: ['Sunburn', 'Eyesight', 'Daylight'] },
  { e: '🧀🎂', a: 'Cheesecake', wrong: ['Pizza', 'Fondue', 'Cupcake'] },
  { e: '⌚🐶', a: 'Watchdog', wrong: ['Hot dog', 'Dog walk', 'Clockwork'] },
  { e: '🦶⚽', a: 'Football', wrong: ['Footprint', 'Basketball', 'Kick off'] },
  { e: '🌊🏄', a: 'Surfing', wrong: ['Swimming', 'Sailing', 'Beach day'] },
];

export const WORDS: readonly Word[] = [
  { w: 'PLANET', hint: '🪐' },
  { w: 'BANANA', hint: '🍌' },
  { w: 'ROCKET', hint: '🚀' },
  { w: 'MUFFIN', hint: '🧁' },
  { w: 'TURTLE', hint: '🐢' },
  { w: 'PENCIL', hint: '✏️' },
  { w: 'PICNIC', hint: '🧺' },
  { w: 'DRAGON', hint: '🐉' },
  { w: 'COOKIE', hint: '🍪' },
  { w: 'GALAXY', hint: '🌌' },
  { w: 'JUNGLE', hint: '🌴' },
  { w: 'KITTEN', hint: '🐱' },
  { w: 'WAFFLE', hint: '🧇' },
  { w: 'BRIDGE', hint: '🌉' },
  { w: 'PUZZLE', hint: '🧩' },
];

export const MEMORY_FACES: readonly string[] = ['🍕', '🚀', '🌵', '🐙', '🎈', '🍩', '🦊', '🌈', '⚽', '🎧', '🍉', '🐢', '🦄', '🍦'];

// ---------------------------------------------------------------- RPS

export type Hand = 'rock' | 'paper' | 'scissors';
export const HANDS: readonly Hand[] = ['rock', 'paper', 'scissors'];
export const HAND_EMOJI: Record<Hand, string> = { rock: '✊', paper: '✋', scissors: '✌️' };
export const HAND_NAME: Record<Hand, string> = { rock: 'Rock', paper: 'Paper', scissors: 'Scissors' };
const BEATS: Record<Hand, Hand> = { rock: 'scissors', paper: 'rock', scissors: 'paper' };

/** From the visitor's side. */
export const rpsOutcome = (you: Hand, bot: Hand): 'win' | 'lose' | 'draw' =>
  you === bot ? 'draw' : BEATS[you] === bot ? 'win' : 'lose';

/** Best of three: the first to two wins. */
export const RPS_TO_WIN = 2;
export const rpsWinner = (score: { you: number; bot: number }): 'you' | 'bot' | null =>
  score.you >= RPS_TO_WIN ? 'you' : score.bot >= RPS_TO_WIN ? 'bot' : null;

// ---------------------------------------------------------------- Tic-tac-toe

export type Cell = 'X' | 'O' | null;
export const LINES: readonly (readonly [number, number, number])[] = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

/** The winner and the line, "draw" on a full board, else null. */
export const tttWinner = (board: Cell[]): { winner: 'X' | 'O'; line: number[] } | { winner: 'draw'; line: [] } | null => {
  for (const [a, b, c] of LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return { winner: board[a] as 'X' | 'O', line: [a, b, c] };
  }
  return board.every(Boolean) ? { winner: 'draw', line: [] } : null;
};

const empties = (board: Cell[]) => board.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);

/** The square that completes a line for `who`, or -1. */
export const tttFinisher = (board: Cell[], who: 'X' | 'O'): number => {
  for (const line of LINES) {
    const mine = line.filter((i) => board[i] === who).length;
    const open = line.filter((i) => !board[i]);
    if (mine === 2 && open.length === 1) return open[0];
  }
  return -1;
};

const minimax = (board: Cell[], turn: 'X' | 'O', depth: number): number => {
  const w = tttWinner(board);
  if (w) return w.winner === 'O' ? 10 - depth : w.winner === 'X' ? depth - 10 : 0;
  const scores = empties(board).map((i) => {
    board[i] = turn;
    const s = minimax(board, turn === 'O' ? 'X' : 'O', depth + 1);
    board[i] = null;
    return s;
  });
  return turn === 'O' ? Math.max(...scores) : Math.min(...scores);
};

/**
 * The bot (O): always takes a win, always blocks one, and otherwise plays
 * its best move - except now and then (`slip`, 0-1) it plays a casual one,
 * so a sharp visitor can set up a fork and beat it. Smart, but beatable.
 */
export const tttBotMove = (board: Cell[], rng: Rng = Math.random, slip = 0.3): number => {
  const open = empties(board);
  if (!open.length) return -1;
  const win = tttFinisher(board, 'O');
  if (win >= 0) return win;
  const block = tttFinisher(board, 'X');
  if (block >= 0) return block;
  if (rng() < slip) return pick(open, rng);
  const b = board.slice();
  let best = -Infinity;
  let moves: number[] = [];
  for (const i of open) {
    b[i] = 'O';
    const s = minimax(b, 'X', 1);
    b[i] = null;
    if (s > best) {
      best = s;
      moves = [i];
    } else if (s === best) moves.push(i);
  }
  return pick(moves, rng);
};

// ---------------------------------------------------------------- Memory

export interface MemoryCard {
  id: number;
  face: string;
  matched: boolean;
}

/** `pairs` faces from the pool, each twice, shuffled (4x3 = 6 pairs). */
export const memoryDeck = (pool: readonly string[], pairs = 6, rng: Rng = Math.random): MemoryCard[] =>
  shuffle(shuffle(pool, rng).slice(0, pairs).flatMap((f) => [f, f]), rng).map((face, id) => ({ id, face, matched: false }));

export interface MemoryState {
  cards: MemoryCard[];
  /** Face-up cards not yet matched (0, 1 or 2). */
  open: number[];
  moves: number;
}

/**
 * Turn a card over. Two open cards make a move: a pair stays up, a miss
 * reports "miss" (the caller turns them back after a beat with `memoryHide`).
 */
export const memoryFlip = (s: MemoryState, id: number): { state: MemoryState; result: 'ignored' | 'open' | 'match' | 'miss' | 'done' } => {
  const card = s.cards[id];
  if (!card || card.matched || s.open.includes(id) || s.open.length >= 2) return { state: s, result: 'ignored' };
  const open = [...s.open, id];
  if (open.length < 2) return { state: { ...s, open }, result: 'open' };
  const [a, b] = open.map((i) => s.cards[i]);
  const moves = s.moves + 1;
  if (a.face === b.face) {
    const cards = s.cards.map((c) => (c.id === a.id || c.id === b.id ? { ...c, matched: true } : c));
    const done = cards.every((c) => c.matched);
    return { state: { cards, open: [], moves }, result: done ? 'done' : 'match' };
  }
  return { state: { ...s, open, moves }, result: 'miss' };
};

export const memoryHide = (s: MemoryState): MemoryState => ({ ...s, open: [] });

/** Three stars for a near-perfect run, down to one. */
export const memoryStars = (moves: number, pairs = 6): number => (moves <= pairs + 3 ? 3 : moves <= pairs * 2 + 2 ? 2 : 1);

// ---------------------------------------------------------------- Quiz

export interface QuizQuestion {
  q: string;
  options: string[];
  answer: number;
  /** Where it came from: the bot's help centre, or the trivia pool. */
  source: 'kb' | 'trivia';
}

const cleanText = (v: any, max: number) =>
  typeof v === 'string' ? v.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '';

/** Options in a random order, the right one tracked. */
const asQuestion = (q: string, right: string, wrong: string[], source: 'kb' | 'trivia', rng: Rng): QuizQuestion => {
  const options = shuffle([right, ...wrong], rng);
  return { q, options, answer: options.indexOf(right), source };
};

/**
 * Questions from the bot's own help centre: "Which of our articles helps
 * with: <its summary>" and "Where in our help centre would you find
 * <title>?". Needs three titled articles (and three categories for the
 * second kind); none otherwise.
 */
export const quizFromArticles = (categories: any[], recent: any[], rng: Rng = Math.random, count = 3): QuizQuestion[] => {
  const seen = new Set<string>();
  const items: { title: string; desc: string; cat: string }[] = [];
  const add = (a: any, cat: string) => {
    const title = cleanText(a?.title, 70);
    if (!title || seen.has(title.toLowerCase())) return;
    seen.add(title.toLowerCase());
    items.push({ title, desc: cleanText(a?.description, 120), cat });
  };
  (categories || []).forEach((c: any) => (c?.articles || []).forEach((a: any) => add(a, cleanText(c?.name, 40))));
  (recent || []).forEach((a: any) => add(a, ''));
  if (items.length < 3) return [];
  const cats = Array.from(new Set(items.map((i) => i.cat).filter(Boolean)));
  const out: QuizQuestion[] = [];
  for (const it of shuffle(items, rng)) {
    if (out.length >= count) break;
    const others = shuffle(items.filter((o) => o !== it), rng).map((o) => o.title).slice(0, 2);
    if (it.desc && it.desc.toLowerCase() !== it.title.toLowerCase() && others.length === 2) {
      out.push(asQuestion(`Which of our articles helps with: "${it.desc}"`, it.title, others, 'kb', rng));
    } else if (it.cat && cats.length >= 3) {
      const wrong = shuffle(cats.filter((c) => c !== it.cat), rng).slice(0, 2);
      out.push(asQuestion(`Where in our help centre would you find "${it.title}"?`, it.cat, wrong, 'kb', rng));
    }
  }
  return out;
};

/** The quiz: help-centre questions first, topped up with trivia. */
export const buildQuiz = (
  trivia: readonly { q: string; a: string; wrong: string[] }[],
  kb: QuizQuestion[],
  rng: Rng = Math.random,
  count = 3
): QuizQuestion[] => {
  const out = kb.slice(0, count);
  for (const t of shuffle(trivia, rng)) {
    if (out.length >= count) break;
    out.push(asQuestion(t.q, t.a, t.wrong.slice(0, 2), 'trivia', rng));
  }
  return out;
};

/** How many of `picks` are right. */
export const quizScore = (questions: QuizQuestion[], picks: number[]): number =>
  questions.reduce((n, q, i) => n + (picks[i] === q.answer ? 1 : 0), 0);

export const VERDICT = {
  perfect: 'Perfect score! 🏆',
  tough: 'Tough round - have another go? 🙈',
  close: 'So close! 🌟',
  notBad: 'Not bad at all 👍',
  nice: 'Nicely done 👍',
} as const;

export const quizVerdict = (score: number, total: number): string =>
  score === total ? VERDICT.perfect : score === 0 ? VERDICT.tough : score >= total - 1 ? VERDICT.close : VERDICT.notBad;

// ---------------------------------------------------------------- Reflex

/** A random wait before green: 1.2 to 3.4 seconds. */
export const reactionDelay = (rng: Rng = Math.random) => 1200 + Math.round(rng() * 2200);

/** Faster than any person can see it: a lucky guess, counted as too soon. */
export const REACTION_MIN_MS = 100;
export const reactionCounts = (ms: number) => ms >= REACTION_MIN_MS;

export const reactionVerdict = (ms: number): string =>
  ms < 250 ? 'Lightning fast ⚡' : ms < 350 ? 'Sharp reflexes 🎯' : ms < 500 ? VERDICT.nice : 'Slow and steady 🐢';

export const average = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);

// ---------------------------------------------------------------- Word scramble

/** The word's letters in an order that is not the word itself. */
export const scrambleWord = (word: string, rng: Rng = Math.random): string[] => {
  const letters = word.toUpperCase().split('');
  if (new Set(letters).size < 2) return letters;
  for (let tries = 0; tries < 20; tries++) {
    const s = shuffle(letters, rng);
    if (s.join('') !== letters.join('')) return s;
  }
  return letters.slice().reverse();
};

export const scrambleSolved = (guess: string, word: string) => guess.trim().toUpperCase() === word.trim().toUpperCase();

// ---------------------------------------------------------------- Emoji riddles

/** One riddle's options, shuffled, with the answer's index. */
export const riddleOptions = (r: { a: string; wrong: string[] }, rng: Rng = Math.random) => {
  const options = shuffle([r.a, ...r.wrong.slice(0, 3)], rng);
  return { options, answer: options.indexOf(r.a) };
};
