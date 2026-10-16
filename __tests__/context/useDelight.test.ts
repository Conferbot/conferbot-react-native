/**
 * The human touches wired (context/hooks/useDelight.ts; web
 * ts/chat/delight/index.ts): the tapback 550 ms after an answer, the burst,
 * "Edit" 900 ms after the bot goes quiet, the nudge, and the cut "Edit"
 * makes in the conversation.
 */
import { renderHook, act } from '@testing-library/react-native';
import { useDelight, cutIndexFor } from '../../src/context/hooks/useDelight';
import { STALL_AFTER_MS, STALL_QUIET_MS } from '../../src/core/delight';

const now = () => new Date().toISOString();
const question = { _id: 'b1', type: 'bot-message', text: 'Your name?', nodeId: 'q1', time: now() };
const answer = (extra: any = {}) => ({ _id: 'u1', type: 'user-message', text: 'Jamie', answerOf: { nodeId: 'q1', type: 'ask-name-node', text: 'Jamie' }, time: now(), ...extra });

const engineWith = (points: any[], typesSince: string[] = []) => ({
  current: {
    questionPoints: () => points,
    typesSince: () => typesSince,
    rewindTo: jest.fn().mockResolvedValue(true),
    getChatState: () => ({ isFlowComplete: false }),
  },
});

const setup = (over: any = {}) => {
  const setRecord = jest.fn();
  const props = {
    customizations: {},
    record: [question],
    setRecord,
    flowEngine: engineWith([{ id: 7, nodeId: 'q1', type: 'ask-name-node' }]),
    currentUIState: null,
    isNodeProcessing: false,
    chatVisible: true,
    locked: false,
    ...over,
  };
  const hook = renderHook((p: any) => useDelight(p), { initialProps: props });
  return { hook, props, setRecord };
};

describe('useDelight', () => {
  it('waves at a name 550 ms after it lands, not for what was on screen before', () => {
    const { hook, props } = setup({ record: [question, answer({ _id: 'old' })] });
    act(() => jest.advanceTimersByTime(600));
    expect(hook.result.current.touches.old).toBeUndefined();
    hook.rerender({ ...props, record: [question, answer({ _id: 'old' }), answer()] });
    act(() => jest.advanceTimersByTime(549));
    expect(hook.result.current.touches.u1).toBeUndefined();
    act(() => jest.advanceTimersByTime(1));
    expect(hook.result.current.touches.u1).toEqual({ reaction: '👋', celebrate: undefined });
  });

  it('celebrates a booking, and says nothing when the owner turned both off', () => {
    const booked = answer({ _id: 'u2', text: 'Tue 10:00', answerOf: { nodeId: 'cal', type: 'calendar-node', text: '' } });
    const { hook, props } = setup();
    hook.rerender({ ...props, record: [question, booked] });
    act(() => jest.advanceTimersByTime(600));
    expect(hook.result.current.touches.u2.reaction).toBe('🎉');
    expect(typeof hook.result.current.touches.u2.celebrate).toBe('number');

    const off = setup({ customizations: { botReactions: false, celebrations: false } });
    off.hook.rerender({ ...off.props, record: [question, booked] });
    act(() => jest.advanceTimersByTime(600));
    expect(off.hook.result.current.touches.u2).toBeUndefined();
  });

  it('offers "Edit" on the latest answer once the bot is quiet, and goes back on a tap', () => {
    const { hook, props, setRecord } = setup();
    const record = [{ _id: 'w', type: 'bot-message', text: 'Hi' }, question, answer(), { _id: 'b2', type: 'bot-message', text: 'Thanks', nodeId: 'm' }];
    hook.rerender({ ...props, record });
    act(() => jest.advanceTimersByTime(899));
    expect(hook.result.current.changeRowId).toBeNull();
    act(() => jest.advanceTimersByTime(1));
    expect(hook.result.current.changeRowId).toBe('u1');
    act(() => hook.result.current.changeAnswer());
    // The question's own bubble and everything after it fold away; the engine asks it again.
    expect(setRecord.mock.calls[0][0](record)).toEqual([record[0]]);
    expect(props.flowEngine.current.rewindTo).toHaveBeenCalledWith(7);
  });

  it('hides "Edit" while the bot replies, when locked, after an irreversible step, or when off', () => {
    const record = [question, answer()];
    for (const over of [
      { isNodeProcessing: true },
      { locked: true },
      { flowEngine: engineWith([{ id: 7, nodeId: 'q1', type: 'ask-name-node' }], ['payment-node']) },
      { customizations: { allowChangeAnswer: false } },
    ]) {
      const { hook, props } = setup(over);
      hook.rerender({ ...props, record });
      act(() => jest.advanceTimersByTime(1000));
      expect(hook.result.current.changeRowId).toBeNull();
    }
  });

  it('nudges a question that waited 40 s, and stops at the answer', () => {
    const ui = { type: 'buttons', nodeId: 'q1', stepType: 'n-choices-node' };
    const { hook, props } = setup();
    act(() => jest.advanceTimersByTime(STALL_QUIET_MS));
    hook.rerender({ ...props, currentUIState: ui });
    act(() => jest.advanceTimersByTime(STALL_AFTER_MS));
    expect(hook.result.current.stallHint).toBe("No rush - pick whichever fits when you're ready.");
    hook.rerender({ ...props, currentUIState: ui, record: [question, answer()] });
    expect(hook.result.current.stallHint).toBeNull();
  });

  it('does not nudge when the owner turned it off, or while something is typed', () => {
    const ui = { type: 'textInput', nodeId: 'q1', stepType: 'ask-name-node' };
    const off = setup({ customizations: { stallNudges: false } });
    off.hook.rerender({ ...off.props, currentUIState: ui });
    act(() => jest.advanceTimersByTime(STALL_AFTER_MS * 3));
    expect(off.hook.result.current.stallHint).toBeNull();

    const typing = setup();
    act(() => jest.advanceTimersByTime(STALL_QUIET_MS));
    typing.hook.rerender({ ...typing.props, currentUIState: ui });
    act(() => typing.hook.result.current.setComposerValue('Ja'));
    act(() => jest.advanceTimersByTime(STALL_AFTER_MS + STALL_QUIET_MS * 2));
    expect(typing.hook.result.current.stallHint).toBeNull();
  });

  it('cuts at the question\'s own rows above the answer', () => {
    const rows = [
      { _id: 'a', type: 'bot-message', nodeId: 'w' },
      { _id: 'b', type: 'bot-message', nodeId: 'q' },
      { _id: 'c', type: 'bot-message', shape: 'bot-choice-buttons', nodeId: 'q', choiceUI: { nodeId: 'q' } },
      { _id: 'd', type: 'user-message' },
    ];
    expect(cutIndexFor(rows, 3, 'q')).toBe(1);
    expect(cutIndexFor(rows, 3, 'zz')).toBe(3);
  });
});
