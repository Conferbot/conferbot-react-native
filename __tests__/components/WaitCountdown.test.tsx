/**
 * The wait card's max-wait countdown (HandoverWaitCard, core/liveChat.ts
 * maxWaitText), as the web widget's queueCard.ts: "Max wait 1:05", once a
 * second, stopping at 0:00.
 */
import React from 'react';
import { render, act } from '@testing-library/react-native';
import ConferBotContext from '../../src/context/ConferBotContext';
import { ThemeProvider } from '../../src/theme';
import { HandoverWaitCard } from '../../src/components/LiveChat/LiveChatCards';
import { setWidgetLanguage } from '../../src/core/i18n';

const withContext = (value: any) =>
  render(
    <ThemeProvider>
      <ConferBotContext.Provider value={value}>
        <HandoverWaitCard />
      </ConferBotContext.Provider>
    </ThemeProvider>
  );

describe('the wait card\'s countdown (#42)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-16T10:00:00Z'));
  });
  afterEach(() => {
    jest.useRealTimers();
    setWidgetLanguage('en');
  });

  it('counts down once a second to 0:00', () => {
    const { getByTestId } = withContext({ serverCustomizations: {}, queue: null, waitEndsAt: Date.now() + 65000 });
    expect(getByTestId('cb-wait-countdown').props.children).toBe('Max wait 1:05');
    act(() => jest.advanceTimersByTime(1000));
    expect(getByTestId('cb-wait-countdown').props.children).toBe('Max wait 1:04');
    act(() => jest.advanceTimersByTime(64000));
    expect(getByTestId('cb-wait-countdown').props.children).toBe('Max wait 0:00');
    act(() => jest.advanceTimersByTime(5000));
    expect(getByTestId('cb-wait-countdown').props.children).toBe('Max wait 0:00');
  });

  it('none without a deadline', () => {
    const { queryByTestId } = withContext({ serverCustomizations: {}, queue: null, waitEndsAt: null });
    expect(queryByTestId('cb-wait-countdown')).toBeNull();
  });

  it('in the visitor\'s language', () => {
    setWidgetLanguage('fr');
    const { getByTestId } = withContext({ serverCustomizations: {}, queue: null, waitEndsAt: Date.now() + 120000 });
    expect(getByTestId('cb-wait-countdown').props.children).toBe('Attente max. 2:00');
  });
});
