/**
 * The waiting games' card (src/core/gamesCard.ts; web games/ui.ts), on a
 * fake clock: the menu, each game played through, the footer, and folding
 * away when a teammate joins (web tests/audit-games-card.test.js).
 */
import { createGamesCard, GamesCard, ChoiceBoard, MemoryBoard, RpsBoard, ScrambleBoard, TttBoard, ReactionBoard } from '../../src/core/gamesCard';
import { DEFAULT_OFFER_TEXT } from '../../src/core/waitingGames';

const clock = () => {
  let now = 0;
  let id = 0;
  const timers = new Map<number, { fn: () => void; at: number }>();
  return {
    set: (fn: () => void, ms: number) => (timers.set(++id, { fn, at: now + ms }), id),
    clear: (t: unknown) => timers.delete(t as number),
    now: () => now,
    tick(ms: number) {
      const until = now + ms;
      for (;;) {
        const next = [...timers.entries()].sort((a, b) => a[1].at - b[1].at)[0];
        if (!next || next[1].at > until) break;
        timers.delete(next[0]);
        now = next[1].at;
        next[1].fn();
      }
      now = until;
    },
    size: () => timers.size,
  };
};

// rng 0.9: no slip in tic-tac-toe, the bot plays its best move.
const make = (o: Record<string, any> = {}) => {
  const k = clock();
  let dismissed = 0;
  const card = createGamesCard({
    customizations: {},
    rng: () => 0.9,
    setTimer: k.set,
    clearTimer: k.clear,
    now: k.now,
    onDismiss: () => dismissed++,
    ...o,
  }) as GamesCard;
  return { k, card, dismissed: () => dismissed };
};

describe('the menu', () => {
  it("an offer opens on the owner's line with a chip per game and Not now", () => {
    const { card } = make();
    const s = card.getState();
    expect(s.view).toBe('menu');
    expect(s.title).toBe(DEFAULT_OFFER_TEXT);
    expect(s.chips.map((g) => g.id)).toEqual(['rps', 'ttt', 'quiz', 'memory', 'reaction', 'emoji', 'scramble']);
    expect(s.foot.map((b) => b.key)).toEqual(['notNow']);
    expect(card.playing()).toBe(false);
  });

  it("the owner's own line and games; asked for, it says Pick a game", () => {
    expect(make({ customizations: { waitingGames: { offerText: 'Bored? Play!', games: ['ttt'] } } }).card.getState()).toMatchObject({
      title: 'Bored? Play!',
      chips: [expect.objectContaining({ id: 'ttt' })],
    });
    expect(make({ mode: 'menu' }).card.getState().title).toBe('Pick a game');
  });

  it('no game left for the language: no card', () => {
    expect(createGamesCard({ customizations: { waitingGames: { games: ['emoji'] } }, lang: 'de' })).toBeNull();
  });

  it('Not now and the x close it, once', () => {
    const { card, dismissed } = make();
    card.press('notNow');
    expect(card.getState().view).toBe('gone');
    expect(card.up()).toBe(false);
    card.dismiss();
    expect(dismissed()).toBe(1);
  });

  it('a game the owner turned off does not open', () => {
    const { card } = make({ customizations: { waitingGames: { games: ['ttt'] } } });
    card.open('rps');
    expect(card.getState().view).toBe('menu');
  });
});

