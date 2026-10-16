/**
 * An AI reply's help-article sources and the agent's article card open the
 * article in the app (AgentReplyExtras, RichAgentMessage; core/agentBot.ts
 * sourceTarget / richArticleTarget), as the web widget's agentSources.ts
 * and agentRich.ts (#49).
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Linking } from 'react-native';
import ConferBotContext from '../../src/context/ConferBotContext';
import { ThemeProvider } from '../../src/theme';
import { AgentReplyExtras, RichAgentMessage } from '../../src/components/AgentReply';

const ID = '0123456789abcdef01234567';
const ART = '64b7f0c2a1b2c3d4e5f60718';
const KB_ON = { enableKnowledgeBase: true };

const withContext = (ui: React.ReactElement, value: any) =>
  render(
    <ThemeProvider>
      <ConferBotContext.Provider value={{ record: [], ...value }}>{ui}</ConferBotContext.Provider>
    </ThemeProvider>
  );

const answer = (sources: any[]) => ({ _id: ID, type: 'agent-message', text: 'Yes.', agentDetails: { isAIAgent: true }, sources });

describe('help articles from the AI (#49)', () => {
  afterEach(() => jest.restoreAllMocks());

  it('a source with an articleId opens the article in the app', () => {
    const openArticle = jest.fn();
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as any);
    const { getByTestId, getByText } = withContext(<AgentReplyExtras message={answer([{ title: 'Refunds', articleId: ART }])} testID="x" />, {
      serverCustomizations: KB_ON,
      openArticle,
    });
    expect(getByText('Help article ›')).toBeTruthy();
    fireEvent.press(getByTestId('x-source-0'));
    expect(openArticle).toHaveBeenCalledWith(ART);
    expect(openURL).not.toHaveBeenCalled();
  });

  it('help centre off: its public page if it has one, else not tappable', () => {
    const openArticle = jest.fn();
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as any);
    const msg = answer([
      { title: 'Refunds', articleId: ART, url: 'https://help.example.com/refunds' },
      { title: 'Shipping', articleId: '64b7f0c2a1b2c3d4e5f60719' },
    ]);
    const { getByTestId } = withContext(<AgentReplyExtras message={msg} testID="x" />, { serverCustomizations: {}, openArticle });
    fireEvent.press(getByTestId('x-source-0'));
    expect(openURL).toHaveBeenCalledWith('https://help.example.com/refunds');
    fireEvent.press(getByTestId('x-source-1'));
    expect(openURL).toHaveBeenCalledTimes(1);
    expect(openArticle).not.toHaveBeenCalled();
  });

  it('a page source opens in the browser', () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as any);
    const { getByTestId } = withContext(<AgentReplyExtras message={answer([{ title: 'Pricing', url: 'https://example.com/pricing' }])} testID="x" />, {
      serverCustomizations: KB_ON,
      openArticle: jest.fn(),
    });
    fireEvent.press(getByTestId('x-source-0'));
    expect(openURL).toHaveBeenCalledWith('https://example.com/pricing');
  });

  it('the article card without a public page opens in the app', () => {
    const openArticle = jest.fn();
    const msg = { _id: 'r1', type: 'agent-message-rich', rich: { kind: 'article', articleId: ART, title: 'Refunds', snippet: 'How refunds work', url: null }, agentDetails: { name: 'AI' } };
    const { getByTestId } = withContext(<RichAgentMessage message={msg} testID="r" />, { serverCustomizations: KB_ON, openArticle });
    fireEvent.press(getByTestId('r-article'));
    expect(openArticle).toHaveBeenCalledWith(ART);
  });

  it('the article card with a public page opens it', () => {
    const openArticle = jest.fn();
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as any);
    const msg = { _id: 'r2', type: 'agent-message-rich', rich: { kind: 'article', articleId: ART, title: 'Refunds', url: 'https://help.example.com/refunds' }, agentDetails: { name: 'AI' } };
    const { getByTestId } = withContext(<RichAgentMessage message={msg} testID="r" />, { serverCustomizations: KB_ON, openArticle });
    fireEvent.press(getByTestId('r-article'));
    expect(openURL).toHaveBeenCalledWith('https://help.example.com/refunds');
    expect(openArticle).not.toHaveBeenCalled();
  });
});
