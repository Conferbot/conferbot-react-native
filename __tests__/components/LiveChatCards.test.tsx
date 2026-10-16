/**
 * The live chat cards and lines (components/LiveChat/LiveChatCards.tsx),
 * rendered against a stub provider value.
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';
import ConferBotContext from '../../src/context/ConferBotContext';
import { ThemeProvider } from '../../src/theme';
import {
  ClosedChatCard,
  CsatCard,
  EmailTranscriptCard,
  FileRequestCard,
  HandoverWaitingCard,
  LeadCard,
  LeaveMessageCard,
  QueueCard,
  QuickActionsStrip,
} from '../../src/components/LiveChat/LiveChatCards';

const withContext = (ui: React.ReactElement, value: any) =>
  render(
    <ThemeProvider>
      <ConferBotContext.Provider value={value}>{ui}</ConferBotContext.Provider>
    </ThemeProvider>
  );

const AI_ANSWER = [{ _id: 'a1', type: 'agent-message', agentDetails: { isAIAgent: true } }];

describe('LiveChatCards', () => {
  it('shows the owner quick actions and Talk to a person', () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as any);
    const trackGoal = jest.fn();
    const sendMessage = jest.fn();
    const { getByText } = withContext(<QuickActionsStrip offerHuman />, {
      serverCustomizations: { chatQuickActions: [{ label: 'Book a demo', url: 'https://x.co/demo' }], chatTalkToHuman: true },
      record: AI_ANSWER,
      trackGoal,
      sendMessage,
    });
    fireEvent.press(getByText(/Book a demo/));
    expect(openURL).toHaveBeenCalledWith('https://x.co/demo');
    expect(trackGoal).toHaveBeenCalledWith('quick-action:Book a demo', expect.any(String));
    fireEvent.press(getByText('Talk to a person'));
    expect(sendMessage).toHaveBeenCalledWith("I'd like to talk to a person, please.");
  });

  it('hides Talk to a person unless the owner turned it on', () => {
    const { queryByText } = withContext(<QuickActionsStrip offerHuman />, { serverCustomizations: {}, record: AI_ANSWER });
    expect(queryByText('Talk to a person')).toBeNull();
  });

  it('shows quick actions only from the first AI answer; the owner\'s links stay with a person', () => {
    const serverCustomizations = { chatQuickActions: [{ label: 'Pricing', url: 'https://x.co/p' }], chatTalkToHuman: true };
    expect(withContext(<QuickActionsStrip offerHuman />, { serverCustomizations, record: [] }).queryByText(/Pricing/)).toBeNull();
    // A person is here (offerHuman false): the links stay, Talk to a person goes.
    const withPerson = withContext(<QuickActionsStrip offerHuman={false} />, { serverCustomizations, record: AI_ANSWER });
    expect(withPerson.queryByText(/Pricing/)).toBeTruthy();
    expect(withPerson.queryByText('Talk to a person')).toBeNull();
    expect(withContext(<QuickActionsStrip offerHuman />, { serverCustomizations, record: AI_ANSWER }).queryByText(/Pricing/)).toBeTruthy();
  });

  it('Talk to a person goes on tap and never comes back on the strip (#30)', () => {
    const value = { serverCustomizations: { chatTalkToHuman: true }, record: AI_ANSWER, sendMessage: jest.fn() };
    const view = withContext(<QuickActionsStrip offerHuman />, value);
    fireEvent.press(view.getByText('Talk to a person'));
    expect(value.sendMessage).toHaveBeenCalledTimes(1);
    expect(view.queryByText('Talk to a person')).toBeNull();

    // Taken off while connecting: an AI reply mid-handover cannot bring it back.
    const rerendered = withContext(<QuickActionsStrip offerHuman />, value);
    expect(rerendered.getByText('Talk to a person')).toBeTruthy();
    const wrap = (offer: boolean) => (
      <ThemeProvider>
        <ConferBotContext.Provider value={value as any}>
          <QuickActionsStrip offerHuman={offer} />
        </ConferBotContext.Provider>
      </ThemeProvider>
    );
    rerendered.rerender(wrap(false));
    expect(rerendered.queryByText('Talk to a person')).toBeNull();
    rerendered.rerender(wrap(true));
    expect(rerendered.queryByText('Talk to a person')).toBeNull();
  });

  it('shows the queue line, not while the handover step shows it', () => {
    const queue = { status: 'waiting', position: 2, ahead: 1, agentsOnline: 1, estimateLabel: '3 min' };
    const a = withContext(<QueueCard />, { queue });
    expect(a.getByText("You're 2nd in line")).toBeTruthy();
    expect(a.getByText('3 min')).toBeTruthy();
    const b = withContext(<QueueCard />, { queue, currentUIState: { type: 'humanHandover' } });
    expect(b.queryByText("You're 2nd in line")).toBeNull();
  });

  it('asks for an email when nobody could join', async () => {
    const shareEmailForReply = jest.fn().mockResolvedValue(true);
    const { getByText, getByPlaceholderText } = withContext(<HandoverWaitingCard />, {
      handoverWaiting: { offline: false, reason: 'busy', backAt: null, askEmail: true, email: null },
      shareEmailForReply,
    });
    expect(getByText(/Everyone's busy right now/)).toBeTruthy();
    fireEvent.changeText(getByPlaceholderText('you@example.com'), 'not-an-email');
    fireEvent.press(getByText('Send'));
    expect(getByText('Please enter a valid email.')).toBeTruthy();
    fireEvent.changeText(getByPlaceholderText('you@example.com'), 'jo@example.com');
    fireEvent.press(getByText('Send'));
    await waitFor(() => expect(getByText(/They'll reply to jo@example.com/)).toBeTruthy());
    expect(shareEmailForReply).toHaveBeenCalledWith('jo@example.com');
  });

  it('leaves a message when no one is available', async () => {
    const leaveMessage = jest.fn().mockResolvedValue(true);
    const { getByText, getByPlaceholderText } = withContext(<LeaveMessageCard />, { noAgentsAvailable: true, leaveMessage });
    fireEvent.changeText(getByPlaceholderText('How can we help?'), 'Need a quote');
    fireEvent.changeText(getByPlaceholderText('you@example.com'), 'jo@example.com');
    fireEvent.press(getByText('Send'));
    await waitFor(() => expect(leaveMessage).toHaveBeenCalledWith('jo@example.com', 'Need a quote'));
    // Sent: the hook keeps where, and the card says so.
    const sent = withContext(<LeaveMessageCard />, { noAgentsAvailable: false, leftMessageTo: 'jo@example.com' });
    expect(sent.getByText("Message sent. We'll reply to you at jo@example.com.")).toBeTruthy();
  });

  it('does not offer leave a message when the owner turned it off', () => {
    const { queryByText } = withContext(<LeaveMessageCard />, { noAgentsAvailable: true, serverCustomizations: { chatLeaveMessage: false } });
    expect(queryByText('Leave a message')).toBeNull();
  });

  it('keeps the lead email', () => {
    const captureLeadEmail = jest.fn();
    const { getByText, getByPlaceholderText } = withContext(<LeadCard />, { leadCardOpen: true, captureLeadEmail });
    expect(getByText('Want us to follow up?')).toBeTruthy();
    fireEvent.changeText(getByPlaceholderText('you@example.com'), 'jo@example.com');
    fireEvent.press(getByText('Send'));
    expect(captureLeadEmail).toHaveBeenCalledWith('jo@example.com');
    const done = withContext(<LeadCard />, { leadCardOpen: false, leadEmail: 'jo@example.com' });
    expect(done.getByText("Thanks! We'll follow up at jo@example.com")).toBeTruthy();
  });

  it('offers an upload when an agent asks for a file', () => {
    const onUpload = jest.fn();
    const { getByText } = withContext(<FileRequestCard onUpload={onUpload} />, { fileRequestedBy: 'Sam' });
    expect(getByText('Sam asked you to send a file')).toBeTruthy();
    fireEvent.press(getByText('Choose a file'));
    expect(onUpload).toHaveBeenCalled();
  });

  it('rates the chat with stars and feedback', () => {
    const submitRating = jest.fn();
    const csatConfig = {
      ratingType: 'stars',
      titleText: 'How was your experience?',
      subtitleText: 'Your feedback helps us improve',
      thankYouText: 'Thank you for your feedback!',
      showFeedbackInput: true,
      feedbackPlaceholder: 'Tell us more...',
    };
    const { getByText, getByLabelText, getByPlaceholderText } = withContext(<CsatCard />, { csatConfig, csatOpen: true, submitRating, dismissCsat: jest.fn() });
    fireEvent.press(getByLabelText('4 out of 5'));
    fireEvent.changeText(getByPlaceholderText('Tell us more...'), 'Quick help');
    fireEvent.press(getByText('Send'));
    expect(submitRating).toHaveBeenCalledWith(4, 'Quick help');
    const thanked = withContext(<CsatCard />, { csatConfig, csatOpen: true, csatSent: true });
    expect(thanked.getByText('Thank you for your feedback!')).toBeTruthy();
  });

  it('shows no rating card when the chat has not ended', () => {
    const { queryByText } = withContext(<CsatCard />, { csatConfig: { ratingType: 'thumbs', titleText: 'T' }, csatOpen: false });
    expect(queryByText('T')).toBeNull();
  });

  it('Email me this chat: checks the address, sends, says where it went (#46)', async () => {
    const emailTranscript = jest.fn().mockResolvedValue({ ok: true });
    const value: any = {
      emailTranscriptOpen: true,
      emailTranscriptSentTo: null,
      emailTranscript,
      closeEmailTranscript: jest.fn(),
      chatState: { getUserMetadata: () => ({ email: 'ada@example.com' }), getAnswerVariables: () => [] },
    };
    const { getByTestId, getByText, rerender } = withContext(<EmailTranscriptCard />, value);
    expect(getByText("We'll send the whole conversation to your inbox.")).toBeTruthy();
    // The known email is filled in.
    expect(getByTestId('cb-mailchat-email').props.value).toBe('ada@example.com');
    fireEvent.changeText(getByTestId('cb-mailchat-email'), 'nope');
    fireEvent.press(getByTestId('cb-mailchat-send'));
    expect(getByText('Please check the email address.')).toBeTruthy();
    expect(emailTranscript).not.toHaveBeenCalled();
    fireEvent.changeText(getByTestId('cb-mailchat-email'), 'sam@example.com');
    fireEvent.press(getByTestId('cb-mailchat-send'));
    await waitFor(() => expect(emailTranscript).toHaveBeenCalledWith('sam@example.com'));
    fireEvent.press(getByTestId('cb-mailchat-cancel'));
    expect(value.closeEmailTranscript).toHaveBeenCalled();
    rerender(
      <ThemeProvider>
        <ConferBotContext.Provider value={{ ...value, emailTranscriptOpen: false, emailTranscriptSentTo: 'sam@example.com' }}>
          <EmailTranscriptCard />
        </ConferBotContext.Provider>
      </ThemeProvider>
    );
    expect(getByText('Sent! Check your inbox at sam@example.com')).toBeTruthy();
  });

  it("Email me this chat: the server's reason when it did not go (#46)", async () => {
    const emailTranscript = jest.fn().mockResolvedValue({ ok: false, message: 'Too many requests. Please try again later.' });
    const { getByTestId, findByText } = withContext(<EmailTranscriptCard />, {
      emailTranscriptOpen: true,
      emailTranscript,
      closeEmailTranscript: jest.fn(),
    });
    fireEvent.changeText(getByTestId('cb-mailchat-email'), 'sam@example.com');
    fireEvent.press(getByTestId('cb-mailchat-send'));
    expect(await findByText('Too many requests. Please try again later.')).toBeTruthy();
  });

  it('the closed chat: blocked has its line and no new chat; ended offers one (#47)', () => {
    const blocked = withContext(<ClosedChatCard closed={{ kind: 'blocked', text: 'This conversation has been closed.', newChat: false, inputOff: true }} onNewChat={jest.fn()} />, {});
    expect(blocked.getByText('This conversation has been closed.')).toBeTruthy();
    expect(blocked.queryByTestId('cb-new-chat')).toBeNull();
    const onNewChat = jest.fn();
    const ended = withContext(<ClosedChatCard closed={{ kind: 'ended', text: 'Chat ended', newChat: true, inputOff: true }} onNewChat={onNewChat} />, {});
    fireEvent.press(ended.getByText('Start a new chat'));
    expect(onNewChat).toHaveBeenCalled();
    expect(withContext(<ClosedChatCard closed={null} />, {}).toJSON()).toBeNull();
  });
});