describe('rock paper scissors', () => {
  it('the hands shake for 900ms, then the point; first to two wins', () => {
    // rng 0.9: the bot always plays scissors.
    const { k, card } = make();
    card.open('rps');
    expect(card.getState()).toMatchObject({ title: 'Rock paper scissors', titleEmoji: '✊', meta: 'You 0 · 0 Bot', status: 'First to two wins. Pick your hand!' });
    card.input({ type: 'rps', hand: 'rock' });
    let b = card.getState().board as RpsBoard;
    expect(b.shaking).toBe(true);
    expect(card.getState().status).toBe('Rock... paper... scissors...');
    // Busy: a second pick is ignored.
    card.input({ type: 'rps', hand: 'paper' });
    k.tick(900);
    b = card.getState().board as RpsBoard;
    expect(b).toMatchObject({ shaking: false, you: '✊', bot: '✌️', outcome: 'win', busy: false });
    expect(card.getState().status).toBe('Rock beats scissors - point to you!');
    expect(card.getState().meta).toBe('You 1 · 0 Bot');
    card.input({ type: 'rps', hand: 'rock' });
    k.tick(900);
    expect(card.getState()).toMatchObject({ result: 'win', status: 'Rock beats scissors - point to you! You win 2-0! 🎉', confetti: 1 });
    expect(card.getState().foot.map((f) => f.key)).toEqual(['again', 'another']);
    expect(card.playing()).toBe(false);
  });

  it('with reduced motion the hands show at once', () => {
    const { card } = make({ reducedMotion: true });
    card.open('rps');
    card.input({ type: 'rps', hand: 'paper' });
    expect(card.getState().status).toBe('Scissors beats paper - point to the bot.');
    expect((card.getState().board as RpsBoard).shaking).toBe(false);
  });
});

describe('tic-tac-toe', () => {
  it('the visitor goes first, the bot thinks for 550ms, then it is their move', () => {
    const { k, card } = make();
    card.open('ttt');
    expect(card.getState()).toMatchObject({ status: 'You go first - tap a square', meta: 'You ✕ · Bot ◯' });
    card.input({ type: 'ttt', i: 0 });
    expect((card.getState().board as TttBoard).thinking).toBe(true);
    card.input({ type: 'ttt', i: 1 });
    expect((card.getState().board as TttBoard).cells.filter(Boolean)).toHaveLength(1);
    k.tick(550);
    const b = card.getState().board as TttBoard;
    expect(b.cells.filter((c) => c === 'O')).toHaveLength(1);
    expect(card.getState().status).toBe('Your move');
  });

  it('the bot opens every second game', () => {
    const { k, card } = make();
    card.open('ttt');
    card.press('another');
    card.open('ttt');
    expect(card.getState().status).toBe('The bot is thinking...');
    k.tick(550);
    expect((card.getState().board as TttBoard).cells.filter((c) => c === 'O')).toHaveLength(1);
  });

  it('a teammate joins while the bot is thinking: Finish my game makes its move, the board is not locked', () => {
    const { k, card } = make();
    card.open('ttt');
    card.input({ type: 'ttt', i: 0 });
    expect(k.size()).toBe(1);
    card.wrapUp('Sam');
    expect(card.getState()).toMatchObject({ view: 'paused', titleEmoji: '👋', title: "Sam's here!", status: 'Your game is saved - finish it later?' });
    expect(card.getState().foot).toEqual([{ key: 'resume', label: 'Finish my game', primary: false }]);
    k.tick(5000);
    expect((card.getState().board as TttBoard).cells.filter((c) => c === 'O')).toHaveLength(0);
    card.input({ type: 'ttt', i: 4 });
    expect((card.getState().board as TttBoard).cells.filter(Boolean)).toHaveLength(1);
    card.press('resume');
    const b = card.getState().board as TttBoard;
    expect(b.cells.filter((c) => c === 'O')).toHaveLength(1);
    expect(b.thinking).toBe(false);
    const free = b.cells.findIndex((c) => !c);
    card.input({ type: 'ttt', i: free });
    expect((card.getState().board as TttBoard).cells.filter((c) => c === 'X')).toHaveLength(2);
  });

  it('a win marks the line and finishes', () => {
    // rng 0 every time: a slip each move, the bot's casual move is the first free square.
    const { k, card } = make({ rng: () => 0 });
    card.open('ttt');
    card.input({ type: 'ttt', i: 4 });
    k.tick(550); // O at 0 (slip, first free)
    card.input({ type: 'ttt', i: 2 });
    k.tick(550); // O blocks 6
    card.input({ type: 'ttt', i: 8 });
    k.tick(550); // O blocks 5 ... whatever it picks, play on until over
    for (let i = 0; i < 9 && card.getState().result === null; i++) {
      const b = card.getState().board as TttBoard;
      const free = b.cells.findIndex((c) => !c);
      if (free < 0) break;
      card.input({ type: 'ttt', i: free });
      k.tick(550);
    }
    const s = card.getState();
    expect(s.result).not.toBeNull();
    expect((s.board as TttBoard).over).toBe(true);
    expect(['Three in a row - you beat the bot! 🎉', 'The bot got this one. Rematch? 🤖', 'A draw - great minds think alike 🤝']).toContain(s.status);
  });
});

