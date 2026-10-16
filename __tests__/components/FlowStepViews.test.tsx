/**
 * The flow steps' own cards (src/components/NodeComponents/steps/*), drawn
 * through NodeRenderer as the chat draws them. Every visitor action of the
 * shared flow fixtures for those steps is played on the card itself - the
 * box ticked, the row moved, the digits typed, the result tapped, Sign
 * pressed - and the answer the card sends goes to the real engine. The
 * whole outcome must still be the web's: the answer accepted (or refused
 * with the web's words), the variables saved, the step left by the right
 * port. Actions no card takes (typed text, the driver's waits and server
 * events) are left to the driver.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { runFixture, Fixture, ViewAnswer } from '../parity/flowDriver';
import { compare } from '../parity/flowCompare';
import { NodeRenderer } from '../../src/components/NodeComponents/NodeRenderer';
import {
  stepViewFor,
  consentPieces,
  dragTarget,
  matrixTap,
  resendSecondsLeft,
  signatureSvg,
  strokePath,
  sliderValueAt,
  dateTimeValue,
  paymentTimeLeft,
} from '../../src/components/NodeComponents/steps';
import { startMinutes, timeStepOf } from '../../src/components/NodeComponents/steps/DateTimeStep';
import { ThemeProvider } from '../../src/theme';
import { sliderConfig } from '../../src/core/flow/rich';

jest.mock('react-native-svg', () => ({ __esModule: true, default: 'Svg', Svg: 'Svg', Path: 'Path' }));

const DIR = '../../scripts/parity/flows/fixtures';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const index = require(`${DIR}/index.json`);
// eslint-disable-next-line @typescript-eslint/no-var-requires
const load = (file: string): Fixture => require(`${DIR}/${file}`);

/** The bot's look, as the provider builds it from the customizations. */
const LOOK = { colors: { optionBubble: '#fde68a', optionBubbleText: '#1f2937', primary: '#0808ee', botBubbleText: '#ffffff' }, borderRadius: { button: 6 }, typography: { fontSize: { md: 16 } } };

/** The actions a card answers (everything else is the driver's). */
const VIEW_ACTIONS = new Set([
  'consent',
  'slider',
  'datetime',
  'rankingMove',
  'rankingSubmit',
  'matrix',
  'otpEmail',
  'otpCode',
  'otpSkip',
  'addressSearch',
  'addressPick',
  'addressManual',
  'signEmpty',
  'signTyped',
  'payOpen',
  'payCancel',
]);

interface Mounted {
  nodeId: string;
  ui: any;
  sent: any[];
  api: ReturnType<typeof render>;
  minutes?: number;
}

const tree = (ui: any, sent: any[]) => (
  <ThemeProvider theme={LOOK as any}>
    <NodeRenderer uiState={ui} onSubmit={(r: any) => sent.push(r)} />
  </ThemeProvider>
);

/** The card for the waiting step, drawn once per step and redrawn with each new state. */
const mount = (memo: Record<string, any>, ui: any): Mounted => {
  let v: Mounted | undefined = memo.__view;
  if (!v || v.nodeId !== ui.nodeId) {
    v?.api.unmount();
    const sent: any[] = [];
    v = { nodeId: ui.nodeId, ui, sent, api: render(tree(ui, sent)) };
    memo.__view = v;
  } else if (v.ui !== ui) {
    v.api.rerender(tree(ui, v.sent));
    v.ui = ui;
  }
  return v;
};

const press = (v: Mounted, id: string) => fireEvent.press(v.api.getByTestId(id));
const type = (v: Mounted, id: string, text: string) => fireEvent.changeText(v.api.getByTestId(id), text);
const has = (v: Mounted, id: string) => v.api.queryByTestId(id) !== null;
const checked = (v: Mounted, id: string) => !!v.api.getByTestId(id).props.accessibilityState?.checked;
const selected = (v: Mounted, id: string) => !!v.api.getByTestId(id).props.accessibilityState?.selected;

