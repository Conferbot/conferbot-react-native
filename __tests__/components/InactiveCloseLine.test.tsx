/**
 * The AI's inactivity close as a line in the conversation (MessageBubble,
 * core/liveEvents.ts inactiveCloseLine): "Chat paused" with its note, or
 * "Chat ended" (#39).
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { ThemeProvider } from '../../src/theme';
import { MessageBubble } from '../../src/components/MessageBubble';
import { setWidgetLanguage } from '../../src/core/i18n';

const draw = (message: any) =>
  render(
    <ThemeProvider>
      <MessageBubble message={message} />
    </ThemeProvider>
  );

describe('the inactivity line (#39)', () => {
  afterEach(() => setWidgetLanguage('en'));

  it('paused: "Chat paused" and how to pick it back up', () => {
    const { getByText } = draw({ _id: 'x1', type: 'ai-agent-inactive-close', paused: true, time: new Date().toISOString() });
    expect(getByText('Chat paused')).toBeTruthy();
    expect(getByText('Send a message to pick up where you left off')).toBeTruthy();
  });

  it('ended: "Chat ended", no note', () => {
    const { getByText, queryByText } = draw({ _id: 'x2', type: 'ai-agent-inactive-close', paused: false, time: new Date().toISOString() });
    expect(getByText('Chat ended')).toBeTruthy();
    expect(queryByText('Send a message to pick up where you left off')).toBeNull();
  });

  it('a restored entry draws in the visitor\'s language', () => {
    setWidgetLanguage('de');
    const { queryByText } = draw({ _id: 'x3', type: 'ai-agent-inactive-close', paused: true, time: new Date().toISOString() });
    expect(queryByText('Chat paused')).toBeNull();
  });
});