describe('memory', () => {
  const byFace = (b: MemoryBoard) => {
    const m: Record<string, number[]> = {};
    b.cards.forEach((c, i) => (m[c.face] ||= []).push(i));
    return Object.values(m);
  };

  it('a pair pops the two cards just matched; a miss turns back after 850ms', () => {
    const { k, card } = make();
    card.open('memory');
    expect(card.getState().meta).toBe('Moves 0 · Pairs 0/6');
    const pairs = byFace(card.getState().board as MemoryBoard);
    card.input({ type: 'memory', i: pairs[0][0] });
    card.input({ type: 'memory', i: pairs[0][1] });
    expect(card.getState().status).toBe('A pair! ✨');
    expect((card.getState().board as MemoryBoard).pop.sort()).toEqual(pairs[0].slice().sort());
    card.input({ type: 'memory', i: pairs[1][0] });
    card.input({ type: 'memory', i: pairs[2][0] });
    expect(card.getState().status).toBe('Not a pair');
    expect((card.getState().board as MemoryBoard).cards.filter((c) => c.up)).toHaveLength(4);
    // Waiting for them to turn back: taps are ignored.
    card.input({ type: 'memory', i: pairs[3][0] });
    k.tick(850);
    expect((card.getState().board as MemoryBoard).cards.filter((c) => c.up)).toHaveLength(2);
    expect(card.getState().meta).toBe('Moves 2 · Pairs 1/6');
  });

  it('all six pairs: the moves and the stars', () => {
    const { card } = make();
    card.open('memory');
    for (const [a, b] of byFace(card.getState().board as MemoryBoard)) {
      card.input({ type: 'memory', i: a });
      card.input({ type: 'memory', i: b });
    }
    expect(card.getState()).toMatchObject({ result: 'win', status: 'All pairs in 6 moves! ⭐⭐⭐' });
  });
});

