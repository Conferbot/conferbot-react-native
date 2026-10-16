/**
 * "Your requests" screens (components/Requests/RequestsPortal.tsx; web
 * conferbot-widget src/ts/home/requests/view.ts): drawn from the portal
 * controller, taps going back to it.
 */
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { Linking } from 'react-native';
import ConferBotContext from '../../src/context/ConferBotContext';
import { ThemeProvider } from '../../src/theme';
import { RequestsPortal } from '../../src/components/Requests/RequestsPortal';
import { createRequestsPortal } from '../../src/core/requestsPortal';
import type { RequestDetail, RequestSummary } from '../../src/core/requests';

const summary = (o: Partial<RequestSummary> = {}): RequestSummary => ({
  id: 'mobile_1_abcdef',
  title: 'My invoice is wrong',
  status: 'open',
  lastAt: new Date(Date.now() - 2 * 3600000).toISOString(),
  lastFrom: 'team',
  lastText: 'Fixed it',
  teamName: 'Ada',
  ...o,
});
const detail = (o: Partial<RequestDetail> = {}): RequestDetail => ({
  ...summary(),
  messages: [
    { id: 'm1', from: 'you', name: '', text: 'My invoice is wrong', at: null },
    { id: 'm2', from: 'team', name: 'Ada', text: 'Fixed it, see https://example.com/inv', at: null },
  ],
  ...o,
});

const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

const setup = (api: any = {}) => {
  const full = {
    list: jest.fn(async () => [summary(), summary({ id: 'other_123456', title: 'Delivery', lastFrom: 'you' })]),
    open: jest.fn(async () => detail()),
    close: jest.fn(),
    reply: jest.fn(async () => ({ ok: false, reason: 'offline' })),
    onUpdate: jest.fn(() => () => {}),
    ...api,
  };
  const seen: Record<string, number> = {};
  const portal = createRequestsPortal({
    api: full,
    seen: () => seen,
    markSeen: (id, at) => (seen[id] = at),
    isCurrentChat: () => false,
    openChat: jest.fn(),
  });
  const value: any = {
    requestsPortal: portal,
    requests: null,
    requestsUnread: 0,
    openRequests: (id?: string) => (id ? portal.openRequest(id) : portal.openList()),
    closeRequests: portal.close,
    refreshRequests: jest.fn(),
    serverCustomizations: { headerBgColor: '#0808EE' },
    customizations: {},
  };
  const view = render(
    <ThemeProvider>
      <ConferBotContext.Provider value={value}>
        <RequestsPortal />
      </ConferBotContext.Provider>
    </ThemeProvider>
  );
  return { portal, api: full, view };
};

describe('RequestsPortal', () => {
  it('nothing while closed', () => {
    const { view } = setup();
    expect(view.toJSON()).toBeNull();
  });

  it('the list: each request and where it stands; a new reply marked', async () => {
    const { portal, view } = setup();
    await act(async () => {
      await portal.openList();
    });
    expect(view.getByText('Your requests')).toBeTruthy();
    expect(view.getByText('My invoice is wrong')).toBeTruthy();
    expect(view.getByText('New reply from Ada · 2 hours ago')).toBeTruthy();
    expect(view.getByText("We're on it · 2 hours ago")).toBeTruthy();
    expect(view.getByTestId('cb-requests-new-mobile_1_abcdef')).toBeTruthy();
    expect(view.queryByTestId('cb-requests-new-other_123456')).toBeNull();
  });

  it('empty and failed states', async () => {
    const empty = setup({ list: jest.fn(async () => []) });
    await act(async () => {
      await empty.portal.openList();
    });
    expect(empty.view.getByText('Nothing here yet. When you ask us something, you can follow it here.')).toBeTruthy();

    const failed = setup({ list: jest.fn(async () => null) });
    await act(async () => {
      await failed.portal.openList();
    });
    expect(failed.view.getByText("We couldn't load this just now.")).toBeTruthy();
    failed.api.list.mockResolvedValueOnce([]);
    await act(async () => {
      fireEvent.press(failed.view.getByText('Try again'));
      await flush();
    });
    expect(failed.view.getByTestId('cb-requests-empty')).toBeTruthy();
  });

  it('a row opens the request: banner, messages, links; Back to the list, Back again leaves', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as any);
    const { portal, view, api } = setup();
    await act(async () => {
      await portal.openList();
    });
    await act(async () => {
      fireEvent.press(view.getByTestId('cb-requests-row-mobile_1_abcdef'));
      await flush();
    });
    expect(api.open).toHaveBeenCalledWith('mobile_1_abcdef');
    expect(view.getByText('Your request')).toBeTruthy();
    expect(view.getByText('We replied')).toBeTruthy();
    expect(view.getByText('Read it below. If you need anything else, just write back.')).toBeTruthy();
    expect(view.getByText('You')).toBeTruthy();
    expect(view.getByText('Ada')).toBeTruthy();
    fireEvent.press(view.getByText('https://example.com/inv'));
    expect(openURL).toHaveBeenCalledWith('https://example.com/inv');
    await act(async () => {
      fireEvent.press(view.getByTestId('cb-requests-back'));
      await flush();
    });
    expect(api.close).toHaveBeenCalledWith('mobile_1_abcdef');
    expect(view.getByText('Your requests')).toBeTruthy();
    await act(async () => {
      fireEvent.press(view.getByTestId('cb-requests-back'));
    });
    expect(view.toJSON()).toBeNull();
  });

  it('the reply box: Send off while empty; not sent shows Try again; a solved one opens again', async () => {
    const { portal, view, api } = setup({ open: jest.fn(async () => detail({ status: 'solved' })) });
    await act(async () => {
      await portal.openRequest('mobile_1_abcdef');
    });
    expect(view.getByText('Solved')).toBeTruthy();
    const input = view.getByTestId('cb-requests-input');
    expect(input.props.placeholder).toBe('Write here to open it again...');
    expect(view.getByTestId('cb-requests-send').props.accessibilityState.disabled).toBe(true);
    fireEvent.changeText(input, 'Still broken');
    expect(view.getByTestId('cb-requests-send').props.accessibilityState.disabled).toBe(false);
    await act(async () => {
      fireEvent.press(view.getByTestId('cb-requests-send'));
      await flush();
    });
    expect(api.reply).toHaveBeenCalledWith('mobile_1_abcdef', 'Still broken', expect.stringMatching(/^request-reply-/));
    expect(view.getByText('Still broken')).toBeTruthy();
    expect(view.getByTestId('cb-requests-not-sent')).toBeTruthy();
    api.reply.mockResolvedValueOnce({ ok: false, reason: 'locked' });
    await act(async () => {
      fireEvent.press(view.getByTestId('cb-requests-retry'));
      await flush();
    });
    expect(view.getByText('This conversation is closed for replies.')).toBeTruthy();
  });
});
