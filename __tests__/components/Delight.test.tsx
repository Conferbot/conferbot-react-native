/**
 * The human touches, the calendar's taken slots, the wait card's usual
 * wait and the composer's draft, drawn (components/Delight/Delight.tsx,
 * MessageBubble, RatingComponents, AdvancedComponents CalendarPicker,
 * LiveChatCards, ChatBottomBar).
 */
import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import ConferBotContext from '../../src/context/ConferBotContext';
import { ThemeProvider } from '../../src/theme';
import { MessageBubble } from '../../src/components/MessageBubble/MessageBubble';
import { StarRating } from '../../src/components/NodeComponents/RatingComponents';
import { CalendarPicker } from '../../src/components/NodeComponents/AdvancedComponents';
import { HandoverWaitCard, QueueCard } from '../../src/components/LiveChat/LiveChatCards';
import { ChatBottomBar } from '../../src/components/ChatBottomBar/ChatBottomBar';
import { StallHint } from '../../src/components/Delight/Delight';
import { t } from '../../src/core/i18n';

const withContext = (ui: React.ReactElement, value: any) =>
  render(
    <ThemeProvider>
      <ConferBotContext.Provider value={value}>{ui}</ConferBotContext.Provider>
    </ThemeProvider>
  );

const answer = { _id: 'u1', type: 'user-message', text: 'Jamie', time: new Date().toISOString() } as any;

describe('the human touches, drawn', () => {
  it('puts the bot\'s tapback on the answer, with its words for a screen reader', () => {
    const { getByTestId, getByLabelText } = withContext(<MessageBubble message={answer} testID="m" />, {
      answerTouches: { u1: { reaction: '👋' } },
    });
    expect(getByTestId('m-tapback')).toBeTruthy();
    expect(getByLabelText('The bot waved')).toBeTruthy();
  });

  it('bursts confetti for a celebration and says when it is done', () => {
    const clearAnswerTouch = jest.fn();
    const { getByTestId } = withContext(<MessageBubble message={answer} testID="m" />, {
      answerTouches: { u1: { reaction: '🎉', celebrate: 1 } },
      clearAnswerTouch,
    });
    expect(getByTestId('m-confetti')).toBeTruthy();
    act(() => jest.advanceTimersByTime(1600));
    expect(clearAnswerTouch).toHaveBeenCalledWith('u1');
  });

  it('shows "Edit" under the latest answer only, and goes back on a tap', () => {
    const changeAnswer = jest.fn();
    const a = withContext(<MessageBubble message={answer} testID="m" />, { changeAnswerRowId: 'u1', changeAnswer });
    fireEvent.press(a.getByLabelText('Change your answer'));
    expect(changeAnswer).toHaveBeenCalled();
    expect(a.getByText('Edit')).toBeTruthy();
    const b = withContext(<MessageBubble message={answer} testID="m" />, { changeAnswerRowId: 'other', changeAnswer });
    expect(b.queryByText('Edit')).toBeNull();
  });

  it('draws the nudge as a quiet line', () => {
    const { getByText } = withContext(<StallHint text="No rush" accent="#0808EE" muted="#666" />, {});
    expect(getByText('No rush')).toBeTruthy();
  });

  it('sparks on a rating pick and names the pick in words', () => {
    const { getByLabelText, getByTestId, getByText } = withContext(
      <StarRating {...({ type: 'rating', nodeId: 'r', question: 'Rate us', maxRating: 5, labels: ['Awful', 'Poor', 'Okay', 'Good', 'Great'] } as any)} onSubmit={jest.fn()} testID="rate" />,
      {}
    );
    fireEvent.press(getByLabelText('Rate 5 out of 5'));
    expect(getByTestId('rate-sparks')).toBeTruthy();
    expect(getByText('Great')).toBeTruthy();
  });
});

describe('the calendar\'s taken slots', () => {
  it('shows a booked time greyed out, not pickable', () => {
    const today = new Date();
    const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const onSubmit = jest.fn();
    const { getAllByText, getByTestId, getByLabelText } = withContext(
      <CalendarPicker
        {...({ type: 'calendar', nodeId: 'cal', question: 'Book', mode: 'datetime', showTimeSlots: true, availableSlots: [{ date: key, times: ['09:00', '09:30'], booked: ['09:00'] }] } as any)}
        onSubmit={onSubmit}
      />,
      {}
    );
    const day = getAllByText(String(today.getDate())).pop()!;
    fireEvent.press(day);
    expect(getByTestId('cb-calendar-slot-09:00').props.accessibilityState).toMatchObject({ disabled: true });
    expect(getByLabelText('09:00, booked')).toBeTruthy();
    expect(getByTestId('cb-calendar-slot-09:30').props.accessibilityState).toMatchObject({ disabled: false });
  });
});

describe('the wait card\'s usual wait', () => {
  const queue = { status: 'waiting', position: 2, ahead: 1, agentsOnline: 1, estimateLabel: null, estimateBucket: null, typical: { bucket: 'few_minutes' } };

  it('says the team\'s usual wait when there is no live estimate', () => {
    const { getByText } = withContext(<HandoverWaitCard />, { queue, serverCustomizations: { replyTime: { mode: 'auto', bucket: 'few_hours' } } });
    expect(getByText('Typical wait: a few minutes')).toBeTruthy();
  });

  it('words the live estimate in the visitor\'s language, the usual wait under it', () => {
    const live = { ...queue, estimateLabel: '2 min', estimateBucket: 'about_2' };
    const { getByText, getByTestId } = withContext(<QueueCard />, { queue: live, serverCustomizations: {} });
    expect(getByText('About 2 min')).toBeTruthy();
    expect(getByTestId('cb-wait-typical')).toBeTruthy();
  });

  it('keeps quiet about it when the owner hid the reply time', () => {
    const { queryByText, getByText } = withContext(<HandoverWaitCard />, { queue, serverCustomizations: { replyTime: { mode: 'hide' } } });
    expect(queryByText(/Typical wait/)).toBeNull();
    expect(getByText(t('queue.soon'))).toBeTruthy();
  });
});

describe('the composer\'s draft', () => {
  it('reports each change, and "" once sent', async () => {
    const onDraft = jest.fn();
    const onSend = jest.fn().mockResolvedValue(undefined);
    const { getByTestId } = withContext(<ChatBottomBar onSend={onSend} onDraft={onDraft} testID="bar" />, {});
    fireEvent.changeText(getByTestId('bar-input'), 'Hel');
    expect(onDraft).toHaveBeenLastCalledWith('Hel');
    await act(async () => {
      fireEvent(getByTestId('bar-input'), 'submitEditing');
    });
    expect(onSend).toHaveBeenCalledWith('Hel');
    expect(onDraft).toHaveBeenLastCalledWith('');
  });
});
