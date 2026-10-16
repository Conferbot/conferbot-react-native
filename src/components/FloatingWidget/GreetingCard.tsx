/**
 * The greeting card by the closed launcher, dressed as the web widget dresses
 * it (conferbot-widget css/polish-home.css .cb-greet and .cb-greet--<style>,
 * ts/home/firstImpression.ts, ts/home/greetingStyle.ts): the plain card, a
 * handwritten note, a phone text (the default), a postcard, a sticky note, a
 * typewriter, glass, a push notification, neon, a voice note or an aurora
 * edge, each with its reveal. Fonts are the platform's nearest ones; glass
 * and the notification are translucent without a live blur.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Image, Platform, Pressable, StyleSheet, Text, View, AccessibilityInfo } from 'react-native';
import type { GreetingStyle } from '../../core/greeting';
import type { MascotLook } from '../../core/mascotArt';
import type { MascotMotion } from '../../core/mascotMotion';
import { MascotFigure, MascotSvg, useMascotLayers } from '../Mascot/MascotFigure';
import { useMascotMood } from '../Mascot/useMascotMood';
import { useGreetingMotion } from '../Mascot/useGreetingMotion';
import { t } from '../../core/i18n';

let SvgXml: React.ComponentType<{ xml: string; width: number | string; height: number | string }> | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  SvgXml = require('react-native-svg').SvgXml;
} catch {
  SvgXml = null;
}

export interface GreetingCardProps {
  style: GreetingStyle;
  text: string;
  head: { avatar: string | null; name: string; online: boolean };
  starters: string[];
  /** The launcher's colours (imessage and voice) and the accent (chips, stamp, glows). */
  bubble: { bg: string | [string, string]; tail: string; fg: string };
  accent: string;
  /** The bot's own font, or null. */
  font: string | null;
  /** The phone text's typing moment plays once per app session. */
  firstShow: boolean;
  onPress: () => void;
  onClose: () => void;
  onStarter: (text: string) => void;
  /** The owner's mascot greets in place of the avatar (mascotInGreeting), in the launcher's colour. */
  mascot?: { look: MascotLook; accent: string } | null;
  /** How the card and its figure move (mascotMotion): lively (default), subtle or off. */
  motion?: MascotMotion;
  /** The launcher under the card (the figure hands off toward it). */
  launcher?: { w: number; h: number; position: 'left' | 'right' } | null;
  /** The card is going: opened from it (or the chat opened) or closed with its x. */
  leaving?: 'open' | 'close';
  /** It has gone (its leaving moves are over). */
  onGone?: () => void;
}

/** The mascot on the card (polish-home.css .cb-greet__mascot): 40 x 40, blinking, waving twice as the card appears. */
const GreetingMascot: React.FC<{ look: MascotLook; accent: string; reduced: boolean }> = ({ look, accent, reduced }) => {
  const layers = useMascotLayers(accent, 'wave', look);
  const mood = useMascotMood({ mood: 'wave', arm: 'wave', waveCount: 2, size: 40, look, reduced });
  return MascotSvg ? <MascotFigure layers={layers} size={40} styles={mood.styles} grin={mood.grin} Svg={MascotSvg} testID="cb-greet-mascot" /> : null;
};

const FONTS = {
  note: Platform.select({ ios: 'Noteworthy-Light', default: 'casual' }),
  sticky: Platform.select({ ios: 'MarkerFelt-Wide', default: 'casual' }),
  serif: Platform.select({ ios: 'Georgia', default: 'serif' }),
  mono: Platform.select({ ios: 'Courier New', default: 'monospace' }),
};

const WIDTH: Record<GreetingStyle, number> = { card: 296, note: 296, imessage: 270, postcard: 296, sticky: 250, typewriter: 296, glass: 296, notification: 300, neon: 296, voice: 280, aurora: 296 };

/** "#rrggbb" + alpha as rgba(). */
const alpha = (hex: string, a: number): string => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

