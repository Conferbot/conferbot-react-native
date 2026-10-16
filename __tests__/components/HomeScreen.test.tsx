/**
 * The home screen drawn and tapped (components/Home/HomeScreen.tsx over
 * core/home.ts; web conferbot-widget src/ts/home/firstImpression.ts
 * enhanceHome): every tap goes where the web sends it.
 */
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import ConferBotContext from '../../src/context/ConferBotContext';
import { ThemeProvider } from '../../src/theme';
import { HomeScreen } from '../../src/components/Home/HomeScreen';

const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

const KB = {
  categories: [
    { _id: 'c1', name: 'Billing', articles: [{ _id: 'a3', title: 'Changing your plan', description: 'Upgrade or cancel.', content: 'x' }] },
  ],
  recentArticles: [{ _id: 'a2', title: 'Embedding the widget', description: 'Copy one script tag.', content: 'y' }],
};

const setup = (o: any = {}) => {
  const value: any = {
    serverCustomizations: { enableInitialPage: true, initialPageTitle: 'Hi there 👋', logo: 'https://cdn.x/logo.png', logoText: 'Acme', ...(o.c || {}) },
    customizations: {},
    widgetTheme: { tokens: null },
    botName: 'Acme',
    agentBot: o.agent || null,
    knowledgeBase: o.kb || { categories: [], recentArticles: [] },
    homeMemory: o.memory || null,
    chatSessionId: o.chatSessionId,
    requests: o.requests ?? null,
    requestsSeen: {},
    homeView: 'home',
    showHome: jest.fn(),
    showChat: jest.fn(),
    showHelp: jest.fn(),
    openArticle: jest.fn(),
    openRequests: jest.fn(),
    searchArticleText: jest.fn(async () => []),
  };
  const onClose = jest.fn();
  const view = render(
    <ThemeProvider>
      <ConferBotContext.Provider value={value}>
        <HomeScreen onClose={onClose} />
      </ConferBotContext.Provider>
    </ThemeProvider>
  );
  return { ...view, value, onClose };
};