/** Plays one fixture action on the card; what it sent, or null when no card takes it. */
const onCard = (a: any, ui: any, memo: Record<string, any>, handled: string[]): { response?: any; local?: boolean } | null => {
  const isChoice = a.do === 'choose' && (ui?.type === 'carousel' || ui?.type === 'pictureChoice');
  if (!VIEW_ACTIONS.has(a.do) && !isChoice) return null;
  if (!stepViewFor(ui)) throw new Error(`no card for ${ui?.stepType || ui?.type} (${a.do})`);
  const v = mount(memo, ui);
  const data = ui.stepData || {};
  switch (a.do) {
    case 'choose':
      if (ui.type === 'pictureChoice') press(v, `step-images-choice-${a.id ?? ui.choices[a.index].id}`);
      else if (a.buttonId !== undefined) press(v, `step-cards-button-${a.buttonId}`);
      else press(v, 'step-cards-continue');
      break;
    case 'consent':
      if (checked(v, 'step-consent-box') !== !!a.agreed) press(v, 'step-consent-box');
      press(v, 'step-consent-continue');
      break;
    case 'slider': {
      const cfg = sliderConfig(data);
      const track = v.api.getByTestId('step-slider-track');
      fireEvent(track, 'layout', { nativeEvent: { layout: { width: 500, height: 32 } } });
      fireEvent(track, 'responderGrant', { nativeEvent: { locationX: ((Number(a.value) - cfg.min) / (cfg.max - cfg.min)) * 500 } });
      press(v, 'step-slider-submit');
      break;
    }
    case 'datetime': {
      const s = String(a.value);
      const [day, time] = ui.stepData?.mode === 'time' ? [null, s] : s.split('T');
      if (day) {
        const want = new Date(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, 1);
        const label = `${want.toLocaleString('en-US', { month: 'long' })} ${want.getFullYear()}`;
        for (let i = 0; i < 24 && v.api.getByTestId('step-datetime-month').props.children !== label; i++) {
          press(v, v.api.getByTestId('step-datetime-month').props.children < label ? 'step-datetime-next' : 'step-datetime-prev');
        }
        press(v, `step-datetime-day-${day}`);
      }
      if (time) {
        const now = v.minutes ?? startMinutes(data);
        const target = Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
        const hours = Math.floor(target / 60) - Math.floor(now / 60);
        for (let i = 0; i < Math.abs(hours); i++) press(v, hours > 0 ? 'step-datetime-hour-up' : 'step-datetime-hour-down');
        const mins = ((target % 60) - (now % 60)) / timeStepOf(data);
        for (let i = 0; i < Math.abs(mins); i++) press(v, mins > 0 ? 'step-datetime-minute-up' : 'step-datetime-minute-down');
        v.minutes = target;
      }
      press(v, 'step-datetime-submit');
      break;
    }
    case 'rankingMove':
      press(v, `step-ranking-${Number(a.dir) < 0 ? 'up' : 'down'}-${a.id}`);
      break;
    case 'rankingSubmit':
      press(v, 'step-ranking-submit');
      break;
    case 'matrix':
      for (const [row, cols] of Object.entries(a.cells || {})) {
        for (const col of ([] as any[]).concat(cols)) if (!selected(v, `step-matrix-${row}-${col}`)) press(v, `step-matrix-${row}-${col}`);
      }
      if (a.submit !== false) press(v, 'step-matrix-submit');
      break;
    case 'otpEmail':
      type(v, 'step-otp-email', a.email);
      press(v, 'step-otp-send');
      break;
    case 'otpCode':
      type(v, 'step-otp-code', String(a.code));
      press(v, 'step-otp-verify');
      break;
    case 'otpSkip':
      press(v, 'step-otp-skip');
      break;
    case 'addressSearch':
      type(v, 'step-address-query', a.q);
      fireEvent(v.api.getByTestId('step-address-query'), 'submitEditing');
      break;
    case 'addressPick':
      press(v, `step-address-result-${a.index}`);
      press(v, 'step-address-confirm');
      break;
    case 'addressManual':
      press(v, 'step-address-manual');
      ['line1', 'city', 'region', 'postal', 'country'].forEach((f) => a[f] !== undefined && a[f] !== null && type(v, `step-address-${f}`, String(a[f])));
      press(v, 'step-address-manual-confirm');
      break;
    case 'signEmpty':
      press(v, 'step-signature-sign');
      break;
    case 'signTyped':
      if (!has(v, 'step-signature-typed')) press(v, 'step-signature-mode');
      if (a.fullName !== undefined) type(v, 'step-signature-fullname', a.fullName);
      type(v, 'step-signature-typed', a.name);
      press(v, 'step-signature-sign');
      break;
    case 'payOpen':
      press(v, 'step-payment-open');
      break;
    case 'payCancel':
      press(v, 'step-payment-cancel');
      break;
  }
  handled.push(a.do);
  if (v.sent.length > 1) throw new Error(`${a.do}: the card sent ${v.sent.length} answers`);
  return v.sent.length ? { response: v.sent.shift() } : { local: true };
};

