/**
 * The waiting games' rules (src/core/gamesLogic.ts), the same cases as the
 * web widget's tests/waitingGames.test.js.
 */
import * as L from '../../src/core/gamesLogic';

// A repeatable "random": a fixed sequence.
const seq = (...xs: number[]) => {
  let i = 0;
  return () => xs[i++ % xs.length];
};
const B = (s: string): L.Cell[] => s.split('').map((ch) => (ch === 'X' || ch === 'O' ? ch : null));

describe('rock paper scissors', () => {
  it('every pairing', () => {
    expect(L.rpsOutcome('rock', 'scissors')).toBe('win');
    expect(L.rpsOutcome('paper', 'rock')).toBe('win');
    expect(L.rpsOutcome('scissors', 'paper')).toBe('win');
    expect(L.rpsOutcome('rock', 'paper')).toBe('lose');
    expect(L.rpsOutcome('paper', 'scissors')).toBe('lose');
    expect(L.rpsOutcome('scissors', 'rock')).toBe('lose');
    for (const h of L.HANDS) expect(L.rpsOutcome(h, h)).toBe('draw');
  });

  it('best of three, the first to two', () => {
    expect(L.rpsWinner({ you: 1, bot: 1 })).toBeNull();
    expect(L.rpsWinner({ you: 2, bot: 1 })).toBe('you');
    expect(L.rpsWinner({ you: 0, bot: 2 })).toBe('bot');
  });
});

describe('tic-tac-toe', () => {
  it('rows, columns, diagonals, draws', () => {
    expect(L.tttWinner(B('XXX......'))).toEqual({ winner: 'X', line: [0, 1, 2] });
    expect(L.tttWinner(B('O..O..O..'))).toEqual({ winner: 'O', line: [0, 3, 6] });
    expect(L.tttWinner(B('..X.X.X..'))).toEqual({ winner: 'X', line: [2, 4, 6] });
    expect(L.tttWinner(B('XOXXOOOXX'))).toEqual({ winner: 'draw', line: [] });
    expect(L.tttWinner(B('XO.......'))).toBeNull();
  });

  it('the bot takes a win before it blocks', () => {
    expect(L.tttBotMove(B('OO.XX....'), Math.random, 1)).toBe(2);
  });

  it('the bot always blocks, even when it slips', () => {
    expect(L.tttBotMove(B('XX..O....'), () => 0, 1)).toBe(2);
    expect(L.tttBotMove(B('X...X....'), () => 0.99, 1)).toBe(8);
  });

  it('with no slip the bot never loses', () => {
    const play = (board: L.Cell[], turn: 'X' | 'O'): boolean => {
      const w = L.tttWinner(board);
      if (w) return w.winner !== 'X';
      if (turn === 'O') {
        const m = L.tttBotMove(board, () => 0, 0);
        const next = board.slice();
        next[m] = 'O';
        return play(next, 'X');
      }
      return board.every((v, i) => {
        if (v) return true;
        const next = board.slice();
        next[i] = 'X';
        return play(next, 'O');
      });
    };
    expect(play(Array(9).fill(null), 'X')).toBe(true);
  });

  it('the bot can slip into a casual move, so it can be beaten', () => {
    const moves = new Set<number>();
    for (const r of [0, 0.2, 0.5, 0.8, 0.95]) moves.add(L.tttBotMove(B('X........'), seq(0, r), 1));
    expect(moves.size).toBeGreaterThan(1);
    expect(L.tttBotMove(B('X........'), () => 0.99, 0)).toBe(4);
  });
});

describe('memory', () => {
  it('six pairs, shuffled', () => {
    const deck = L.memoryDeck(L.MEMORY_FACES, 6, seq(0.1, 0.7, 0.3, 0.9, 0.5));
    expect(deck).toHaveLength(12);
    const counts: Record<string, number> = {};
    deck.forEach((c) => (counts[c.face] = (counts[c.face] || 0) + 1));
    expect(Object.keys(counts)).toHaveLength(6);
    expect(Object.values(counts).every((n) => n === 2)).toBe(true);
    expect(deck.map((c) => c.id)).toEqual([...Array(12).keys()]);
  });

  it('a pair stays up, a miss is counted and turned back, the last pair ends it', () => {
    const cards = ['A', 'B', 'A', 'B'].map((face, id) => ({ id, face, matched: false }));
    let s: L.MemoryState = { cards, open: [], moves: 0 };
    let r = L.memoryFlip(s, 0);
    expect(r.result).toBe('open');
    r = L.memoryFlip(r.state, 0);
    expect(r.result).toBe('ignored');
    r = L.memoryFlip(r.state, 1);
    expect(r.result).toBe('miss');
    expect(r.state.moves).toBe(1);
    expect(L.memoryFlip(r.state, 2).result).toBe('ignored');
    s = L.memoryHide(r.state);
    r = L.memoryFlip(L.memoryFlip(s, 0).state, 2);
    expect(r.result).toBe('match');
    expect(r.state.cards[0].matched && r.state.cards[2].matched).toBe(true);
    expect(L.memoryFlip(r.state, 0).result).toBe('ignored');
    r = L.memoryFlip(L.memoryFlip(r.state, 1).state, 3);
    expect(r.result).toBe('done');
    expect(r.state.moves).toBe(3);
  });

  it('stars for fewer moves', () => {
    expect(L.memoryStars(6)).toBe(3);
    expect(L.memoryStars(9)).toBe(3);
    expect(L.memoryStars(12)).toBe(2);
    expect(L.memoryStars(20)).toBe(1);
  });
});