describe('quiz and emoji riddles', () => {
  const answerAll = (card: GamesCard, right: boolean) => {
    for (let r = 0; r < 3; r++) {
      const b = card.getState().board as ChoiceBoard;
      card.input({ type: 'choice', i: right ? b.answer : (b.answer + 1) % b.options.length });
      if (r < 2) card.press('action');
    }
  };

  it('three trivia rounds: feedback, Next, Last one, the score', () => {
    const { card } = make();
    card.open('quiz');
    expect(card.getState()).toMatchObject({ status: 'Three quick questions', meta: '1 of 3 · 0 right' });
    let b = card.getState().board as ChoiceBoard;
    expect(b.options).toHaveLength(3);
    expect(b.tag).toBeUndefined();
    card.input({ type: 'choice', i: b.answer });
    expect(card.getState().meta).toBe('1 of 3 · 1 right');
    expect(card.getState().cheer).toBe(1);
    expect(card.getState().foot.map((f) => f.label)).toEqual(['Another game', 'Next →']);
    // A second pick on the same round is ignored.
    card.input({ type: 'choice', i: (b.answer + 1) % 3 });
    expect(card.getState().meta).toBe('1 of 3 · 1 right');
    card.press('action');
    expect(card.getState().meta).toBe('2 of 3 · 1 right');
    b = card.getState().board as ChoiceBoard;
    card.input({ type: 'choice', i: (b.answer + 1) % 3 });
    expect(card.getState().status).toBe(`Not quite - it's ${b.options[b.answer]}`);
    expect(card.getState().foot.map((f) => f.label)).toEqual(['Another game', 'Last one →']);
    card.press('action');
    b = card.getState().board as ChoiceBoard;
    card.input({ type: 'choice', i: b.answer });
    expect(card.getState().result).toBe('done');
    expect(card.getState().status).toMatch(/\. 2 out of 3\. So close! 🌟$/);
  });

  it('with the help centre on, questions from its articles come first, tagged', () => {
    const categories = [
      { name: 'Billing', articles: [{ _id: '1', title: 'Downloading invoices', description: 'Find every invoice in one place.' }, { _id: '2', title: 'Changing your plan', description: 'Upgrade or cancel.' }] },
      { name: 'Account', articles: [{ _id: '3', title: 'Resetting your password', description: 'Forgot it? Reset it.' }] },
    ];
    const { card } = make({ customizations: { enableKnowledgeBase: true }, categories });
    card.open('quiz');
    expect(card.getState().status).toBe('Three questions - some about our help centre');
    expect((card.getState().board as ChoiceBoard).tag).toBe('From our help centre');
    const off = make({ customizations: {}, categories }).card;
    off.open('quiz');
    expect((off.getState().board as ChoiceBoard).tag).toBeUndefined();
  });

  it('emoji riddles: the picture, four options, all right is a win', () => {
    const { card } = make();
    card.open('emoji');
    const b = card.getState().board as ChoiceBoard;
    expect(b.big).toBeTruthy();
    expect(b.q).toBe("What's the phrase?");
    expect(b.options).toHaveLength(4);
    answerAll(card, true);
    expect(card.getState().result).toBe('win');
    expect(card.getState().status).toMatch(/3 of 3 riddles solved\. Perfect score! 🏆$/);
  });
});

describe('reflex test', () => {
  it('wait for green, tap; too soon; a lucky guess; three rounds and the average', () => {
    // rng 0.9: green after 1200 + 1980 = 3180ms.
    const { k, card } = make();
    card.open('reaction');
    const pad = () => card.getState().board as ReactionBoard;
    expect(pad()).toMatchObject({ state: 'idle', line: 'Tap to start' });
    card.input({ type: 'reaction' });
    expect(pad()).toMatchObject({ state: 'wait', big: '👀' });
    card.input({ type: 'reaction' });
    expect(pad()).toMatchObject({ state: 'between', line: 'Too soon! Tap to try again' });
    expect(card.getState().status).toBe('Too soon - wait for green');
    card.input({ type: 'reaction' });
    k.tick(3180);
    expect(pad()).toMatchObject({ state: 'go', line: 'Tap now!' });
    k.tick(50);
    card.input({ type: 'reaction' });
    expect(pad().line).toBe('A lucky guess! Tap to try again');
    for (const ms of [200, 300, 400]) {
      card.input({ type: 'reaction' });
      k.tick(3180);
      k.tick(ms);
      card.input({ type: 'reaction' });
    }
    expect(card.getState()).toMatchObject({ result: 'win', status: 'Sharp reflexes 🎯 - 300 ms on average.', meta: '200 · 300 · 400 ms' });
    expect(pad()).toMatchObject({ state: 'done', line: '300 ms average' });
  });

  it('a teammate joining mid-round: the round is reset, Tap to carry on', () => {
    const { k, card } = make();
    card.open('reaction');
    card.input({ type: 'reaction' });
    card.wrapUp('');
    expect(card.getState().title).toBe("Someone's here!");
    k.tick(10000);
    card.press('resume');
    expect(card.getState().board).toMatchObject({ state: 'between', big: '⏸️', line: 'Tap to carry on' });
  });
});