const playOnCards = async (fx: Fixture) => {
  const handled: string[] = [];
  const memo: { cur?: Record<string, any> } = {};
  const answer: ViewAnswer = (a, ui, m) => {
    memo.cur = m;
    return onCard(a, ui, m, handled);
  };
  const result = await runFixture(fx, { answer });
  (memo.cur?.__view as Mounted | undefined)?.api.unmount();
  return { ...result, handled };
};

const all: Fixture[] = index.cases.map((c: any) => load(c.file));
const withCards = all.filter((fx) => (fx.inputs || []).some((a: any) => VIEW_ACTIONS.has(a.do) || (a.do === 'choose' && fx.flow.nodes.some((n: any) => ['carousel-node', 'product-card-node', 'image-choice-node'].includes(n.type)))));

describe('flow step cards answer the fixtures as the web', () => {
  beforeEach(() => (Linking.openURL as jest.Mock).mockClear());

  test.each(withCards.map((fx) => [fx.id, fx] as [string, Fixture]))('%s', async (id: string, fx: Fixture) => {
    const { outcome, problems, handled } = await playOnCards(fx);
    const diffs = [...problems.map((p) => `problem: ${p}`), ...compare(fx, outcome)];
    if (diffs.length) throw new Error(`${id}\n  ${diffs.join('\n  ')}`);
    const expected = (fx.inputs || []).filter((a: any) => VIEW_ACTIONS.has(a.do)).map((a: any) => a.do);
    expect(handled.filter((d) => d !== 'choose')).toEqual(expected);
  });

  it('covers every card', () => {
    const acts = new Set(withCards.flatMap((fx) => (fx.inputs || []).map((a: any) => a.do)));
    VIEW_ACTIONS.forEach((d) => expect(acts.has(d)).toBe(true));
  });
});

