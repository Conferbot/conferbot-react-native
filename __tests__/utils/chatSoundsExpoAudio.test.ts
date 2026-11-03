/**
 * Chat sounds on Expo SDK 55+, where expo-av is gone: utils/chatSounds.ts
 * falls back to expo-audio's createAudioPlayer, keeps expo-av when present,
 * and stays silent (with one dev warning) when neither is installed.
 */
const loadWith = (av: any, audio: any) => {
  jest.resetModules();
  jest.doMock('../../src/optional/expoAv', () => ({ loadExpoAv: () => av }));
  jest.doMock('../../src/optional/expoAudio', () => ({ loadExpoAudio: () => audio }));
  jest.doMock('../../src/optional/expoFileSystemLegacy', () => ({ loadExpoFileSystemLegacy: () => null }));
  jest.doMock('../../src/optional/expoFileSystem', () => ({ loadExpoFileSystem: () => null }));
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../../src/utils/chatSounds');
};

const fakeAudio = () => {
  const listeners: Record<string, (s: any) => void> = {};
  const player = {
    volume: 0.5,
    play: jest.fn(),
    remove: jest.fn(),
    addListener: jest.fn((evt: string, fn: (s: any) => void) => {
      listeners[evt] = fn;
    }),
  };
  return { mod: { createAudioPlayer: jest.fn(() => player) }, player, listeners };
};

const url = { kind: 'url', url: 'https://cdn.conferbot.com/sounds/sound-2.mp3' };

describe('chat sounds without expo-av', () => {
  it('plays through expo-audio and releases the player when done', async () => {
    const a = fakeAudio();
    const sounds = loadWith(null, a.mod);
    expect(sounds.canPlaySounds()).toBe(true);
    await expect(sounds.playCue(url)).resolves.toBe(true);
    expect(a.mod.createAudioPlayer).toHaveBeenCalledWith({ uri: url.url });
    expect(a.player.play).toHaveBeenCalled();
    expect(a.player.volume).toBe(1);
    a.listeners.playbackStatusUpdate({ didJustFinish: true });
    expect(a.player.remove).toHaveBeenCalled();
  });

  it('plays synthesised tones through expo-audio too', async () => {
    const a = fakeAudio();
    const sounds = loadWith(null, a.mod);
    const ok = await sounds.playCue({ kind: 'tone', key: 'message.pop', steps: [{ at: 0, from: 520, to: 880, dur: 0.09, type: 'sine', gain: 0.18 }] });
    expect(ok).toBe(true);
    expect((a.mod.createAudioPlayer.mock.calls[0] as any[])[0].uri).toMatch(/^data:audio\/wav;base64,/);
  });

  it('keeps expo-av when both are installed', async () => {
    const a = fakeAudio();
    const sound = { setOnPlaybackStatusUpdate: jest.fn(), unloadAsync: jest.fn() };
    const av = { Audio: { Sound: { createAsync: jest.fn().mockResolvedValue({ sound }) } } };
    const sounds = loadWith(av, a.mod);
    await expect(sounds.playCue(url)).resolves.toBe(true);
    expect(av.Audio.Sound.createAsync).toHaveBeenCalled();
    expect(a.mod.createAudioPlayer).not.toHaveBeenCalled();
  });

  it('is silent without either, and warns once in development', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const sounds = loadWith(null, null);
    expect(sounds.canPlaySounds()).toBe(false);
    await expect(sounds.playCue(url)).resolves.toBe(false);
    await sounds.playCue(url);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toMatch(/install expo-audio/);
    warn.mockRestore();
  });
});
