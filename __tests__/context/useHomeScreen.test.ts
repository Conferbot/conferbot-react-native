/**
 * The home screen in the provider (context/hooks/useHomeScreen.ts; web
 * conferbot-widget src/ts/home/firstImpression.ts goToChat,
 * visitorMemory.ts, knowledgeBase/kbContent.ts remoteSearch): the view,
 * what the device remembers, the question asked from the home.
 */
import { act, renderHook } from '@testing-library/react-native';
import { ASK_AFTER_MS, useHomeScreen } from '../../src/context/hooks/useHomeScreen';

const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

const fakeStorage = (initial: Record<string, string> = {}) => {
  const data = { ...initial };
  return {
    data,
    getItem: jest.fn(async (k: string) => data[k] ?? null),
    setItem: jest.fn(async (k: string, v: string) => {
      data[k] = v;
    }),
    removeItem: jest.fn(),
    multiGet: jest.fn(),
    multiSet: jest.fn(),
    multiRemove: jest.fn(),
    getAllKeys: jest.fn(),
  };
};

const KEY = '@conferbot:memory:bot1';
const HOME = { enableInitialPage: true };

const mount = (o: { storage?: any; socket?: any; send?: any; onHomeShown?: any; name?: () => string | undefined } = {}) =>
  renderHook((p: any) =>
    useHomeScreen({
      botId: 'bot1',
      socketClient: { current: o.socket || null },
      customizations: p.c,
      chatSessionId: p.chatSessionId,
      record: p.record,
      visitorName: o.name || (() => undefined),
      storage: o.storage ?? null,
      send: o.send || jest.fn(),
      onHomeShown: o.onHomeShown,
    }),
    { initialProps: { c: HOME, chatSessionId: 's1', record: [] as any[] } }
  );

describe('useHomeScreen', () => {
  it('opens on the home screen only while the owner has one', () => {
    const h = mount();
    expect(h.result.current.view).toBe('home');
    act(() => h.result.current.showChat());
    expect(h.result.current.view).toBe('chat');
    act(() => h.result.current.showHome());
    expect(h.result.current.view).toBe('home');
    // Turned off: the conversation, and Back has nowhere to go.
    h.rerender({ c: { enableInitialPage: false }, chatSessionId: 's1', record: [] });
    expect(h.result.current.view).toBe('chat');
    act(() => h.result.current.showHome());
    expect(h.result.current.view).toBe('chat');
  });

  it('the help centre on a topic, and back to the home when it is off', () => {
    const h = mount();
    act(() => h.result.current.showHelp('c1'));
    expect(h.result.current.view).toBe('home');
    expect(h.result.current.helpCategoryId).toBe('c1');
    h.rerender({ c: { ...HOME, enableKnowledgeBase: true }, chatSessionId: 's1', record: [] });
    expect(h.result.current.view).toBe('help');
  });

  it('a question from the home is asked in the chat, after the chat is there', () => {
    jest.useFakeTimers();
    const send = jest.fn(async () => {});
    const h = mount({ send });
    act(() => h.result.current.showChat('  Do you ship abroad?  '));
    expect(h.result.current.view).toBe('chat');
    expect(send).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(ASK_AFTER_MS));
    expect(send).toHaveBeenCalledWith('Do you ship abroad?');
    jest.useRealTimers();
  });

  it('reads the requests again each time the home comes into view', () => {
    const onHomeShown = jest.fn();
    const h = mount({ onHomeShown });
    expect(onHomeShown).toHaveBeenCalledTimes(1);
    act(() => h.result.current.showChat());
    act(() => h.result.current.showHome());
    expect(onHomeShown).toHaveBeenCalledTimes(2);
  });

  it('remembers the first real question and the name on the device, per bot', async () => {
    const storage = fakeStorage();
    let name: string | undefined;
    const h = mount({ storage, name: () => name });
    await act(flush);
    act(() => h.result.current.rememberText('hi'));
    act(() => h.result.current.rememberText('Do you support Shopify stores?'));
    expect(h.result.current.memory).toMatchObject({ topic: 'Do you support Shopify stores?', session: 's1' });
    name = 'jamie lee';
    h.rerender({ c: HOME, chatSessionId: 's1', record: [{ type: 'user-message' }] });
    expect(h.result.current.memory!.name).toBe('Jamie');
    expect(JSON.parse(storage.data[KEY])).toMatchObject({ name: 'Jamie', topic: 'Do you support Shopify stores?' });
  });

  it('what the device kept is read back', async () => {
    const at = Date.now() - 3600000;
    const storage = fakeStorage({ [KEY]: JSON.stringify({ at, name: 'Jamie', topic: 'Pricing for teams please', session: 'old' }) });
    const h = mount({ storage });
    await act(flush);
    expect(h.result.current.memory).toEqual({ at, name: 'Jamie', topic: 'Pricing for teams please', session: 'old' });
  });

  it('keeps the help centre from the bot data', () => {
    const h = mount();
    act(() => h.result.current.setKnowledgeBase({ categories: [{ _id: 'c1' }], recentArticles: 'nope' }));
    expect(h.result.current.knowledgeBase).toEqual({ categories: [{ _id: 'c1' }], recentArticles: [] });
  });

  it("asks the server for matches inside article text, once per query that answered", async () => {
    const socket = {
      isConnected: () => true,
      emitWithAck: jest.fn(async () => ({ success: true, articles: [{ _id: 'a1', snippet: 'VAT number' }, { snippet: 'no id' }] })),
    };
    const h = mount({ socket });
    let hits: any;
    await act(async () => {
      hits = await h.result.current.searchArticleText('VAT number');
    });
    expect(hits).toEqual([{ _id: 'a1', snippet: 'VAT number' }]);
    expect(socket.emitWithAck).toHaveBeenCalledWith('search-kb-articles', { chatbotId: 'bot1', query: 'vat number', limit: 10 }, 5000);
    await act(async () => {
      await h.result.current.searchArticleText('vat number');
    });
    expect(socket.emitWithAck).toHaveBeenCalledTimes(1);
    expect(await h.result.current.searchArticleText('x')).toEqual([]);
  });
});