describe('word scramble', () => {
  it('tap letters in order; a wrong word shakes; tap a slot to take it back; solved moves on', () => {
    const { k, card } = make();
    card.open('scramble');
    const b0 = card.getState().board as ScrambleBoard;
    expect(card.getState().meta).toBe('Word 1 of 3 · 0 solved');
    expect(b0.skipLabel).toBe('Skip');
    // Wrong: the tiles as they lie (never the word itself).
    b0.letters.forEach((_, i) => card.input({ type: 'tile', i }));
    let b = card.getState().board as ScrambleBoard;
    expect(b.nope).toBe(1);
    expect(card.getState().status).toBe('Not quite - tap letters to take them back');
    card.input({ type: 'slot', i: 0 });
    expect((card.getState().board as ScrambleBoard).placed).toEqual([]);
    card.input({ type: 'skip' });
    b = card.getState().board as ScrambleBoard;
    expect(b.revealed).toBe(true);
    const revealed = b.placed.map((i) => b.letters[i]).join('');
    expect(card.getState().status).toBe(`It was ${revealed}.`);
    k.tick(1500);
    b = card.getState().board as ScrambleBoard;
    expect(card.getState().meta).toBe('Word 2 of 3 · 0 solved');
    expect(b.placed).toEqual([]);
  });

  it('three words solved: Word wizard', () => {
    const { k, card } = make();
    card.open('scramble');
    const words: string[] = [];
    for (let r = 0; r < 3; r++) {
      const b = card.getState().board as ScrambleBoard;
      const target = solve(b.letters, b.hint);
      words.push(target);
      for (const L of target) card.input({ type: 'key', key: L.toLowerCase() });
      if (r < 2) {
        expect(card.getState().status).toBe(`${target} - got it! 🎉`);
        k.tick(1100);
      }
    }
    expect(card.getState().result).toBe('win');
    expect(card.getState().status).toBe(`${words[2]} - got it! 🎉 You solved 3 of 3. Word wizard! 🧙`);
  });
});

// The scramble words by their hint (web content.ts WORDS).
import { WORDS } from '../../src/core/gamesLogic';
const solve = (letters: string[], hint: string) => {
  const w = WORDS.find((x) => x.hint === hint)!.w;
  expect(letters.slice().sort()).toEqual(w.split('').sort());
  return w;
};

describe('the footer and folding away', () => {
  it('Play again replays the same game; Another game goes back to the menu', () => {
    const { card } = make();
    card.open('memory');
    card.press('another');
    expect(card.getState()).toMatchObject({ view: 'menu', title: 'Pick a game' });
    card.open('rps');
    card.press('again');
    expect(card.getState()).toMatchObject({ view: 'game', game: 'rps', meta: 'You 0 · 0 Bot' });
  });

  it('a teammate joins: the menu leaves; a finished game stays as a result, with no buttons and no x', () => {
    const a = make();
    a.card.wrapUp('Sam');
    expect(a.card.getState().view).toBe('gone');

    const b = make({ reducedMotion: true });
    b.card.open('rps');
    b.card.input({ type: 'rps', hand: 'rock' });
    b.card.input({ type: 'rps', hand: 'rock' });
    expect(b.card.getState().result).toBe('win');
    b.card.wrapUp('Sam');
    expect(b.card.getState()).toMatchObject({ view: 'game', settled: true, closable: false, foot: [] });
  });

  it('the menu on a paused card is back, with its x', () => {
    const { card } = make();
    card.open('rps');
    card.wrapUp('Sam');
    card.menu();
    expect(card.getState()).toMatchObject({ view: 'menu', closable: true });
    expect(card.getState().chips.length).toBe(7);
  });

  it('removed: its timers stop and taps do nothing', () => {
    const { k, card } = make();
    card.open('ttt');
    card.input({ type: 'ttt', i: 0 });
    card.remove();
    expect(k.size()).toBe(0);
    card.input({ type: 'ttt', i: 1 });
    expect(card.getState().view).toBe('gone');
  });

  it('every change reaches the subscribers', () => {
    const { card } = make();
    const seen: string[] = [];
    const off = card.subscribe((s) => seen.push(s.view));
    card.open('quiz');
    card.press('another');
    off();
    card.open('rps');
    expect(seen).toEqual(['game', 'menu']);
  });
});
