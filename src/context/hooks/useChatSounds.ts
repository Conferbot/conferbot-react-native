/**
 * The chat's sounds (core/messageSound.ts; web ts/chat/messageSound.ts and
 * index.ts _playToggleSound): a message arriving, the chat opening and
 * closing, the visitor sending, under the owner's messageSound, soundPack
 * and launcher sound, and the visitor's Sound on / off kept on the device
 * under the web's key. Played by utils/chatSounds.ts (expo-av when the app
 * has it).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  SOUND_ENABLED_KEY,
  createSoundGate,
  cueFor,
  hasAnySound,
  messageArrived,
  rowIds,
  soundEnabledFrom,
  type SoundEvent,
} from '../../core/messageSound';
import { playCue } from '../../utils/chatSounds';
import type { AsyncStorageInterface } from '../../services/StorageService';

interface Params {
  customizations: any;
  record: any[];
  isOpen: boolean;
  isRestoring?: boolean;
  storage: AsyncStorageInterface | null;
}

export function useChatSounds({ customizations, record, isOpen, isRestoring, storage }: Params) {
  const [soundOn, setSoundOn] = useState(true);
  const soundOnRef = useRef(true);
  const gate = useRef(createSoundGate()).current;
  const cz = useRef(customizations);
  cz.current = customizations;

  // The visitor's switch, as they left it (blocked storage reads as on).
  useEffect(() => {
    let live = true;
    Promise.resolve(storage?.getItem(SOUND_ENABLED_KEY))
      .then((v) => {
        if (!live) return;
        soundOnRef.current = soundEnabledFrom(v);
        setSoundOn(soundOnRef.current);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [storage]);

  const play = useCallback((event: SoundEvent): boolean => {
    if (!soundOnRef.current) return false;
    const cue = cueFor(cz.current, event);
    if (!cue || !gate.allow(cz.current, event, Date.now())) return false;
    playCue(cue);
    return true;
  }, []);

  const toggleSound = useCallback(() => {
    const next = !soundOnRef.current;
    soundOnRef.current = next;
    setSoundOn(next);
    Promise.resolve(storage?.setItem(SOUND_ENABLED_KEY, String(next))).catch(() => undefined);
  }, [storage]);

  // A message arrived (a bot step, a person's or the AI's message).
  const seen = useRef<Set<string>>(new Set());
  useEffect(() => {
    const arrived = !isRestoring && messageArrived(seen.current, record);
    seen.current = rowIds(record);
    if (arrived) play('message');
  }, [record, isRestoring, play]);

  // Opening and closing (the launcher sound, or the pack's open / close).
  const wasOpen = useRef(isOpen);
  useEffect(() => {
    if (wasOpen.current === isOpen) return;
    wasOpen.current = isOpen;
    play(isOpen ? 'open' : 'close');
  }, [isOpen, play]);

  return {
    soundOn,
    toggleSound,
    /** The visitor sent from the composer (a pack's send sound). */
    playSendSound: () => play('send'),
    /** The chat menu offers Sound on / off only when the bot has a sound. */
    hasSounds: hasAnySound(customizations),
  };
}
