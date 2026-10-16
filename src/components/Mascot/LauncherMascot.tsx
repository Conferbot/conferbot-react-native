import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import type { MascotLook } from '../../core/mascotArt';
import { MASCOT_CHEER_MS } from '../../core/mascotMoods';
import { MascotFigure, useMascotLayers, type SvgXmlComponent } from './MascotFigure';
import { useMascotMood } from './useMascotMood';

/** The soft light button behind it (launcherStyle.ts): white at 35% 30%, to the launcher colour at 14% on white. */
export const mascotButtonXml = (light: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none"><defs><radialGradient id="g" cx="0.35" cy="0.3" r="0.955"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="${light}"/></radialGradient></defs><rect width="100" height="100" fill="url(#g)"/></svg>`;

/**
 * The "mascot" launcher style (launcherStyle.ts): the owner's mascot, its
 * bust at `scale`% of the button, centred and lifted (translate -50% -56%)
 * so its ears and hat peek over the rim, blinking now and then. A reply
 * landing while the chat is closed makes it hop for joy and smile
 * (cheerLauncherMascot), then it goes back to blinking; a reply mid-hop
 * starts it again. Reduced motion keeps only the smile.
 */
export const LauncherMascot: React.FC<{
  look: MascotLook;
  accent: string;
  scale: number;
  box: { w: number; h: number };
  /** The unread count: a rise while closed is a reply landing. */
  unread: number;
  chatOpen: boolean;
  reduced: boolean;
  Svg: SvgXmlComponent;
}> = ({ look, accent, scale, box, unread, chatOpen, reduced, Svg }) => {
  const n = (Math.min(box.w, box.h) * scale) / 100;
  const layers = useMascotLayers(accent, 'down', look, true);
  const [cheer, setCheer] = useState(0);
  const last = useRef(unread);
  useEffect(() => {
    const rose = unread > last.current;
    last.current = unread;
    if (!rose || chatOpen) return undefined;
    setCheer((k) => k + 1);
    return undefined;
  }, [unread, chatOpen]);
  const [happy, setHappy] = useState(false);
  useEffect(() => {
    if (!cheer) return undefined;
    setHappy(false);
    // A fresh mood (the hop starts again), then back to blinking.
    const on = setTimeout(() => setHappy(true), 0);
    const off = setTimeout(() => setHappy(false), MASCOT_CHEER_MS);
    return () => {
      clearTimeout(on);
      clearTimeout(off);
    };
  }, [cheer]);
  const mood = useMascotMood({ mood: happy ? 'happy' : 'idle', size: n, look, bust: true, reduced, enabled: !chatOpen });
  return (
    <View pointerEvents="none" style={{ width: box.w, height: box.h }} testID="cb-launcher-mascot">
      <View pointerEvents="none" style={{ position: 'absolute', left: box.w / 2 - n / 2, top: box.h / 2 - n * 0.56, width: n, height: n }}>
        <MascotFigure layers={layers} size={n} styles={mood.styles} grin={mood.grin} Svg={Svg} />
      </View>
    </View>
  );
};
