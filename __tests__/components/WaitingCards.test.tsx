/**
 * The while-you-wait cards (components/LiveChat/WaitHelpCard.tsx and
 * GamesCard.tsx): drawn from the provider's state and the games
 * controller, taps going back to them.
 */
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { Linking } from 'react-native';
import ConferBotContext from '../../src/context/ConferBotContext';
import { ThemeProvider } from '../../src/theme';
import { WaitHelpCard } from '../../src/components/LiveChat/WaitHelpCard';
import { GamesCardView } from '../../src/components/LiveChat/GamesCard';
import { createGamesCard, GamesCard } from '../../src/core/gamesCard';

const withContext = (ui: React.ReactElement, value: any) =>
  render(
    <ThemeProvider>
      <ConferBotContext.Provider value={value}>{ui}</ConferBotContext.Provider>
    </ThemeProvider>
  );

const card = (o: any = {}) => ({ key: 1, items: [], solvable: false, settled: false, busy: false, done: false, ...o });

describe('WaitHelpCard', () => {
  it('nothing without a card', () => {
    expect(withContext(<WaitHelpCard />, { waitHelp: null }).toJSON()).toBeNull();
  });

  it('our own articles: the rows, Read, no That solved it; a row opens the article', () => {
    const openHelpItem = jest.fn();
    const item = { kind: 'article', id: 'a1', title: 'Downloading invoices', description: 'Find every invoice in one place.' };
    const { getByText, queryByText } = withContext(<WaitHelpCard />, { waitHelp: card({ items: [item] }), openHelpItem });
    expect(getByText('While you wait, this might help')).toBeTruthy();
    expect(getByText('Find every invoice in one place.')).toBeTruthy();
    expect(getByText('Read', { includeHiddenElements: true })).toBeTruthy();
    expect(queryByText('That solved it')).toBeNull();
    fireEvent.press(getByText('Downloading invoices'));
    expect(openHelpItem).toHaveBeenCalledWith(item);
  });

  it("the server's pick: That solved it; a page opens in the browser", () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as any);
    const solveWait = jest.fn();
    const page = { kind: 'page', id: 'p1', title: 'Pricing', url: 'https://example.com/pricing' };
    const { getByText } = withContext(<WaitHelpCard />, { waitHelp: card({ items: [page], solvable: true }), openHelpItem: jest.fn(), solveWait });
    fireEvent.press(getByText('Pricing'));
    expect(openURL).toHaveBeenCalledWith('https://example.com/pricing');
    fireEvent.press(getByText('That solved it'));
    expect(solveWait).toHaveBeenCalled();
  });

  it('left the queue this way: Glad that helped; the wait over: the history title, no button', () => {
    const items = [{ kind: 'article', id: 'a1', title: 'Invoices' }];
    const done = withContext(<WaitHelpCard />, { waitHelp: card({ items, solvable: true, done: true, settled: true }) });
    expect(done.getByText('Glad that helped. You have left the queue.')).toBeTruthy();
    expect(done.getByText('Articles that might help')).toBeTruthy();
    const settled = withContext(<WaitHelpCard />, { waitHelp: card({ items, solvable: false, settled: true }) });
    expect(settled.getByText('Articles that might help')).toBeTruthy();
    expect(settled.queryByText('That solved it')).toBeNull();
  });
});

