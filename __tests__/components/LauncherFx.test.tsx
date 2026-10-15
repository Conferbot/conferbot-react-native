import React from 'react';
import { act, render } from '@testing-library/react-native';

jest.mock('react-native-svg', () => ({ SvgXml: 'SvgXml', __esModule: true, default: 'Svg', Path: 'Path', Circle: 'Circle', Ellipse: 'Ellipse', Rect: 'Rect', G: 'G' }));

let customizations: Record<string, any> = {};
jest.mock('../../src/context/ConferBotContext', () => ({
  useConferBot: () => ({ serverCustomizations: customizations, unreadCount: 0, botId: 'fx-bot' }),
}));
jest.mock('../../src/components/ChatWidget/ChatWidget', () => ({ ChatWidget: () => null }));

// eslint-disable-next-line import/first
import { ConferBotWidget } from '../../src/components/FloatingWidget/ConferBotWidget';

const layout = (tree: ReturnType<typeof render>) => {
  const host = tree.UNSAFE_root.findAll((n: any) => typeof n.props?.onLayout === 'function' && n.type === 'AnimatedView')[0];
  act(() => host.props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 50, height: 50 } } }));
};

// The shared react-native mock has no AccessibilityInfo or AppState.currentState.
const RN = require('react-native');
RN.AccessibilityInfo = { isReduceMotionEnabled: () => Promise.resolve(false), addEventListener: () => ({ remove: () => {} }) };
RN.AppState.currentState = 'active';

describe('the launcher with an entrance, attention and idle call', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('plays the entrance, then the attention loop and the idle call, without errors', async () => {
    customizations = { launcherEntrance: 'confetti', launcherAttention: 'orbit', launcherIdleCall: 'wave', launcherIdleCallDelay: 5, widgetIconSVG: 'WidgetBubbleIcon1' };
    const tree = render(<ConferBotWidget />);
    layout(tree);
    act(() => {
      jest.advanceTimersByTime(100);
    });
    // The confetti and the launcher's stage are drawn.
    expect(tree.UNSAFE_root.findAll((n: any) => n.type === 'AnimatedView').length).toBeGreaterThan(30);
    // The pacing is read from storage first.
    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      jest.advanceTimersByTime(6000);
    });
    // The mascot and its bubble.
    expect(tree.UNSAFE_root.findAll((n: any) => n.type === 'Text' && n.props.children === 'Hi there!').length).toBe(1);
    tree.unmount();
  });

  it('draws every entrance and idle call', () => {
    for (const [e, i] of [
      ['lightning', 'psst'],
      ['rocket', 'peek'],
      ['portal', 'knock'],
      ['ufo', 'tap'],
      ['drop', 'wave'],
      ['coin', 'psst'],
      ['meteor', 'peek'],
      ['magic', 'knock'],
      ['parachute', 'tap'],
      ['plane', 'wave'],
      ['egg', 'psst'],
    ]) {
      customizations = { launcherEntrance: e, launcherAttention: 'bounce', launcherIdleCall: i, launcherIdleCallDelay: 5 };
      const tree = render(<ConferBotWidget />);
      layout(tree);
      act(() => {
        jest.advanceTimersByTime(7000);
      });
      tree.unmount();
    }
  });
});
