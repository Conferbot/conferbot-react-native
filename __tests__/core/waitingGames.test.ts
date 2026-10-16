/**
 * The waiting games' settings and the offer's timing
 * (src/core/waitingGames.ts; web games/settings.ts and games/wire.ts), on a
 * fake clock.
 */
import {
  DEFAULT_OFFER_TEXT,
  GAMES,
  GAME_IDS,
  OFFER_DELAY_MS,
  OFFER_RETRY_MS,
  OFFER_TEXT_MAX,
  PLAY_RE,
  createGamesOffer,
  gamesForLanguage,
  pickAccent,
  waitingGamesOf,
  type OfferCard,
} from '../../src/core/waitingGames';

const clock = () => {
  let now = 0;
  let id = 0;
  const timers = new Map<number, { fn: () => void; at: number }>();
  return {
    set: (fn: () => void, ms: number) => (timers.set(++id, { fn, at: now + ms }), id),
    clear: (t: unknown) => timers.delete(t as number),
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

const fakeCard = () => {
  const c = { on: true, game: false, menus: 0, removed: 0, wrapped: [] as string[] };
  const card: OfferCard = {
    up: () => c.on,
    playing: () => c.game,
    menu: () => c.menus++,
    remove: () => {
      c.on = false;
      c.removed++;
    },
    wrapUp: (name) => c.wrapped.push(name),
  };
  return { c, card };
};

const setup = (enabled = true, failFirst = 0) => {
  const k = clock();
  const mounts: string[] = [];
  let last = fakeCard();
  let fails = failFirst;
  const offer = createGamesOffer({
    enabled: () => enabled,
    mount: (mode) => {
      mounts.push(mode);
      if (fails > 0) {
        fails--;
        return null;
      }
      last = fakeCard();
      return last.card;
    },
    setTimer: k.set,
    clearTimer: k.clear,
  });
  return { k, offer, mounts, last: () => last };
};

describe('waitingGamesOf (web settings.ts)', () => {
  it('unset is on with every game and the default line', () => {
    expect(waitingGamesOf({})).toEqual({ enabled: true, games: [...GAME_IDS], offerText: DEFAULT_OFFER_TEXT });
    expect(GAME_IDS).toHaveLength(7);
  });

  it('off, a subset, unknown games dropped, no games is off, the line cleaned', () => {
    expect(waitingGamesOf({ waitingGames: { enabled: false } }).enabled).toBe(false);
    expect(waitingGamesOf({ waitingGames: { games: ['ttt', 'nope', 'ttt', 'rps'] } }).games).toEqual(['ttt', 'rps']);
    expect(waitingGamesOf({ waitingGames: { games: [] } }).enabled).toBe(false);
    expect(waitingGamesOf({ waitingGames: { offerText: '  Bored?   Play!  ' } }).offerText).toBe('Bored? Play!');
    expect(waitingGamesOf({ waitingGames: { offerText: 'x'.repeat(300) } }).offerText).toHaveLength(OFFER_TEXT_MAX);
  });

  it('the emoji riddles only in English', () => {
    expect(gamesForLanguage(GAMES, 'en').map((g) => g.id)).toContain('emoji');
    expect(gamesForLanguage(GAMES, 'de').map((g) => g.id)).not.toContain('emoji');
  });

  it('typing play or games opens the menu, a real message does not', () => {
    for (const t of ['play', 'Play!', 'games', 'game', "let's play", 'lets play', 'play a game', 'I want to play']) expect(PLAY_RE.test(t)).toBe(true);
    for (const t of ['how do I play the video', 'my game crashed', 'playlist', '']) expect(PLAY_RE.test(t)).toBe(false);
  });

  it('the accent: the header colour unless too pale, then the bot bubble, then Conferbot blue', () => {
    expect(pickAccent({ headerBgColor: '#123456' })).toBe('#123456');
    expect(pickAccent({ headerBgColor: '#ffe4ec', botMsgColor: '#e65100' })).toBe('#e65100');
    expect(pickAccent({ headerBgColor: '#ffffff', botMsgColor: 'red' })).toBe('#0808EE');
    expect(pickAccent(null)).toBe('#0808EE');
  });
});

describe('createGamesOffer (web wire.ts)', () => {
  it('offers once, OFFER_DELAY_MS after the waiting signal', () => {
    const { k, offer, mounts } = setup();
    offer.waiting();
    k.tick(OFFER_DELAY_MS - 1);
    expect(mounts).toEqual([]);
    k.tick(1);
    expect(mounts).toEqual(['offer']);
    // A second signal in the same wait changes nothing.
    offer.waiting();
    k.tick(10000);
    expect(mounts).toEqual(['offer']);
  });

  it('a card that could not be drawn is tried three more times, 1.5s apart', () => {
    const { k, offer, mounts } = setup(true, 10);
    offer.waiting();
    k.tick(OFFER_DELAY_MS);
    k.tick(OFFER_RETRY_MS * 3);
    expect(mounts).toHaveLength(4);
    k.tick(60000);
    expect(mounts).toHaveLength(4);
  });

  it('off: no offer, and "play" is sent as words', () => {
    const { k, offer, mounts } = setup(false);
    offer.waiting();
    k.tick(20000);
    expect(mounts).toEqual([]);
    expect(offer.play('play')).toBe(false);
  });

  it('a person joining before the offer: none comes', () => {
    const { k, offer, mounts } = setup();
    offer.waiting();
    k.tick(1000);
    offer.joined('Sam');
    k.tick(10000);
    expect(mounts).toEqual([]);
    expect(k.size()).toBe(0);
  });

  it('a person joining: the card wraps up with their name', () => {
    const { k, offer, last } = setup();
    offer.waiting();
    k.tick(OFFER_DELAY_MS);
    offer.joined('Sam');
    expect(last().c.wrapped).toEqual(['Sam']);
    offer.joined({ odd: true });
    expect(last().c.wrapped).toEqual(['Sam', '']);
  });

  it('the wait over: an unused card leaves, a game being played stays', () => {
    const a = setup();
    a.offer.waiting();
    a.k.tick(OFFER_DELAY_MS);
    a.offer.waitOver();
    expect(a.last().c.removed).toBe(1);

    const b = setup();
    b.offer.waiting();
    b.k.tick(OFFER_DELAY_MS);
    b.last().c.game = true;
    b.offer.waitOver();
    expect(b.last().c.removed).toBe(0);
  });

  it('the wait over before the offer: none comes', () => {
    const { k, offer, mounts } = setup();
    offer.waiting();
    offer.waitOver();
    k.tick(10000);
    expect(mounts).toEqual([]);
  });

  it('Not now: no more offers this session, even in a later wait; typing play still opens the menu', () => {
    const { k, offer, mounts } = setup();
    offer.waiting();
    k.tick(OFFER_DELAY_MS);
    offer.dismissed();
    offer.waitOver();
    offer.waiting();
    k.tick(10000);
    expect(mounts).toEqual(['offer']);
    expect(offer.play("let's play")).toBe(true);
    expect(mounts).toEqual(['offer', 'menu']);
    // A new conversation keeps a "Not now" (the web: this page view).
    offer.dismissed();
    offer.reset();
    offer.waiting();
    k.tick(10000);
    expect(mounts).toEqual(['offer', 'menu']);
  });

  it('typing play only while waiting; on a card already up it goes back to the menu, mid-game it does not', () => {
    const { k, offer, mounts, last } = setup();
    expect(offer.play('play')).toBe(false);
    offer.waiting();
    expect(offer.play('my game crashed')).toBe(false);
    k.tick(OFFER_DELAY_MS);
    expect(offer.play('games')).toBe(true);
    expect(last().c.menus).toBe(1);
    last().c.game = true;
    expect(offer.play('play')).toBe(true);
    expect(last().c.menus).toBe(1);
    expect(mounts).toEqual(['offer']);
  });
});