const CATS = [
  {
    name: 'Billing',
    articles: [
      { _id: '1', title: 'Downloading invoices', description: 'Find every invoice in one place.' },
      { _id: '2', title: 'Changing your plan', description: 'Upgrade, downgrade or cancel at any time.' },
    ],
  },
  { name: 'Account', articles: [{ _id: '3', title: 'Resetting your password', description: '' }] },
  { name: 'Shipping', articles: [{ _id: '4', title: 'Tracking an order', description: 'See where your parcel is.' }] },
];

describe('quiz', () => {
  it('questions from the help centre, the right answer among the options', () => {
    const qs = L.quizFromArticles(CATS, [], seq(0.3, 0.6, 0.1, 0.8));
    expect(qs).toHaveLength(3);
    for (const q of qs) {
      expect(q.source).toBe('kb');
      expect(q.options).toHaveLength(3);
      expect(q.answer).toBeGreaterThanOrEqual(0);
      expect(new Set(q.options).size).toBe(3);
    }
    const pw = qs.find((q) => q.q.includes('Resetting your password'));
    expect(pw).toBeTruthy();
    expect(pw!.options[pw!.answer]).toBe('Account');
    expect(pw!.q).toBe('Where in our help centre would you find "Resetting your password"?');
  });

  it('too few articles means trivia', () => {
    expect(L.quizFromArticles([{ name: 'x', articles: [{ title: 'Only one' }] }], [])).toEqual([]);
    const qs = L.buildQuiz(L.TRIVIA, [], seq(0.2, 0.4, 0.6));
    expect(qs).toHaveLength(3);
    expect(qs.every((q) => q.source === 'trivia' && q.options.length === 3)).toBe(true);
  });

  it('help-centre questions come first, topped up with trivia', () => {
    const kb = L.quizFromArticles(CATS, [], seq(0.5)).slice(0, 1);
    expect(L.buildQuiz(L.TRIVIA, kb, seq(0.5)).map((q) => q.source)).toEqual(['kb', 'trivia', 'trivia']);
  });

  it('scoring and the verdict', () => {
    const qs = [{ answer: 0 }, { answer: 2 }, { answer: 1 }] as L.QuizQuestion[];
    expect(L.quizScore(qs, [0, 2, 1])).toBe(3);
    expect(L.quizScore(qs, [0, 1, 1])).toBe(2);
    expect(L.quizScore(qs, [1, 1, 0])).toBe(0);
    expect(L.quizVerdict(3, 3)).toMatch(/Perfect/);
    expect(L.quizVerdict(0, 3)).toMatch(/another go/);
    expect(L.quizVerdict(2, 3)).toMatch(/So close/);
  });
});

describe('reflex, word scramble, emoji riddles', () => {
  it('a fair random wait and a friendly verdict', () => {
    expect(L.reactionDelay(() => 0)).toBe(1200);
    expect(L.reactionDelay(() => 1)).toBe(3400);
    expect(L.reactionVerdict(200)).toMatch(/Lightning/);
    expect(L.reactionVerdict(300)).toMatch(/Sharp/);
    expect(L.reactionVerdict(400)).toMatch(/Nicely/);
    expect(L.reactionVerdict(600)).toMatch(/steady/);
    expect(L.average([200, 300, 401])).toBe(300);
    expect(L.reactionCounts(40)).toBe(false);
    expect(L.reactionCounts(180)).toBe(true);
  });

  it('a scramble is never the word itself, and any case solves it', () => {
    for (const { w } of L.WORDS) {
      const s = L.scrambleWord(w, seq(0.99, 0.98, 0.97, 0.96, 0.95, 0.94));
      expect(s.join('')).not.toBe(w);
      expect(s.slice().sort()).toEqual(w.split('').sort());
    }
    expect(L.scrambleSolved(' planet ', 'PLANET')).toBe(true);
    expect(L.scrambleSolved('PLANTE', 'PLANET')).toBe(false);
  });

  it('four riddle options, one right', () => {
    for (const r of L.RIDDLES) {
      const { options, answer } = L.riddleOptions(r, seq(0.4, 0.1));
      expect(options).toHaveLength(4);
      expect(options[answer]).toBe(r.a);
      expect(new Set(options).size).toBe(4);
    }
  });

  it('no em dashes in the words', () => {
    const all = JSON.stringify([L.TRIVIA, L.RIDDLES, L.WORDS, L.VERDICT]);
    expect(all.includes(String.fromCharCode(0x2014))).toBe(false);
  });
});