describe('the cards themselves', () => {
  const draw = (ui: any) => {
    const sent: any[] = [];
    const api = render(tree(ui, sent));
    return { ...api, sent };
  };

  it('consent: the links are links, they never tick the box', () => {
    const ui = { type: 'buttons', nodeId: 'c', question: '', buttons: [], awaitInput: true, stepType: 'consent-node', stepData: { consentText: 'I agree to the [Terms](https://example.com/terms).' } };
    const v = draw(ui);
    fireEvent.press(v.getByTestId('step-consent-link-1'));
    expect(Linking.openURL).toHaveBeenCalledWith('https://example.com/terms');
    expect(v.getByTestId('step-consent-box').props.accessibilityState.checked).toBe(false);
    fireEvent.press(v.getByTestId('step-consent-box'));
    fireEvent.press(v.getByTestId('step-consent-continue'));
    expect(v.sent).toEqual([{ agreed: true }]);
  });

  it('consent pieces: links, bold, and unsafe links left as text', () => {
    expect(consentPieces('Read **the [Terms](example.com/t)**')).toEqual([{ text: 'Read ' }, { text: 'the ', bold: true }, { text: 'Terms', url: 'https://example.com/t', bold: true }]);
    expect(consentPieces('5 ** 2 is _big_')).toEqual([{ text: '5 ** 2 is big' }]);
    expect(consentPieces('I **agree** to [x](javascript:alert(1))')).toEqual([{ text: 'I ' }, { text: 'agree', bold: true }, { text: ' to ' }, { text: '[x](javascript:alert(1))' }]);
  });

  it('options take the bot colours, radius and font size', () => {
    const ui = { type: 'multipleQuestions', nodeId: 'm', questions: [], stepType: 'matrix-node', stepData: { rows: [{ id: 'r0', text: 'Speed' }], columns: [{ id: 'c0', text: 'Poor' }, { id: 'c1', text: 'Good' }] } };
    const v = draw(ui);
    const cell = v.getByTestId('step-matrix-r0-c0');
    const style = Object.assign({}, ...[].concat(cell.props.style));
    expect(style).toMatchObject({ backgroundColor: '#fde68a', borderRadius: 6 });
    fireEvent.press(cell);
    const picked = Object.assign({}, ...[].concat(v.getByTestId('step-matrix-r0-c0').props.style));
    expect(picked.backgroundColor).toBe('#0808ee');
    const submit = Object.assign({}, ...[].concat(v.getByTestId('step-matrix-submit').props.style));
    expect(submit).toMatchObject({ backgroundColor: '#0808ee', borderRadius: 6 });
  });

  it('matrix: single replaces the row\'s pick, multiple toggles', () => {
    expect(matrixTap(matrixTap({}, 'r0', 'c0', 'single'), 'r0', 'c1', 'single')).toEqual({ r0: ['c1'] });
    expect(matrixTap(matrixTap(matrixTap({}, 'r0', 'c0', 'multiple'), 'r0', 'c1', 'multiple'), 'r0', 'c0', 'multiple')).toEqual({ r0: ['c1'] });
  });

  it('ranking: a drag lands where the finger stops, inside the list', () => {
    expect(dragTarget(0, 95, 46, 3)).toBe(2);
    expect(dragTarget(2, -50, 46, 3)).toBe(1);
    expect(dragTarget(1, 400, 46, 3)).toBe(2);
    expect(dragTarget(1, -400, 46, 3)).toBe(0);
    const ui = { type: 'buttons', nodeId: 'r', question: '', buttons: [], awaitInput: true, items: [{ id: 'a', text: 'Price' }, { id: 'b', text: 'Speed' }, { id: 'c', text: 'Support' }], stepType: 'ranking-node', stepData: {} };
    const v = draw(ui);
    fireEvent(v.getByTestId('step-ranking-row-a'), 'layout', { nativeEvent: { layout: { height: 40 } } });
    const handle = v.getByTestId('step-ranking-handle-a');
    fireEvent(handle, 'responderGrant', { nativeEvent: { pageY: 100 } });
    fireEvent(handle, 'responderMove', { nativeEvent: { pageY: 150 } });
    fireEvent(handle, 'responderRelease', { nativeEvent: { pageY: 192 } });
    fireEvent.press(v.getByTestId('step-ranking-submit'));
    expect(v.sent).toEqual([{ order: ['b', 'c', 'a'] }]);
  });

  it('otp: Resend waits out its time, Change email goes back with the address', () => {
    expect(resendSecondsLeft(1000, 30, 1000)).toBe(30);
    expect(resendSecondsLeft(1000, 30, 21500)).toBe(10);
    expect(resendSecondsLeft(1000, 30, 40000)).toBe(0);
    const ui = { type: 'textInput', nodeId: 'o', stage: 'code', sentTo: 'ana@acme.io', sentAt: Date.now() - 31000, resendIn: 30, allowSkip: true, skipLabel: 'Later', stepType: 'otp-node', stepData: {} };
    const v = draw(ui);
    expect(v.getByText('We sent a 6-digit code to a***@acme.io')).toBeTruthy();
    fireEvent.changeText(v.getByTestId('step-otp-code'), '12 34 56 78');
    fireEvent.press(v.getByTestId('step-otp-verify'));
    fireEvent.press(v.getByTestId('step-otp-resend'));
    fireEvent.press(v.getByTestId('step-otp-skip'));
    expect(v.sent).toEqual([{ action: 'verify', code: '123456' }, { action: 'resend' }, { action: 'skip' }]);
    fireEvent.press(v.getByTestId('step-otp-change'));
    expect(v.getByTestId('step-otp-email').props.value).toBe('ana@acme.io');
    const waiting = draw({ ...ui, nodeId: 'o2', sentAt: Date.now() });
    expect(waiting.getByText('Resend in 0:30')).toBeTruthy();
  });

  it('signature: the strokes go as an SVG image the step uploads', () => {
    expect(strokePath([{ x: 1, y: 2 }])).toBe('M1 2 l0.1 0.1');
    expect(signatureSvg([], 300)).toBeNull();
    const img = signatureSvg([[{ x: 20, y: 30 }, { x: 60, y: 70 }, { x: 120, y: 40 }]], 300)!;
    expect(img.dataUrl.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true);
    expect(decodeURIComponent(img.dataUrl)).toContain('<path d="M20 30');
    const ui = { type: 'textInput', nodeId: 's', stepType: 'signature-node', stepData: { requireName: true } };
    const v = draw(ui);
    const pad = v.getByTestId('step-signature-pad');
    fireEvent(pad, 'layout', { nativeEvent: { layout: { width: 300, height: 140 } } });
    fireEvent(pad, 'responderGrant', { nativeEvent: { locationX: 20, locationY: 30 } });
    fireEvent(pad, 'responderMove', { nativeEvent: { locationX: 80, locationY: 60 } });
    fireEvent(pad, 'responderMove', { nativeEvent: { locationX: 140, locationY: 40 } });
    fireEvent.changeText(v.getByTestId('step-signature-fullname'), '  Ana   Lima ');
    fireEvent.press(v.getByTestId('step-signature-sign'));
    expect(v.sent[0]).toMatchObject({ action: 'sign', method: 'drawn', fullName: 'Ana Lima' });
    expect(v.sent[0].dataUrl).toMatch(/^data:image\/svg\+xml/);
    fireEvent.press(v.getByTestId('step-signature-undo'));
    fireEvent.press(v.getByTestId('step-signature-sign'));
    expect(v.sent[1]).toEqual({ action: 'sign', method: 'drawn', strokes: 0, fullName: 'Ana Lima' });
  });

  it('a drawn signature is accepted, uploaded as SVG and leaves by source', async () => {
    const fx = JSON.parse(JSON.stringify(load('signature.typed.json')));
    fx.inputs = [{ at: 'sg2', do: 'signDrawn' }];
    let body: any = null;
    const answer: ViewAnswer = (a, ui, m) => {
      if (a.do !== 'signDrawn') return null;
      const v = mount(m, ui);
      const pad = v.api.getByTestId('step-signature-pad');
      fireEvent(pad, 'layout', { nativeEvent: { layout: { width: 300, height: 140 } } });
      fireEvent(pad, 'responderGrant', { nativeEvent: { locationX: 10, locationY: 10 } });
      fireEvent(pad, 'responderMove', { nativeEvent: { locationX: 120, locationY: 60 } });
      press(v, 'step-signature-sign');
      body = v.sent[0];
      return { response: v.sent.shift() };
    };
    const { outcome, problems } = await runFixture(fx, { answer });
    expect(problems).toEqual([]);
    expect(body).toMatchObject({ method: 'drawn' });
    expect(outcome.ports).toEqual([{ node: 'sg2', handle: 'source', wired: true }]);
    const signed = outcome.answers.find((x: any) => x.shape === 'user-signature');
    expect(signed).toMatchObject({ method: 'drawn', url: expect.stringMatching(/^https:\/\/api\.test\/media\//) });
  });

  it('slider: a touch along the track snaps to the step; the reader steps it', () => {
    const cfg = { min: 0, max: 50, step: 5 };
    expect(sliderValueAt(230, 500, cfg)).toBe(25);
    expect(sliderValueAt(-10, 500, cfg)).toBe(0);
    expect(sliderValueAt(9999, 500, cfg)).toBe(50);
    const ui = { type: 'slider', nodeId: 's', question: 'Team size?', min: 0, max: 50, stepType: 'slider-node', stepData: { min: 0, max: 50, step: 5, unit: 'people', unitPosition: 'suffix', defaultValue: 10 } };
    const v = draw(ui);
    expect(v.getByTestId('step-slider-value').props.children).toBe('10 people');
    fireEvent(v.getByTestId('step-slider-track'), 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    fireEvent.press(v.getByTestId('step-slider-submit'));
    expect(v.sent).toEqual([{ value: 15 }]);
  });

  it('date / time: the value for each mode', () => {
    expect(dateTimeValue('date', '2026-10-19', 600)).toBe('2026-10-19');
    expect(dateTimeValue('time', null, 14 * 60 + 30)).toBe('14:30');
    expect(dateTimeValue('datetime', '2026-10-19', 9 * 60)).toBe('2026-10-19T09:00');
    expect(dateTimeValue('datetime', null, 9 * 60)).toBe('');
  });

  it('payment: Pay now opens the checkout once and says so; the time left shows', () => {
    expect(paymentTimeLeft(10 * 60000 + 5000, 5000)).toBe('10:00 left');
    expect(paymentTimeLeft(0, 5000)).toBe('');
    const url = 'https://checkout.stripe.com/c/pay/cs_test_1';
    const ui = {
      type: 'buttons',
      nodeId: 'p',
      question: '',
      awaitInput: true,
      checkoutUrl: url,
      expiresAt: Date.now() + 15 * 60000,
      buttons: [
        { id: 'open', label: 'Pay now · $25.00', value: url },
        { id: 'check', label: "I've paid" },
        { id: 'cancel', label: 'Cancel' },
      ],
      stepType: 'payment-node',
      stepData: {},
    };
    const v = draw(ui);
    fireEvent.press(v.getByTestId('step-payment-open'));
    fireEvent.press(v.getByTestId('step-payment-check'));
    expect(Linking.openURL).toHaveBeenCalledTimes(1);
    expect(Linking.openURL).toHaveBeenCalledWith(url);
    expect(v.sent).toEqual([{ action: 'open' }, { action: 'check' }]);
    expect(v.getByText(/^1[45]:\d\d left$/)).toBeTruthy();
  });

  it('cards: a link opens its page and answers nothing; Continue when no card has a path', () => {
    const ui = { type: 'carousel', nodeId: 'k', showContinue: true, cards: [{ id: 'c1', title: 'Read more', buttons: [{ id: 'l1', label: 'Open', url: 'https://example.com' }] }] };
    const v = draw(ui);
    fireEvent.press(v.getByTestId('step-cards-button-l1'));
    expect(Linking.openURL).toHaveBeenCalledWith('https://example.com');
    expect(v.sent).toEqual([]);
    fireEvent.press(v.getByTestId('step-cards-continue'));
    expect(v.sent).toEqual([{ action: 'continue' }]);
  });

  it('image choice: pictures, not text pills', () => {
    const ui = { type: 'pictureChoice', nodeId: 'i', question: '', choices: [{ id: 'i1', imageUrl: 'https://cdn.example/a.png', label: 'Alpha' }] };
    const v = draw(ui);
    expect(v.UNSAFE_getAllByType('Image' as any)[0].props.source).toEqual({ uri: 'https://cdn.example/a.png' });
    fireEvent.press(v.getByTestId('step-images-choice-i1'));
    expect(v.sent).toEqual([{ choiceId: 'i1', label: 'Alpha', value: 'Alpha' }]);
  });

  it('the card stays while its answer is on the way', () => {
    const ui = { type: 'locationPicker', nodeId: 'a', question: '', stepType: 'address-node', stepData: {} };
    const sent: any[] = [];
    const api = render(
      <ThemeProvider>
        <NodeRenderer uiState={ui as any} onSubmit={(r: any) => sent.push(r)} isLoading />
      </ThemeProvider>
    );
    expect(api.getByTestId('step-address-query')).toBeTruthy();
  });
});

