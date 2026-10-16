/**
 * "Helpful?" under an AI answer (AgentReplyExtras, core/answerFeedback.ts):
 * a No goes at once, then reasons, a comment, Talk to a person, Ask another
 * way, and the vote can change.
 */
import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import ConferBotContext from '../../src/context/ConferBotContext';
import { ThemeProvider } from '../../src/theme';
import { AgentReplyExtras } from '../../src/components/AgentReply';

const ID = '0123456789abcdef01234567';
const ANSWER = { _id: ID, type: 'agent-message', text: 'Our plans start at $9.', agentDetails: { isAIAgent: true, name: 'AI' } };

const renderWith = (message: any, value: any) =>
  render(
    <ThemeProvider>
      <ConferBotContext.Provider value={{ serverCustomizations: {}, record: [message], ...value }}>
        <AgentReplyExtras message={message} />
      </ConferBotContext.Provider>
    </ThemeProvider>
  );

describe('Helpful? under an AI answer', () => {
  it('sends a No at once, then the reason and the comment', () => {
    const send = jest.fn();
    const { getByTestId, getByText, queryByTestId } = renderWith(ANSWER, { sendAnswerFeedback: send, sendMessage: jest.fn() });
    fireEvent.press(getByTestId('cb-helpful-down'));
    expect(send).toHaveBeenLastCalledWith(ID, { helpful: false });
    expect(getByText('Sorry about that. What went wrong?')).toBeTruthy();
    // No comment field until a reason is picked.
    expect(queryByTestId('cb-helpful-comment')).toBeNull();
    fireEvent.press(getByTestId('cb-helpful-reason-outdated'));
    expect(send).toHaveBeenLastCalledWith(ID, { helpful: false, reason: 'outdated' });
    fireEvent.changeText(getByTestId('cb-helpful-comment'), 'Prices changed');
    fireEvent.press(getByTestId('cb-helpful-send'));
    expect(send).toHaveBeenLastCalledWith(ID, { helpful: false, reason: 'outdated', comment: 'Prices changed' });
    expect(getByText('Thanks, that helps us improve.')).toBeTruthy();
    expect(send).toHaveBeenCalledTimes(3);
  });

  it('Talk to a person asks for one; Ask another way settles the row', () => {
    const sendMessage = jest.fn();
    const first = renderWith(ANSWER, { sendAnswerFeedback: jest.fn(), sendMessage });
    fireEvent.press(first.getByTestId('cb-helpful-down'));
    fireEvent.press(first.getByTestId('cb-helpful-human'));
    expect(sendMessage).toHaveBeenCalledWith("I'd like to talk to a person, please.");
    expect(first.getByTestId('cb-helpful-rated')).toBeTruthy();

    const second = renderWith(ANSWER, { sendAnswerFeedback: jest.fn(), sendMessage });
    fireEvent.press(second.getByTestId('cb-helpful-down'));
    fireEvent.press(second.getByTestId('cb-helpful-retry'));
    expect(second.getByText('Not helpful')).toBeTruthy();
  });

  it('no Talk to a person while a person is coming', () => {
    const record = [{ _id: 'l1', type: 'agent-left-chat', handover: true }, ANSWER];
    const { getByTestId, queryByTestId } = render(
      <ThemeProvider>
        <ConferBotContext.Provider value={{ serverCustomizations: {}, record, sendAnswerFeedback: jest.fn(), sendMessage: jest.fn() }}>
          <AgentReplyExtras message={ANSWER} />
        </ConferBotContext.Provider>
      </ThemeProvider>
    );
    fireEvent.press(getByTestId('cb-helpful-down'));
    expect(queryByTestId('cb-helpful-human')).toBeNull();
  });

  it('Yes thanks, settles, and the vote can change', () => {
    jest.useFakeTimers();
    const send = jest.fn();
    const { getByTestId, getByText } = renderWith(ANSWER, { sendAnswerFeedback: send });
    fireEvent.press(getByTestId('cb-helpful-up'));
    expect(send).toHaveBeenLastCalledWith(ID, { helpful: true });
    expect(getByText('Thanks for letting us know!')).toBeTruthy();
    act(() => {
      jest.advanceTimersByTime(1900);
    });
    expect(getByText('Helpful')).toBeTruthy();
    fireEvent.press(getByTestId('cb-helpful-down'));
    expect(send).toHaveBeenLastCalledWith(ID, { helpful: false });
    jest.useRealTimers();
  });

  it('a rated answer draws its vote; an older unrated one steps aside', () => {
    const rated = renderWith({ ...ANSWER, feedback: { helpful: false, reason: 'wrong' } }, { sendAnswerFeedback: jest.fn() });
    expect(rated.getByText('Not helpful · Wrong')).toBeTruthy();

    const newer = { ...ANSWER, _id: 'ffffffffffffffffffffffff' };
    const { queryByTestId } = render(
      <ThemeProvider>
        <ConferBotContext.Provider value={{ serverCustomizations: {}, record: [ANSWER, newer], sendAnswerFeedback: jest.fn() }}>
          <AgentReplyExtras message={ANSWER} />
        </ConferBotContext.Provider>
      </ThemeProvider>
    );
    expect(queryByTestId('cb-helpful-ask')).toBeNull();
  });

  it('none for a fallback reply or with Helpful turned off', () => {
    expect(renderWith({ ...ANSWER, isFallback: true }, { sendAnswerFeedback: jest.fn() }).queryByTestId('cb-helpful-ask')).toBeNull();
    expect(
      renderWith(ANSWER, { sendAnswerFeedback: jest.fn(), serverCustomizations: { hideAnswerFeedback: true } }).queryByTestId('cb-helpful-ask')
    ).toBeNull();
  });
});