describe('HomeScreen', () => {
  it('draws nothing when the owner has no home screen', () => {
    const { toJSON } = setup({ c: { enableInitialPage: false } });
    expect(toJSON()).toBeNull();
  });

  it('the header, the honest description and "Talk to us"', () => {
    const { getByTestId, getAllByText, value, onClose } = setup();
    expect(getByTestId('cb-home-title').props.children).toBe('Hi there 👋');
    expect(getByTestId('cb-home-description').props.children).toBe("Ask us anything - we're here to help.");
    // The brand above the greeting and the card's name.
    expect(getAllByText('Acme')).toHaveLength(2);
    expect(getByTestId('cb-home-status').props.children).toBe('Online · Answers instantly, day or night');
    expect(getByTestId('cb-home-online-dot')).toBeTruthy();
    fireEvent.press(getByTestId('cb-home-talk-button'));
    expect(value.showChat).toHaveBeenCalledWith();
    fireEvent.press(getByTestId('cb-home-close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('an agent: ask anything goes to the chat with the question; a starter asks it', () => {
    const agent = { displayName: 'Ava', starters: ['Pricing?'], avatar: null };
    const { getByTestId, queryByTestId, value } = setup({ agent });
    fireEvent.changeText(getByTestId('cb-home-ask-input'), 'Do you ship abroad?');
    // While asking, the list is the page.
    expect(queryByTestId('cb-home-talk')).toBeNull();
    fireEvent(getByTestId('cb-home-ask-input'), 'submitEditing');
    expect(value.showChat).toHaveBeenLastCalledWith('Do you ship abroad?');
    fireEvent.changeText(getByTestId('cb-home-ask-input'), '');
    fireEvent.press(getByTestId('cb-home-starter-0'));
    expect(value.showChat).toHaveBeenLastCalledWith('Pricing?');
  });

  it('a flow bot with help articles: search finds an article; nothing found offers the chat', () => {
    const { getByTestId, value } = setup({ c: { enableKnowledgeBase: true }, kb: KB });
    fireEvent.changeText(getByTestId('cb-home-ask-input'), 'plan');
    fireEvent.press(getByTestId('cb-home-ask-article-a3'));
    expect(value.openArticle).toHaveBeenCalledWith('a3');
    fireEvent.changeText(getByTestId('cb-home-ask-input'), 'mars rover');
    expect(getByTestId('cb-home-ask-none')).toBeTruthy();
    fireEvent.press(getByTestId('cb-home-ask-chat'));
    expect(value.showChat).toHaveBeenLastCalledWith();
  });

  it('the help card: a recent article, a topic, See all', () => {
    const { getByTestId, value } = setup({ c: { enableKnowledgeBase: true }, kb: KB });
    fireEvent.press(getByTestId('cb-home-article-a2'));
    expect(value.openArticle).toHaveBeenCalledWith('a2');
    fireEvent.press(getByTestId('cb-home-topic-c1'));
    expect(value.showHelp).toHaveBeenCalledWith('c1');
    fireEvent.press(getByTestId('cb-home-help-all'));
    expect(value.showHelp).toHaveBeenLastCalledWith();
  });

  it('the ask box off: the help card searches itself and offers to chat instead', () => {
    const { getByTestId, queryByTestId, value } = setup({ c: { enableKnowledgeBase: true, homeAskBox: false }, kb: KB });
    expect(queryByTestId('cb-home-ask')).toBeNull();
    fireEvent.changeText(getByTestId('cb-home-help-input'), 'nothing like it');
    fireEvent.press(getByTestId('cb-home-help-instead'));
    expect(value.showChat).toHaveBeenLastCalledWith(undefined);
  });

  it('your requests: a row opens it, See all (n) the list', () => {
    const at = (s: number) => new Date(Date.now() - s * 1000).toISOString();
    const requests = [
      { id: 'r1', title: 'Invoice', status: 'open', lastFrom: 'visitor', lastAt: at(30) },
      { id: 'r2', title: 'Delivery', status: 'open', lastFrom: 'visitor', lastAt: at(20) },
      { id: 'r3', title: 'Refund', status: 'open', lastFrom: 'visitor', lastAt: at(10) },
    ];
    const { getByTestId, queryByTestId, getByText, value } = setup({ requests });
    expect(queryByTestId('cb-home-request-r1')).toBeNull();
    fireEvent.press(getByTestId('cb-home-request-r3'));
    expect(value.openRequests).toHaveBeenCalledWith('r3');
    expect(getByText('See all (3)')).toBeTruthy();
    fireEvent.press(getByTestId('cb-home-requests-all'));
    expect(value.openRequests).toHaveBeenLastCalledWith();
  });

  it('welcome back: pick up where you left off asks again when the chat is gone', () => {
    const agent = { displayName: 'Ava', starters: [], avatar: null };
    const memory = { at: Date.now() - 2 * 3600000, name: 'Jamie', topic: 'Do you support Shopify stores?', session: 'old' };
    const { getByTestId, value } = setup({ agent, memory, chatSessionId: 'new' });
    expect(getByTestId('cb-home-hello').props.children).toBe('Welcome back, Jamie');
    fireEvent.press(getByTestId('cb-home-resume-row'));
    expect(value.showChat).toHaveBeenCalledWith('Do you support Shopify stores?');
  });

  it('trust: the rating on the card and the logos with their line', async () => {
    // (The test renderer's Image has no prefetch: the logos show at once.)
    const c = { homeRating: { average: 4.83, count: 120 }, homeTrustLogos: ['https://cdn.x/l.png'], homeTrustLabel: 'Trusted by 2,000+ teams' };
    const { getByTestId, getByText } = setup({ c });
    expect(getByTestId('cb-home-rating').props.accessibilityLabel).toBe('Rated 4.8 out of 5 from 120 reviews');
    await act(flush);
    expect(getByTestId('cb-home-trust')).toBeTruthy();
    expect(getByText('Trusted by 2,000+ teams')).toBeTruthy();
  });
});
