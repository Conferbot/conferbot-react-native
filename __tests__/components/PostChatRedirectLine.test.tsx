/**
 * The post-chat redirect's line (LiveChatCards PostChatRedirectLine; web
 * .cb-redirect): the countdown with Cancel, said once to a screen reader,
 * "Taking you to…" once it opened, and "Continue to" when the system could
 * not open it.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import ConferBotContext from '../../src/context/ConferBotContext';
import { ThemeProvider } from '../../src/theme';
import { PostChatRedirectLine } from '../../src/components/LiveChat/LiveChatCards';

const line = (over: any = {}) => ({
  href: 'https://example.com/',
  host: 'example.com',
  phase: 'counting',
  secondsLeft: 7,
  text: 'Taking you to example.com in 7s',
  said: 'Taking you to example.com in 10s',
  cancelText: 'Cancel',
  cancelLabel: 'Cancel going to example.com',
  ...over,
});

const withContext = (value: any) =>
  render(
    <ThemeProvider>
      <ConferBotContext.Provider value={value}>
        <PostChatRedirectLine />
      </ConferBotContext.Provider>
    </ThemeProvider>
  );

describe('PostChatRedirectLine (#74)', () => {
  it('the countdown and Cancel', () => {
    const cancel = jest.fn();
    const { getByTestId } = withContext({ postChatRedirect: line(), cancelPostChatRedirect: cancel });
    expect(getByTestId('cb-redirect-text', { includeHiddenElements: true }).props.children).toBe('Taking you to example.com in 7s');
    // The ticking text is hidden from screen readers; the sentence is said once.
    expect(getByTestId('cb-redirect-text', { includeHiddenElements: true }).props.accessibilityElementsHidden).toBe(true);
    expect(getByTestId('cb-redirect-cancel').props.accessibilityLabel).toBe('Cancel going to example.com');
    fireEvent.press(getByTestId('cb-redirect-cancel'));
    expect(cancel).toHaveBeenCalled();
  });

  it('no Cancel once it opened', () => {
    const { queryByTestId, getByTestId } = withContext({ postChatRedirect: line({ phase: 'going', text: 'Taking you to example.com…' }) });
    expect(getByTestId('cb-redirect-text', { includeHiddenElements: true }).props.children).toBe('Taking you to example.com…');
    expect(queryByTestId('cb-redirect-cancel')).toBeNull();
  });

  it('a Continue button when the system could not open it', () => {
    const go = jest.fn();
    const { getByTestId, getByText } = withContext({ postChatRedirect: line({ phase: 'continue', text: 'Continue to example.com' }), continuePostChatRedirect: go });
    expect(getByText('Continue to example.com')).toBeTruthy();
    fireEvent.press(getByTestId('cb-redirect-go'));
    expect(go).toHaveBeenCalled();
  });

  it('nothing without a line', () => {
    const { queryByTestId } = withContext({ postChatRedirect: null });
    expect(queryByTestId('cb-redirect')).toBeNull();
  });
});
