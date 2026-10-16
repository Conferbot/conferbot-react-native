import React from 'react';
import { act, render } from '@testing-library/react-native';

jest.mock('react-native-svg', () => ({ SvgXml: 'SvgXml', __esModule: true, default: 'Svg', Svg: 'Svg', Path: 'Path', Circle: 'Circle', Ellipse: 'Ellipse', Rect: 'Rect', G: 'G' }));

let customizations: Record<string, any> = {};
let unread = 0;
jest.mock('../../src/context/ConferBotContext', () => ({
  useConferBot: () => ({ serverCustomizations: customizations, unreadCount: unread, botId: 'mascot-bot' }),
}));
jest.mock('../../src/components/ChatWidget/ChatWidget', () => ({ ChatWidget: () => null }));

// eslint-disable-next-line import/first
import { ConferBotWidget } from '../../src/components/FloatingWidget/ConferBotWidget';
// eslint-disable-next-line import/first
import { GreetingCard } from '../../src/components/FloatingWidget/GreetingCard';
// eslint-disable-next-line import/first
import { TypingIndicator } from '../../src/components/TypingIndicator';
// eslint-disable-next-line import/first
import { Mascot } from '../../src/components/Mascot';

// The shared react-native mock has no AccessibilityInfo or AppState.currentState.
const RN = require('react-native');
RN.AccessibilityInfo = { isReduceMotionEnabled: () => Promise.resolve(false), addEventListener: () => ({ remove: () => {} }) };
RN.AppState.currentState = 'active';
RN.AppState.addEventListener = RN.AppState.addEventListener || (() => ({ remove: () => {} }));

const settle = async () => {
  for (let i = 0; i < 4; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      await Promise.resolve();
    });
  }
};
const svgs = (tree: ReturnType<typeof render>) => tree.UNSAFE_root.findAll((n: any) => n.type === 'SvgXml').map((n: any) => String(n.props.xml));

describe('the mascot launcher style', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('draws the owner\'s mascot on a soft light button, and cheers when a reply lands', () => {
    customizations = { launcherStyle: 'mascot', mascotShape: 'fox', mascotAccessory: 'crown', mascotLauncherScale: 130, widgetIconBgColor: '#123456' };
    unread = 0;
    const tree = render(<ConferBotWidget />);
    expect(tree.getByTestId('cb-launcher-mascot')).toBeTruthy();
    const xml = svgs(tree);
    // The light button, then the fox's layers in the launcher colour, its crown on top.
    expect(xml.some((x) => x.includes('radialGradient id="g"'))).toBe(true);
    expect(xml.some((x) => x.includes('#facc15'))).toBe(true);
    expect(xml.some((x) => x.includes('viewBox="4 0 92 96"'))).toBe(true);
    // A reply while closed: the big smile for a moment.
    unread = 1;
    tree.rerender(<ConferBotWidget />);
    act(() => {
      jest.advanceTimersByTime(10);
    });
    const grins = () => svgs(tree).filter((x) => x.includes('#fb7185') && x.includes('Q50 84 60 70 Z')).length;
    expect(grins()).toBe(1);
    act(() => {
      jest.advanceTimersByTime(2600);
    });
    expect(grins()).toBe(0);
    tree.unmount();
  });

  it('falls back to the icon with an uploaded image', () => {
    customizations = { launcherStyle: 'mascot', widgetIconType: 'Image', widgetIconImage: 'https://x/y.png' };
    const tree = render(<ConferBotWidget />);
    expect(tree.queryByTestId('cb-launcher-mascot')).toBeNull();
    tree.unmount();
  });
});

describe('the greeting card with the mascot', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const base = {
    style: 'card' as const,
    text: 'Hi there, how can we help you today?',
    head: { avatar: null, name: 'Pip', online: true },
    starters: [],
    bubble: { bg: '#4f46e5', tail: '#4f46e5', fg: '#ffffff' },
    accent: '#4f46e5',
    font: null,
    firstShow: true,
    onPress: () => {},
    onClose: () => {},
    onStarter: () => {},
  };

  it('greets with the mascot, its words fading up, and leaves when asked', async () => {
    const gone = jest.fn();
    const tree = render(<GreetingCard {...base} mascot={{ look: { shape: 'owl', eyes: 'happy', accessory: 'none', color: '', name: 'Pip' }, accent: '#4f46e5' }} motion="lively" />);
    await settle();
    expect(tree.getByTestId('cb-greet-mascot')).toBeTruthy();
    expect(tree.getByText('Pip')).toBeTruthy();
    // Each word its own text (the lively word fade).
    const texts = tree.UNSAFE_root.findAll((n: any) => typeof n.props?.children === 'string').map((n: any) => n.props.children);
    expect(texts).toEqual(expect.arrayContaining(['Hi ', 'help ', 'today?']));
    act(() => {
      jest.advanceTimersByTime(30000);
    });
    tree.rerender(<GreetingCard {...base} mascot={{ look: { shape: 'owl', eyes: 'happy', accessory: 'none', color: '', name: 'Pip' }, accent: '#4f46e5' }} motion="lively" leaving="open" onGone={gone} />);
    act(() => {
      jest.advanceTimersByTime(400);
    });
    expect(gone).toHaveBeenCalledTimes(1);
    tree.unmount();
  });

  it('off: the plain text and no word fade; still leaves', async () => {
    const gone = jest.fn();
    const tree = render(<GreetingCard {...base} motion="off" />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(tree.getByText(base.text)).toBeTruthy();
    tree.rerender(<GreetingCard {...base} motion="off" leaving="close" onGone={gone} />);
    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(gone).toHaveBeenCalledTimes(1);
    tree.unmount();
  });
});

describe('the mascot and pencil typing styles', () => {
  it('draws the mascot swaying by its thought dots, "Pip is typing"', () => {
    const tree = render(<TypingIndicator isTyping variant="mascot" mascot={{ look: { shape: 'robot', name: 'Pip' }, accent: '#4f46e5' }} />);
    expect(tree.getByLabelText('Pip is typing')).toBeTruthy();
    expect(svgs(tree).some((x) => x.includes('viewBox="4 0 92 96"'))).toBe(true);
    tree.unmount();
  });

  it('draws the pencil writing its line', () => {
    const tree = render(<TypingIndicator isTyping variant="pencil" accent="#ff0000" />);
    expect(tree.UNSAFE_root.findAll((n: any) => n.props?.d === 'M2 11 C 6 5, 9 5, 11 10 S 16 14, 19 9 S 25 4, 27 10 S 33 13, 36 8').length).toBeGreaterThan(0);
    expect(svgs(tree).some((x) => x.includes('#ff0000'))).toBe(true);
    tree.unmount();
  });
});

describe('<Mascot> for an app\'s own screens', () => {
  it('draws every mood', () => {
    for (const mood of ['idle', 'wave', 'think', 'happy'] as const) {
      const tree = render(<Mascot look={{ shape: 'heart' }} accent="#e11d48" mood={mood} />);
      expect(tree.getByTestId('cb-mascot')).toBeTruthy();
      tree.unmount();
    }
  });
});
