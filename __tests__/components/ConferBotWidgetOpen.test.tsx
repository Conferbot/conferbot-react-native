/**
 * The floating widget follows the provider's open state (#79): openChat()
 * (a push tap) opens its chat, closeChat() closes it, and its own launcher
 * and close button go through openChat / closeChat. Outside a provider it
 * keeps its own state.
 */
import React from 'react';
import { act, render } from '@testing-library/react-native';

jest.mock('react-native-svg', () => ({ SvgXml: 'SvgXml', __esModule: true, default: 'Svg', Path: 'Path', Circle: 'Circle', Ellipse: 'Ellipse', Rect: 'Rect', G: 'G' }));

let ctx: any = null;
jest.mock('../../src/context/ConferBotContext', () => ({
  useConferBot: () => {
    if (!ctx) throw new Error('no provider');
    return ctx;
  },
}));
const chatProps: any[] = [];
jest.mock('../../src/components/ChatWidget/ChatWidget', () => ({
  ChatWidget: (props: any) => {
    chatProps.push(props);
    return null;
  },
}));

// eslint-disable-next-line import/first
import { ConferBotWidget } from '../../src/components/FloatingWidget/ConferBotWidget';

const RN = require('react-native');
RN.AccessibilityInfo = { isReduceMotionEnabled: () => Promise.resolve(false), addEventListener: () => ({ remove: () => {} }) };
RN.AppState.currentState = 'active';

const visible = () => chatProps[chatProps.length - 1]?.visible;
const launcher = (tree: ReturnType<typeof render>) =>
  tree.UNSAFE_root.findAll((n: any) => typeof n.props?.onPress === 'function' && n.props?.accessibilityRole === 'button').pop();

describe('ConferBotWidget open state', () => {
  beforeEach(() => {
    chatProps.length = 0;
    jest.useFakeTimers();
  });
  afterEach(() => jest.useRealTimers());

  it("opens and closes with the provider's openChat / closeChat", () => {
    const calls: string[] = [];
    ctx = { isOpen: false, openChat: () => calls.push('open'), closeChat: () => calls.push('close'), serverCustomizations: {}, unreadCount: 0, botId: 'b' };
    const tree = render(<ConferBotWidget />);
    expect(visible()).toBe(false);

    // A push tap: handlePushNotification calls openChat(), the provider opens.
    ctx = { ...ctx, isOpen: true };
    tree.rerender(<ConferBotWidget />);
    expect(visible()).toBe(true);

    // Its close button goes through closeChat.
    act(() => chatProps[chatProps.length - 1].onClose());
    expect(calls).toEqual(['close']);

    ctx = { ...ctx, isOpen: false };
    tree.rerender(<ConferBotWidget />);
    expect(visible()).toBe(false);

    // The launcher asks the provider to open.
    act(() => launcher(tree)?.props.onPress());
    expect(calls).toEqual(['close', 'open']);
    tree.unmount();
  });

  it('keeps its own state outside a provider', () => {
    ctx = null;
    const tree = render(<ConferBotWidget />);
    expect(visible()).toBe(false);
    act(() => launcher(tree)?.props.onPress());
    expect(visible()).toBe(true);
    act(() => chatProps[chatProps.length - 1].onClose());
    expect(visible()).toBe(false);
    tree.unmount();
  });
});
