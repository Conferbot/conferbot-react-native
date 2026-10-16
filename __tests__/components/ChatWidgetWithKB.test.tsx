/**
 * ChatWidgetWithKB follows the owner's help centre switch (#40): the tab
 * and header button only while `enableKnowledgeBase` is on, the prop as an
 * explicit override, the bot's own categories unless the host passes some.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Text } from 'react-native';
import ConferBotContext from '../../src/context/ConferBotContext';
import { ThemeProvider } from '../../src/theme';

jest.mock('../../src/components/ChatWidget', () => {
  const { Text: T } = require('react-native');
  return { ChatWidget: () => <T>chat</T> };
});
const seen: any[] = [];
jest.mock('../../src/components/KnowledgeBase/KnowledgeBaseScreen', () => {
  const { Text: T } = require('react-native');
  return {
    KnowledgeBaseScreen: (p: any) => {
      seen.push(p.categories);
      return <T>kb:{(p.categories || []).map((c: any) => c.name).join(',')}</T>;
    },
  };
});

// eslint-disable-next-line import/first
import { ChatWidgetWithKB } from '../../src/components/KnowledgeBase/ChatWidgetWithKB';

const KB = { categories: [{ _id: 'c1', name: 'Billing', articles: [{ _id: 'a1', title: 'Refunds' }] }], recentArticles: [] };

const draw = (props: any, value: any) =>
  render(
    <ThemeProvider>
      <ConferBotContext.Provider value={value}>
        <ChatWidgetWithKB visible testID="w" {...props} />
      </ConferBotContext.Provider>
    </ThemeProvider>
  );

describe('ChatWidgetWithKB and the owner\'s help centre (#40)', () => {
  beforeEach(() => (seen.length = 0));

  it('the owner turned it on: the tab, with the bot\'s categories', () => {
    const { getByTestId, getByText } = draw({}, { serverCustomizations: { enableKnowledgeBase: true }, knowledgeBase: KB });
    fireEvent.press(getByTestId('w-tab-kb'));
    expect(getByText('kb:Billing')).toBeTruthy();
  });

  it('the owner turned it off (or never on): no tab', () => {
    expect(draw({}, { serverCustomizations: { enableKnowledgeBase: false }, knowledgeBase: KB }).queryByTestId('w-tab-kb')).toBeNull();
    expect(draw({}, { serverCustomizations: {}, knowledgeBase: KB }).queryByTestId('w-tab-kb')).toBeNull();
    expect(draw({}, { serverCustomizations: null }).queryByTestId('w-tab-kb')).toBeNull();
  });

  it('the prop overrides the owner either way', () => {
    expect(draw({ enableKnowledgeBase: true }, { serverCustomizations: { enableKnowledgeBase: false } }).queryByTestId('w-tab-kb')).toBeTruthy();
    expect(draw({ enableKnowledgeBase: false }, { serverCustomizations: { enableKnowledgeBase: true } }).queryByTestId('w-tab-kb')).toBeNull();
  });

  it('the host\'s categories win over the bot\'s', () => {
    const host = [{ _id: 'h1', name: 'Host topic', articles: [] }];
    const { getByTestId, getByText } = draw({ kbCategories: host }, { serverCustomizations: { enableKnowledgeBase: true }, knowledgeBase: KB });
    fireEvent.press(getByTestId('w-tab-kb'));
    expect(getByText('kb:Host topic')).toBeTruthy();
  });

  it('the header button follows the switch too', () => {
    expect(draw({ kbIntegration: 'header-button' }, { serverCustomizations: { enableKnowledgeBase: true } }).queryByTestId('w-kb-modal')).toBeTruthy();
    expect(draw({ kbIntegration: 'header-button' }, { serverCustomizations: {} }).queryByTestId('w-kb-modal')).toBeNull();
  });
});
