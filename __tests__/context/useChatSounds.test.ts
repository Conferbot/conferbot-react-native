/**
 * The chat's sounds wired (context/hooks/useChatSounds.ts; web
 * ts/chat/messageSound.ts, index.ts _playToggleSound).
 */
import { renderHook, act } from '@testing-library/react-native';

jest.mock('../../src/utils/chatSounds', () => ({ playCue: jest.fn().mockResolvedValue(true), canPlaySounds: () => true }));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { playCue } = require('../../src/utils/chatSounds');
import { useChatSounds } from '../../src/context/hooks/useChatSounds';

const memory = (initial: Record<string, string> = {}) => {
  const data = { ...initial };
  return {
    data,
    getItem: jest.fn(async (k: string) => data[k] ?? null),
    setItem: jest.fn(async (k: string, v: string) => {
      data[k] = v;
    }),
    removeItem: jest.fn(async (k: string) => {
      delete data[k];
    }),
  };
};

const bot = (id: string) => ({ _id: id, type: 'bot-message', text: id });

const setup = (customizations: any, storage = memory()) => {
  const props = { customizations, record: [] as any[], isOpen: false, isRestoring: false, storage };
  const hook = renderHook((p: any) => useChatSounds(p), { initialProps: props });
  return { hook, props, storage };
};

describe('useChatSounds', () => {
  beforeEach(() => (playCue as jest.Mock).mockClear());

  it('plays the message sound when a bot message arrives', async () => {
    const { hook, props } = setup({ messageSound: 'pop' });
    await act(async () => undefined);
    hook.rerender({ ...props, record: [bot('a')] });
    expect(playCue).toHaveBeenCalledWith(expect.objectContaining({ kind: 'tone', key: 'message.pop' }));
    (playCue as jest.Mock).mockClear();
    // Within 800 ms: once.
    hook.rerender({ ...props, record: [bot('a'), bot('b')] });
    expect(playCue).not.toHaveBeenCalled();
  });

  it('plays the launcher file on open and close; a pack plays its own', async () => {
    const file = { enableWidgetToggleSound: true, checkedSoundTab: 'choose', widgetToggleSound: 'https://cdn.conferbot.com/sounds/sound-2.mp3' };
    const { hook, props } = setup(file);
    await act(async () => undefined);
    hook.rerender({ ...props, isOpen: true });
    hook.rerender({ ...props, isOpen: false });
    expect((playCue as jest.Mock).mock.calls.map((c) => c[0])).toEqual([
      { kind: 'url', url: file.widgetToggleSound },
      { kind: 'url', url: file.widgetToggleSound },
    ]);
    (playCue as jest.Mock).mockClear();
    const pack = setup({ ...file, soundPack: 'retro' });
    await act(async () => undefined);
    pack.hook.rerender({ ...pack.props, isOpen: true });
    expect(playCue).toHaveBeenCalledWith(expect.objectContaining({ key: 'retro.open' }));
    expect(pack.hook.result.current.playSendSound()).toBe(true);
  });

  it('keeps quiet once the visitor turned sounds off, and remembers it', async () => {
    const { hook, props, storage } = setup({ messageSound: 'chime' });
    await act(async () => undefined);
    expect(hook.result.current.hasSounds).toBe(true);
    act(() => hook.result.current.toggleSound());
    expect(hook.result.current.soundOn).toBe(false);
    expect(storage.data['conferbot-sound-enabled']).toBe('false');
    hook.rerender({ ...props, record: [bot('a')] });
    expect(playCue).not.toHaveBeenCalled();

    const again = setup({ messageSound: 'chime' }, memory({ 'conferbot-sound-enabled': 'false' }));
    await act(async () => undefined);
    expect(again.hook.result.current.soundOn).toBe(false);
  });

  it('is silent for a bot without sounds, and for a restored conversation', async () => {
    const none = setup({});
    await act(async () => undefined);
    expect(none.hook.result.current.hasSounds).toBe(false);
    none.hook.rerender({ ...none.props, record: [bot('a')], isOpen: true });
    expect(playCue).not.toHaveBeenCalled();
    const restored = setup({ messageSound: 'pop' });
    await act(async () => undefined);
    restored.hook.rerender({ ...restored.props, record: [bot('a')], isRestoring: true });
    expect(playCue).not.toHaveBeenCalled();
  });
});