const CLOSE_D = 'm7.314 5.9l3.535-3.536A1 1 0 1 0 9.435.95L5.899 4.485L2.364.95A1 1 0 1 0 .95 2.364l3.535 3.535L.95 9.435a1 1 0 1 0 1.414 1.414l3.535-3.535l3.536 3.535a1 1 0 1 0 1.414-1.414L7.314 5.899z';
const closeXml = (color: string, size: number) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="-6 -6 24 24"><path fill="${color}" d="${CLOSE_D}"/></svg>`;

const VOICE_BARS = [30, 93, 41, 44, 38, 65, 74, 73, 84, 47, 44, 32, 74, 37, 98, 52, 67, 38, 42, 65, 64, 94];

const shadow = (y: number, blur: number, color: string, opacity: number, elevation: number) =>
  Platform.select({
    ios: { shadowColor: color, shadowOffset: { width: 0, height: y }, shadowOpacity: opacity, shadowRadius: blur / 2 },
    default: { elevation },
  });

export const GreetingCard: React.FC<GreetingCardProps> = (p) => {
  const { style, text, head, starters, bubble, accent, font, firstShow, onPress, onClose, onStarter } = p;
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled?.().then((on) => setReduced(!!on)).catch(() => {});
  }, []);

  // ---- The card and its figure alive (core/mascotMotion): the spring or the plain entrance, the figure's moves, the ping, the words, the leaving ----
  const withMascot = !!p.mascot && !!MascotSvg;
  const figureSize = withMascot ? 40 : 32;
  const [cardH, setCardH] = useState(120);
  const width0 = WIDTH[style];
  const gm = useGreetingMotion({
    mode: p.motion || 'lively',
    style,
    text,
    figure: withMascot ? 'mascot' : head.avatar && style !== 'imessage' ? 'avatar' : null,
    figureSize,
    cardSize: { w: width0, h: cardH },
    toward: () => {
      const l = p.launcher;
      if (!l) return undefined;
      // The figure sits at the card's top left (16, 14 in); the launcher 12 below the card, its outer edge in line.
      const fx = 16 + figureSize / 2;
      const fy = 14 + figureSize / 2;
      const lx = l.position === 'right' ? width0 - l.w / 2 : l.w / 2;
      return { x: lx - fx, y: cardH + 12 + l.h / 2 - fy };
    },
    leaving: p.leaving,
    onGone: p.onGone,
  });

  // ---- Entrance: the notification slides down and neon flickers (their own); the rest above ----
  const enter = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (style !== 'neon' && style !== 'notification') return;
    if (style === 'neon') {
      // Hard steps: 0, 1, .3, 1, .55, 1 at 0/90/144/216/270/342ms.
      const steps: [number, number][] = [[90, 1], [54, 0.3], [72, 1], [54, 0.55], [72, 1]];
      Animated.sequence(steps.map(([d, v]) => Animated.timing(enter, { toValue: v, duration: 1, delay: d - 1, useNativeDriver: true }))).start();
      return;
    }
    Animated.timing(enter, {
      toValue: 1,
      duration: style === 'notification' ? 500 : 620,
      easing: style === 'notification' ? Easing.bezier(0.2, 1.2, 0.3, 1) : Easing.bezier(0.2, 0.9, 0.3, 1),
      useNativeDriver: true,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const entranceStyle =
    style === 'neon'
      ? { opacity: enter }
      : style === 'notification'
      ? {
          opacity: enter.interpolate({ inputRange: [0, 0.55, 1], outputRange: [0, 1, 1] }),
          transform: [
            { translateY: enter.interpolate({ inputRange: [0, 0.55, 0.78, 1], outputRange: [-14, -1, 0, 0] }) },
            { scale: enter.interpolate({ inputRange: [0, 0.55, 0.78, 1], outputRange: [0.96, 1.005, 1, 1] }) },
          ],
        }
      : gm.enter;

  // ---- imessage: typing dots 1.1s, the bubble pops at 1.05s, "Delivered" and chips at 1.45s ----
  const dotsIn = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(style === 'imessage' && firstShow && !reduced ? 0 : 1)).current;
  const late = useRef(new Animated.Value(style === 'imessage' && firstShow && !reduced ? 0 : 1)).current;
  const dotBob = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (style !== 'imessage' || !firstShow || reduced) return;
    Animated.timing(dotsIn, { toValue: 1, duration: 1100, easing: Easing.linear, useNativeDriver: true }).start();
    Animated.loop(Animated.timing(dotBob, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true })).start();
    Animated.timing(pop, { toValue: 1, duration: 420, delay: 1050, easing: Easing.bezier(0.2, 1.3, 0.4, 1), useNativeDriver: true }).start();
    Animated.timing(late, { toValue: 1, duration: 300, delay: 1450, useNativeDriver: true }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- typewriter: typed from 260ms, 34ms + up to 30ms a character, a pause after punctuation ----
  const [typed, setTyped] = useState(style === 'typewriter' && !reduced ? '' : text);
  useEffect(() => {
    if (style !== 'typewriter' || reduced) return undefined;
    let i = 0;
    let timer: ReturnType<typeof setTimeout>;
    const step = () => {
      i += 1;
      setTyped(text.slice(0, i));
      if (i >= text.length) return;
      const ch = text[i - 1];
      timer = setTimeout(step, /[.,!?]/.test(ch) ? 204 : 34 + Math.random() * 30);
    };
    timer = setTimeout(step, 260);
    return () => clearTimeout(timer);
  }, [style, text, reduced]);
  const caret = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (style !== 'typewriter' || reduced) return;
    Animated.loop(Animated.sequence([Animated.timing(caret, { toValue: 0, duration: 1, delay: 499, useNativeDriver: true }), Animated.timing(caret, { toValue: 1, duration: 1, delay: 499, useNativeDriver: true })])).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- voice: bars squash to 35% and back, twice, 60ms apart ----
  const bars = useMemo(() => VOICE_BARS.map(() => new Animated.Value(1)), []);
  useEffect(() => {
    if (style !== 'voice' || reduced) return;
    Animated.parallel(
      bars.map((b, i) =>
        Animated.sequence([
          Animated.delay(i * 60),
          Animated.loop(
            Animated.sequence([
              Animated.timing(b, { toValue: 0.35, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
              Animated.timing(b, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
            ]),
            { iterations: 2 }
          ),
        ])
      )
    ).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- aurora: the coloured edge turns once every 6s ----
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (style !== 'aurora' || reduced) return;
    Animated.loop(Animated.timing(spin, { toValue: 1, duration: 6000, easing: Easing.linear, useNativeDriver: true })).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const width = WIDTH[style];
  const cardFont = font || undefined;

  // ---- the close button ----
  const close = (opts: { top: number; right: number; color: string; circle?: string; size?: number; glyph?: number }) => (
    <Pressable
      onPress={onClose}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={t('common.dismiss')}
      style={{ position: 'absolute', top: opts.top, right: opts.right, width: opts.size ?? 26, height: opts.size ?? 26, borderRadius: opts.circle ? (opts.size ?? 26) / 2 : 8, backgroundColor: opts.circle, alignItems: 'center', justifyContent: 'center', zIndex: 5 }}
    >
      {SvgXml ? <SvgXml xml={closeXml(opts.color, opts.glyph ?? 20)} width={opts.glyph ?? 20} height={opts.glyph ?? 20} /> : <Text style={{ color: opts.color, fontSize: 14 }}>✕</Text>}
    </Pressable>
  );

  // ---- the head: avatar, name, "Online" ----
  const headView = (o: { name: object; status: object; avatar?: number; avatarRadius?: number; showAvatar?: boolean; statusText?: string; dot?: boolean; row?: boolean }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingRight: style === 'postcard' ? 62 : 22 }}>
      {withMascot && p.mascot ? (
        <Animated.View style={[{ width: 40, height: 40, marginTop: -6, marginBottom: -4, marginLeft: -2 }, gm.breath]}>
          <Animated.View style={gm.gesture}>
            <Animated.View style={gm.talk}>
              <GreetingMascot look={p.mascot.look} accent={p.mascot.accent} reduced={reduced} />
            </Animated.View>
          </Animated.View>
        </Animated.View>
      ) : o.showAvatar !== false && head.avatar ? (
        <Animated.View style={gm.breath}>
          <Animated.View style={gm.gesture}>
            <Animated.View style={gm.talk}>
              <Image source={{ uri: head.avatar }} style={{ width: o.avatar ?? 32, height: o.avatar ?? 32, borderRadius: o.avatarRadius ?? (o.avatar ?? 32) / 2, backgroundColor: '#eef2f7' }} />
            </Animated.View>
          </Animated.View>
        </Animated.View>
      ) : null}
      <View style={{ flex: 1, flexDirection: o.row ? 'row' : 'column', alignItems: o.row ? 'center' : 'flex-start' }}>
        <Text numberOfLines={1} style={[{ fontSize: 13.5, fontWeight: '700', color: '#0f172a', fontFamily: cardFont }, o.name]}>
          {head.name}
        </Text>
        {o.statusText !== undefined || head.online ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginLeft: o.row ? 'auto' : 0, paddingRight: o.row ? 18 : 0 }}>
            {o.dot !== false && o.statusText === undefined ? (
              <View style={{ width: 7, height: 7 }}>
                {/* The "Online" ping: the dot swells once and one soft ring goes out. */}
                {gm.pingRing ? <Animated.View pointerEvents="none" style={[{ position: 'absolute', width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#22c55e' }, gm.pingRing]} /> : null}
                <Animated.View style={[{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#22c55e' }, gm.pingDot]} />
              </View>
            ) : null}
            <Text style={[{ fontSize: 12, fontWeight: '500', color: '#64748b', fontFamily: cardFont }, o.status]}>{o.statusText ?? 'Online'}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );

  const chipRow = (chip: object, chipText: object, align: 'flex-start' | 'flex-end' = 'flex-start') =>
    starters.length ? (
      <Animated.View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2, justifyContent: align, opacity: style === 'imessage' ? late : 1 }}>
        {starters.map((s) => (
          <Pressable key={s} onPress={() => onStarter(s)} style={[{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, maxWidth: '100%' }, chip]}>
            <Text numberOfLines={1} style={[{ fontSize: 13, fontWeight: '600', lineHeight: 17 }, chipText]}>
              {s}
            </Text>
          </Pressable>
        ))}
      </Animated.View>
    ) : null;
  const baseChip = { backgroundColor: alpha(accent, 0.07), borderWidth: 1, borderColor: alpha(accent, 0.22) };
  const baseChipText = { color: accent, fontFamily: cardFont };

  // ======== styles ========
  let body: React.ReactNode;
  let box: object = {};
  if (style === 'imessage') {
    const bg = Array.isArray(bubble.bg) ? bubble.bg[0] : bubble.bg;
    const tailXml = (color: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><path fill="${color}" d="M0 0 C 2 9 7 14 16 16 C 8 16 3 14 0 11 Z"/></svg>`;
    const gradientXml = Array.isArray(bubble.bg)
      ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1" preserveAspectRatio="none"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bubble.bg[0]}"/><stop offset="1" stop-color="${bubble.bg[1]}"/></linearGradient></defs><rect width="1" height="1" fill="url(#g)"/></svg>`
      : null;
    box = { paddingTop: 18, gap: 6 };
    body = (
      <>
        <View style={{ alignItems: 'flex-end' }}>
          <Animated.View
            style={[
              { maxWidth: '88%', paddingVertical: 9, paddingHorizontal: 14, borderRadius: 19, backgroundColor: bg },
              shadow(10, 26, '#0f172a', 0.3, 6),
              { opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }] },
            ]}
          >
            {gradientXml && SvgXml ? (
              <View style={[StyleSheet.absoluteFill, { borderRadius: 19, overflow: 'hidden' }]} pointerEvents="none">
                <SvgXml xml={gradientXml} width="100%" height="100%" />
              </View>
            ) : null}
            <Text numberOfLines={3} style={{ color: bubble.fg, fontSize: 15, lineHeight: 20, fontFamily: cardFont }}>{text}</Text>
            {SvgXml ? <View style={{ position: 'absolute', right: -5, bottom: 0 }} pointerEvents="none"><SvgXml xml={tailXml(bubble.tail)} width={16} height={16} /></View> : null}
          </Animated.View>
          {firstShow && !reduced ? (
            <Animated.View
              pointerEvents="none"
              style={{
                position: 'absolute', top: 0, right: 0, flexDirection: 'row', gap: 4, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 19, backgroundColor: '#e9e9eb',
                opacity: dotsIn.interpolate({ inputRange: [0, 0.15, 0.8, 1], outputRange: [0, 1, 1, 0] }),
                transform: [{ scale: dotsIn.interpolate({ inputRange: [0, 0.15, 0.8, 1], outputRange: [0.6, 1, 1, 1.08] }) }],
              }}
            >
              {[0, 1, 2].map((k) => (
                <Animated.View
                  key={k}
                  style={{
                    width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#8e8e93',
                    opacity: dotBob.interpolate({ inputRange: [0, (k * 0.15), 0.3 + k * 0.15, 0.6 + k * 0.15, 1].map((v) => Math.min(1, v)), outputRange: [0.35, 0.35, 1, 0.35, 0.35] }),
                    transform: [{ translateY: dotBob.interpolate({ inputRange: [0, k * 0.15, 0.3 + k * 0.15, 0.6 + k * 0.15, 1].map((v) => Math.min(1, v)), outputRange: [0, 0, -3, 0, 0] }) }],
                  }}
                />
              ))}
              {SvgXml ? <View style={{ position: 'absolute', right: -5, bottom: 0 }}><SvgXml xml={tailXml('#e9e9eb')} width={16} height={16} /></View> : null}
            </Animated.View>
          ) : null}
        </View>
        <Animated.Text style={{ alignSelf: 'flex-end', marginTop: -2, marginRight: 6, fontSize: 11, fontWeight: '600', color: '#8e8e93', opacity: late }}>{t('receipt.delivered')}</Animated.Text>
        {chipRow(
          { backgroundColor: 'rgba(255,255,255,0.94)', borderWidth: 1, borderColor: alpha(accent, 0.35), borderRadius: 17, ...shadow(6, 16, '#0f172a', 0.25, 2) },
          { color: accent, fontFamily: cardFont },
          'flex-end'
        )}
        {close({ top: -6, right: -4, color: '#ffffff', circle: 'rgba(142,142,147,0.9)', size: 22, glyph: 16 })}
      </>
    );
  } else {
    const msg = (s: object, lines = 3) => {
      const base = StyleSheet.flatten([{ fontSize: 14, fontWeight: '500', lineHeight: 20.3, color: '#1e293b', fontFamily: cardFont }, s]) as any;
      // The words fading up one by one (lively): each its own text, laid out as the line would wrap.
      if (gm.words && style !== 'typewriter') {
        const { paddingRight, paddingLeft, paddingHorizontal, paddingTop, paddingBottom, marginTop, ...ink } = base;
        return (
          <View
            accessible
            accessibilityLabel={text}
            style={{ flexDirection: 'row', flexWrap: 'wrap', overflow: 'hidden', maxHeight: (ink.lineHeight || 20.3) * lines, paddingRight, paddingLeft, paddingHorizontal, paddingTop, paddingBottom, marginTop }}
          >
            {gm.words.words.map((w, i) => (
              <Animated.Text key={i} style={[ink, gm.words!.styles[i]]}>
                {i < gm.words!.words.length - 1 ? `${w} ` : w}
              </Animated.Text>
            ))}
          </View>
        );
      }
      return (
        <Text numberOfLines={lines} style={base}>
          {style === 'typewriter' ? typed : text}
          {style === 'typewriter' && !reduced ? <Animated.Text style={{ opacity: caret, color: accent }}>▌</Animated.Text> : null}
        </Text>
      );
    };
    switch (style) {
      case 'note':
        box = { backgroundColor: '#fffdf5', borderRadius: 3, paddingTop: 20, transform: [{ rotate: reduced ? '0deg' : '-1.6deg' }], ...shadow(16, 34, '#1e293b', 0.35, 8) };
        body = (
          <>
            {/* Ruled paper: a line every 26px from 69px down */}
            <View style={[StyleSheet.absoluteFill, { overflow: 'hidden', borderRadius: 3 }]} pointerEvents="none">
              {Array.from({ length: 12 }, (_, k) => (
                <View key={k} style={{ position: 'absolute', left: 0, right: 0, top: 69 + 26 * k, height: 1, backgroundColor: 'rgba(59,130,246,0.16)' }} />
              ))}
            </View>
            {/* The tape */}
            <View pointerEvents="none" style={{ position: 'absolute', top: -9, alignSelf: 'center', left: (width - 84) / 2, width: 84, height: 20, backgroundColor: 'rgba(253,230,138,0.72)', transform: [{ rotate: '2deg' }] }} />
            {headView({ name: { fontFamily: FONTS.note, fontSize: 17, color: '#1f2a44' }, status: { fontFamily: FONTS.note, color: '#475569' } })}
            {msg({ fontFamily: FONTS.note, fontSize: 20, fontWeight: '400', lineHeight: 26, color: '#1f2a44' })}
            {chipRow({ paddingVertical: 2, paddingHorizontal: 4, borderRadius: 4 }, { color: accent, fontFamily: FONTS.note, fontSize: 16, fontWeight: '400', textDecorationLine: 'underline', textDecorationStyle: 'dotted', textDecorationColor: alpha(accent, 0.5) })}
            {close({ top: 10, right: 10, color: '#94a3b8' })}
          </>
        );
        break;
      case 'postcard': {
        // The airmail edge: red / paper / blue / paper stripes at 135deg, 6px round the paper.
        const stripes = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%"><defs><pattern id="a" width="36" height="36" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="12" height="36" fill="#d9383a"/><rect x="12" width="6" height="36" fill="#fbf6ea"/><rect x="18" width="12" height="36" fill="#2754c5"/><rect x="30" width="6" height="36" fill="#fbf6ea"/></pattern></defs><rect width="100%" height="100%" fill="url(#a)"/></svg>`;
        const postmark = `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44"><defs><clipPath id="c"><circle cx="22" cy="22" r="21"/></clipPath></defs><g clip-path="url(#c)">${Array.from({ length: 7 }, (_, k) => `<rect x="0" y="${5 + 6 * k}" width="44" height="1" fill="rgba(43,33,24,0.28)"/>`).join('')}</g><circle cx="22" cy="22" r="21" fill="none" stroke="rgba(43,33,24,0.35)" stroke-width="2"/></svg>`;
        box = { paddingTop: 0, paddingHorizontal: 0, paddingBottom: 0, borderRadius: 6, overflow: 'visible', ...shadow(18, 40, '#2b2118', 0.4, 10) };
        body = (
          <View style={{ borderRadius: 6, overflow: 'hidden' }}>
            {SvgXml ? <View style={StyleSheet.absoluteFill} pointerEvents="none"><SvgXml xml={stripes} width="100%" height="100%" /></View> : <View style={[StyleSheet.absoluteFill, { borderWidth: 6, borderColor: '#d9383a' }]} />}
            <View style={{ margin: 6, backgroundColor: '#fbf6ea', paddingTop: 14, paddingHorizontal: 16, paddingBottom: 14, gap: 8 }}>
              {/* Stamp and postmark */}
              <View pointerEvents="none" style={{ position: 'absolute', top: 12, right: 14, width: 40, height: 48, backgroundColor: accent, borderWidth: 2, borderColor: '#ffffff', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: 'rgba(255,255,255,0.92)', fontSize: 20, fontFamily: FONTS.serif }}>♥</Text>
              </View>
              {SvgXml ? <View pointerEvents="none" style={{ position: 'absolute', top: 34, right: 34, transform: [{ rotate: '-14deg' }] }}><SvgXml xml={postmark} width={44} height={44} /></View> : null}
              {headView({
                showAvatar: false,
                name: { fontFamily: FONTS.serif, fontSize: 12, fontWeight: '600', letterSpacing: 1.44, color: '#8a6d4b', textTransform: 'uppercase' },
                status: { fontFamily: FONTS.serif, fontSize: 17, fontWeight: '600', fontStyle: 'italic', color: '#2b2118', lineHeight: 21 },
                statusText: t('greeting.from', { name: head.name }),
                dot: false,
              })}
              {msg({ fontFamily: FONTS.serif, fontStyle: 'italic', fontSize: 15, color: '#3b2f24', paddingRight: 40, lineHeight: 21.75 })}
              {chipRow({ ...baseChip, borderRadius: 3 }, { ...baseChipText, fontFamily: FONTS.serif })}
            </View>
            {close({ top: -6, right: -6, color: '#94a3b8', circle: '#fbf6ea' })}
          </View>
        );
        break;
      }
      case 'sticky': {
        const curl = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0.5" stop-color="#ffe45c"/><stop offset="0.5" stop-color="rgba(0,0,0,0.12)"/><stop offset="0.6" stop-color="#f4d63a"/></linearGradient></defs><path d="M0 0H22V4A18 18 0 0 1 4 22H0Z" fill="url(#g)"/></svg>`;
        const paper = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1" preserveAspectRatio="none"><defs><linearGradient id="g" x1="0.41" y1="0" x2="0.59" y2="1"><stop offset="0" stop-color="#fff8b0"/><stop offset="1" stop-color="#ffec6e"/></linearGradient></defs><rect width="1" height="1" fill="url(#g)"/></svg>`;
        box = { backgroundColor: '#ffec6e', borderTopLeftRadius: 2, borderTopRightRadius: 2, borderBottomRightRadius: 18, borderBottomLeftRadius: 2, transform: [{ rotate: reduced ? '0deg' : '1.8deg' }], ...shadow(22, 30, '#5a4600', 0.45, 8) };
        body = (
          <>
            {SvgXml ? <View style={[StyleSheet.absoluteFill, { borderTopLeftRadius: 2, borderTopRightRadius: 2, borderBottomRightRadius: 18, borderBottomLeftRadius: 2, overflow: 'hidden' }]} pointerEvents="none"><SvgXml xml={paper} width="100%" height="100%" /></View> : null}
            {SvgXml ? <View style={{ position: 'absolute', right: 0, bottom: 0 }} pointerEvents="none"><SvgXml xml={curl} width={22} height={22} /></View> : null}
            {headView({ avatar: 26, name: { fontFamily: FONTS.sticky, fontSize: 15, fontWeight: '400', color: '#3a2f00' }, status: { color: '#6b5a00' } })}
            {msg({ fontFamily: FONTS.sticky, fontSize: 18, fontWeight: '400', lineHeight: 23.4, color: '#2b2300' })}
            {chipRow({ backgroundColor: 'rgba(255,255,255,0.55)', borderWidth: 1, borderColor: 'rgba(58,47,0,0.25)' }, { color: '#3a2f00' })}
            {close({ top: 10, right: 10, color: '#6b5a00' })}
          </>
        );
        break;
      }
      case 'typewriter':
        box = { backgroundColor: '#fcfbf6', borderRadius: 4, borderTopWidth: 3, borderTopColor: accent, ...shadow(16, 36, '#000000', 0.35, 8) };
        body = (
          <>
            {headView({ name: { fontFamily: FONTS.mono, fontSize: 13.5, fontWeight: '700', letterSpacing: 0.27 }, status: { fontFamily: FONTS.mono } })}
            {msg({ fontFamily: FONTS.mono, fontSize: 15, fontWeight: '600', lineHeight: 22.5, color: '#1c1c1c' }, 4)}
            {chipRow({ ...baseChip, borderRadius: 3 }, { ...baseChipText, fontFamily: FONTS.mono })}
            {close({ top: 10, right: 10, color: '#94a3b8' })}
          </>
        );
        break;
      case 'glass': {
        const glow = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1" preserveAspectRatio="none"><defs><radialGradient id="g" cx="1" cy="0" r="0.72"><stop offset="0" stop-color="${accent}" stop-opacity="0.22"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></radialGradient></defs><rect width="1" height="1" fill="url(#g)"/></svg>`;
        box = { backgroundColor: 'rgba(255,255,255,0.86)', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)', ...shadow(24, 48, '#0f172a', 0.35, 10) };
        body = (
          <>
            {SvgXml ? <View style={[StyleSheet.absoluteFill, { borderRadius: 20, overflow: 'hidden' }]} pointerEvents="none"><SvgXml xml={glow} width="100%" height="100%" /></View> : null}
            {headView({ name: {}, status: { color: '#475569' } })}
            {msg({ color: '#0f172a' })}
            {chipRow({ backgroundColor: 'rgba(255,255,255,0.7)', borderWidth: 1, borderColor: 'rgba(15,23,42,0.08)' }, { color: '#0f172a', fontFamily: cardFont })}
            {close({ top: 10, right: 10, color: '#94a3b8' })}
          </>
        );
        break;
      }
      case 'notification':
        box = { backgroundColor: 'rgba(246,246,248,0.97)', borderRadius: 22, paddingVertical: 12, paddingHorizontal: 14, borderWidth: 0.5, borderColor: 'rgba(0,0,0,0.08)', ...shadow(18, 40, '#000000', 0.35, 10) };
        body = (
          <>
            {headView({ avatar: 22, avatarRadius: 6, row: true, name: { fontSize: 12, fontWeight: '600', letterSpacing: 0.24, color: '#555', textTransform: 'uppercase', fontFamily: undefined }, status: { color: '#8e8e93', fontFamily: undefined }, statusText: t('sdk.greeting.now'), dot: false })}
            {msg({ fontSize: 14.5, lineHeight: 19.6, color: '#111', fontFamily: undefined })}
            {chipRow({ backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 12 }, { color: '#111' })}
            {close({ top: 10, right: 10, color: '#94a3b8' })}
          </>
        );
        break;
      case 'neon': {
        const bg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1" preserveAspectRatio="none"><defs><radialGradient id="g" cx="0" cy="0" r="1.3"><stop offset="0" stop-color="#1b1530"/><stop offset="0.7" stop-color="#07070c"/></radialGradient></defs><rect width="1" height="1" fill="url(#g)"/></svg>`;
        box = { backgroundColor: '#07070c', borderRadius: 16, borderWidth: 1.5, borderColor: alpha(accent, 0.95), ...Platform.select({ ios: { shadowColor: accent, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.55, shadowRadius: 12 }, default: { elevation: 10 } }) };
        body = (
          <>
            {SvgXml ? <View style={[StyleSheet.absoluteFill, { borderRadius: 15, overflow: 'hidden' }]} pointerEvents="none"><SvgXml xml={bg} width="100%" height="100%" /></View> : null}
            {headView({ name: { color: '#ffffff', textShadowColor: alpha(accent, 0.9), textShadowRadius: 8 }, status: { color: '#a5a3c7' } })}
            {msg({ color: '#ede9fe' })}
            {chipRow({ backgroundColor: 'transparent', borderWidth: 1, borderColor: alpha(accent, 0.8) }, { color: '#f5f3ff', fontFamily: cardFont })}
            {close({ top: 10, right: 10, color: '#c4b5fd' })}
          </>
        );
        break;
      }
      case 'voice': {
        const words = text.trim().split(/\s+/).filter(Boolean).length;
        const secs = Math.min(59, Math.max(2, Math.round(words / 2.4)));
        const bg = Array.isArray(bubble.bg) ? bubble.bg[0] : bubble.bg || accent;
        box = { backgroundColor: '#ffffff', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(15,23,42,0.06)', ...shadow(20, 40, '#0f172a', 0.3, 8) };
        body = (
          <>
            {headView({ name: {}, status: {} })}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingLeft: 8, paddingRight: 12, borderRadius: 999, backgroundColor: bg }}>
              <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' }}>
                {SvgXml ? <SvgXml xml={`<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"><path fill="${bubble.fg}" d="M8 5.5v13l10.5-6.5z"/></svg>`} width={14} height={14} /> : <Text style={{ color: bubble.fg }}>▶</Text>}
              </View>
              <View style={{ flex: 1, height: 26, flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                {VOICE_BARS.map((h, i) => (
                  <Animated.View key={i} style={{ flex: 1, height: (26 * h) / 100, borderRadius: 2, backgroundColor: bubble.fg, opacity: 0.85, transform: [{ scaleY: bars[i] }] }} />
                ))}
              </View>
              <Text style={{ color: bubble.fg, fontSize: 12, fontWeight: '600', opacity: 0.9, fontVariant: ['tabular-nums'] }}>{`0:${String(secs).padStart(2, '0')}`}</Text>
            </View>
            {msg({ fontSize: 13, fontStyle: 'italic', color: '#475569', paddingHorizontal: 4, lineHeight: 18.85 })}
            {chipRow(baseChip, baseChipText)}
            {close({ top: 10, right: 10, color: '#94a3b8' })}
          </>
        );
        break;
      }
      case 'aurora': {
        // A conic ring (accent, cyan, violet, pink) in 48 slices, turning behind a white card.
        const colors = [accent, '#22d3ee', '#a78bfa', '#f472b6', accent];
        const lerp = (a: string, b: string, t: number) => {
          const pa = parseInt(a.replace('#', ''), 16), pb = parseInt(b.replace('#', ''), 16);
          const c = (s: number) => Math.round(((pa >> s) & 255) + (((pb >> s) & 255) - ((pa >> s) & 255)) * t);
          return `rgb(${c(16)},${c(8)},${c(0)})`;
        };
        const slices = Array.from({ length: 48 }, (_, i) => {
          const a0 = (i / 48) * Math.PI * 2 - Math.PI / 2, a1 = ((i + 1.05) / 48) * Math.PI * 2 - Math.PI / 2;
          const seg = (i / 48) * 4, k = Math.floor(seg);
          const col = lerp(colors[k], colors[k + 1], seg - k);
          return `<path d="M50 50 L${50 + 70 * Math.cos(a0)} ${50 + 70 * Math.sin(a0)} L${50 + 70 * Math.cos(a1)} ${50 + 70 * Math.sin(a1)}Z" fill="${col}"/>`;
        }).join('');
        const ring = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${slices}</svg>`;
        const side = width * 1.8;
        box = { backgroundColor: '#ffffff', borderRadius: 20, overflow: 'hidden', ...Platform.select({ ios: { shadowColor: accent, shadowOffset: { width: 0, height: 24 }, shadowOpacity: 0.4, shadowRadius: 25 }, default: { elevation: 8 } }) };
        body = (
          <>
            {SvgXml ? (
              <View style={[StyleSheet.absoluteFill, { borderRadius: 20, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }]} pointerEvents="none">
                <Animated.View style={{ width: side, height: side, transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}>
                  <SvgXml xml={ring} width={side} height={side} />
                </Animated.View>
                <View style={{ position: 'absolute', top: 2, left: 2, right: 2, bottom: 2, borderRadius: 18, backgroundColor: '#ffffff' }} />
              </View>
            ) : null}
            {headView({ name: {}, status: {} })}
            {msg({})}
            {chipRow(baseChip, baseChipText)}
            {close({ top: 10, right: 10, color: '#94a3b8' })}
          </>
        );
        break;
      }
      default:
        box = { backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(15,23,42,0.06)', ...shadow(18, 44, '#0f172a', 0.3, 10) };
        body = (
          <>
            {headView({ name: {}, status: {} })}
            {msg({})}
            {chipRow(baseChip, baseChipText)}
            {close({ top: 10, right: 10, color: '#94a3b8' })}
          </>
        );
    }
  }

  return (
    <Animated.View style={[{ width }, entranceStyle]} pointerEvents={p.leaving ? 'none' : 'auto'} onLayout={(e) => setCardH(e.nativeEvent.layout.height)}>
      <Animated.View style={gm.leave}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={text}
        style={[{ paddingTop: 14, paddingHorizontal: 16, paddingBottom: 14, gap: 8 }, style === 'imessage' ? { paddingHorizontal: 0, paddingBottom: 0 } : null, box]}
      >
        {body}
      </Pressable>
      </Animated.View>
    </Animated.View>
  );
};