describe('GamesCardView', () => {
  const make = () => {
    let id = 0;
    const timers = new Map<number, () => void>();
    const c = createGamesCard({
      customizations: { headerBgColor: '#123456' },
      rng: () => 0.9,
      reducedMotion: true,
      setTimer: (fn: () => void) => (timers.set(++id, fn), id),
      clearTimer: (t: unknown) => timers.delete(t as number),
    }) as GamesCard;
    const flush = () =>
      act(() => {
        [...timers.entries()].forEach(([k, fn]) => {
          timers.delete(k);
          fn();
        });
      });
    const view = withContext(<GamesCardView card={c} />, { serverCustomizations: { headerBgColor: '#123456' }, customizations: {} });
    return { c, flush, ...view };
  };

  it('the offer: a chip per game and Not now; Not now closes it', () => {
    const { getByText, getByTestId, c, toJSON } = make();
    expect(getByText('While you wait - fancy a quick game? 🎮')).toBeTruthy();
    for (const name of ['Rock paper scissors', 'Tic-tac-toe', 'Quick quiz', 'Memory match', 'Reflex test', 'Emoji riddles', 'Word scramble']) expect(getByText(name)).toBeTruthy();
    expect(getByTestId('cb-games-close')).toBeTruthy();
    fireEvent.press(getByText('Not now'));
    expect(c.getState().view).toBe('gone');
    expect(toJSON()).toBeNull();
  });

  it('tic-tac-toe played from the board; the bot answers', () => {
    const { getByText, getByTestId, c, flush } = make();
    fireEvent.press(getByText('Tic-tac-toe'));
    expect(getByText('You go first - tap a square')).toBeTruthy();
    expect(getByText('You ✕ · Bot ◯')).toBeTruthy();
    fireEvent.press(getByTestId('cb-games-ttt-4'));
    expect(getByText('The bot is thinking...')).toBeTruthy();
    flush();
    expect(getByText('Your move')).toBeTruthy();
    expect(c.getState().board).toMatchObject({ kind: 'ttt' });
    expect(getByText('Another game')).toBeTruthy();
  });

  it('rock paper scissors to the end: Play again and Another game', () => {
    const { getByText, getByTestId } = make();
    fireEvent.press(getByText('Rock paper scissors'));
    fireEvent.press(getByTestId('cb-games-rps-rock'));
    fireEvent.press(getByTestId('cb-games-rps-rock'));
    expect(getByText('Rock beats scissors - point to you! You win 2-0! 🎉')).toBeTruthy();
    fireEvent.press(getByText('Another game'));
    expect(getByText('Pick a game')).toBeTruthy();
  });

  it('a person joins mid-game: their name, the game saved, Finish my game', () => {
    const { getByText, queryByTestId, c } = make();
    fireEvent.press(getByText('Memory match'));
    act(() => c.wrapUp('Sam'));
    expect(getByText("Sam's here!")).toBeTruthy();
    expect(getByText('Your game is saved - finish it later?')).toBeTruthy();
    expect(queryByTestId('cb-games-mem-0')).toBeNull();
    fireEvent.press(getByText('Finish my game'));
    expect(queryByTestId('cb-games-mem-0')).toBeTruthy();
  });

  it('the quiz: an option, then Next', () => {
    const { getByText, getByTestId, c } = make();
    fireEvent.press(getByText('Quick quiz'));
    const b: any = c.getState().board;
    fireEvent.press(getByTestId(`cb-games-opt-${b.answer}`));
    expect(getByText('1 of 3 · 1 right')).toBeTruthy();
    fireEvent.press(getByText('Next →'));
    expect(getByText('2 of 3 · 1 right')).toBeTruthy();
  });

  it('the reflex pad and the word scramble take taps', () => {
    const { getByText, getByTestId, c } = make();
    fireEvent.press(getByText('Reflex test'));
    fireEvent(getByTestId('cb-games-pad'), 'pressIn');
    expect(getByText('Wait for green...')).toBeTruthy();
    fireEvent.press(getByText('Another game'));
    fireEvent.press(getByText('Word scramble'));
    fireEvent.press(getByTestId('cb-games-tile-0'));
    expect((c.getState().board as any).placed).toEqual([0]);
    fireEvent.press(getByTestId('cb-games-slot-0'));
    expect((c.getState().board as any).placed).toEqual([]);
    fireEvent.press(getByTestId('cb-games-skip'));
    expect(getByText(/^It was [A-Z]+\.$/)).toBeTruthy();
  });
});
