/**
 * The conversation's human touches, drawn (core/delight.ts; web
 * ts/chat/delight/ and css/nodes/17-delight.css, 06-rating-fx.css):
 *
 *   ReactionBadge    the bot's tapback on the corner of the visitor's
 *                    answer facing the bot, popping in (cb-react-pop)
 *   ConfettiBurst    a second of confetti in the bot's colours from the
 *                    answer (cb-confetti-fly), transform and opacity only
 *   RatingSparks     the rating's sparks on a pick (cbn-spark)
 *   StallHint        "No rush - ..." under a question that has waited
 *   ChangeAnswerLink "Edit" under the visitor's latest answer
 *
 * Nothing moves for visitors who ask for less motion (fxAnimated useReducedMotion);
 * the confetti and the sparks are not drawn at all then.
 */
import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Text, TouchableOpacity, View } from 'react-native';
import { useReducedMotion } from '../FloatingWidget/fxAnimated';
import { CONFETTI_MS, confettiPieces, ratingSparks, reactionLabel } from '../../core/delight';
import { t } from '../../core/i18n';

// The web's easings (css/nodes/01-base.css --cbn-spring, --cbn-ease).
const SPRING = Easing.bezier(0.34, 1.56, 0.64, 1);
const EASE = Easing.bezier(0.22, 1, 0.36, 1);

/** The tapback: a 26 px round badge, start corner, 14 px below the bubble. */
export const ReactionBadge: React.FC<{ emoji: string; card: string; ring: string; testID?: string }> = ({ emoji, card, ring, testID }) => {
  const reduced = useReducedMotion();
  const pop = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) {
      pop.setValue(1);
      return;
    }
    Animated.timing(pop, { toValue: 1, duration: 460, easing: SPRING, useNativeDriver: true }).start();
  }, [reduced]);
  const scale = pop.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.2, 1.18, 1] });
  const rotate = pop.interpolate({ inputRange: [0, 0.6, 1], outputRange: ['-24deg', '6deg', '0deg'] });
  const opacity = pop.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 1, 1] });
  return (
    <Animated.View
      pointerEvents="none"
      accessible
      accessibilityRole="image"
      accessibilityLabel={reactionLabel(emoji)}
      testID={testID}
      style={{
        position: 'absolute',
        left: -8,
        bottom: -14,
        width: 26,
        height: 26,
        borderRadius: 13,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: card,
        borderWidth: 2,
        borderColor: ring,
        shadowColor: '#0f172a',
        shadowOpacity: 0.18,
        shadowRadius: 3,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
        opacity,
        transform: [{ scale }, { rotate }],
      }}
    >
      <Text style={{ fontSize: 13, lineHeight: 16 }}>{emoji}</Text>
    </Animated.View>
  );
};

/**
 * The burst, from the bubble's middle: each piece flies out to (dx, dy)
 * by 55% of 1.05 s, then on and down by its fall while it fades. Colours:
 * the bot's accent, the star gold, the accent lightened, a mint.
 */
export const ConfettiBurst: React.FC<{ accent: string; testID?: string; onDone?: () => void }> = ({ accent, testID, onDone }) => {
  const reduced = useReducedMotion();
  const pieces = useMemo(() => confettiPieces(), []);
  const progress = useMemo(() => pieces.map(() => new Animated.Value(0)), [pieces]);
  useEffect(() => {
    if (reduced) return;
    const anims = pieces.map((p, i) =>
      Animated.timing(progress[i], { toValue: 1, duration: 1050, delay: p.delay, easing: Easing.bezier(0.2, 0.7, 0.3, 1), useNativeDriver: true })
    );
    Animated.parallel(anims).start();
    const done = setTimeout(() => onDone?.(), CONFETTI_MS);
    return () => clearTimeout(done);
  }, [reduced]);
  if (reduced) return null;
  const tones = [accent, '#f5a524', mix(accent, 0.45), '#34d399'];
  return (
    <View pointerEvents="none" testID={testID} style={{ position: 'absolute', left: '50%', top: '50%', width: 0, height: 0, zIndex: 2 }}>
      {pieces.map((p, i) => {
        const v = progress[i];
        const tx = v.interpolate({ inputRange: [0, 0.55, 1], outputRange: [0, p.dx, p.dx * 1.15] });
        const ty = v.interpolate({ inputRange: [0, 0.55, 1], outputRange: [0, p.dy, p.dy + p.fall] });
        const rot = v.interpolate({ inputRange: [0, 0.55, 1], outputRange: ['0deg', `${p.rot * 0.6}deg`, `${p.rot}deg`] });
        const sc = v.interpolate({ inputRange: [0, 0.55, 1], outputRange: [0.6, 1, 0.9] });
        const op = v.interpolate({ inputRange: [0, 0.01, 0.55, 1], outputRange: [0, 1, 1, 0] });
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              top: p.round ? -3 : -4,
              left: -3,
              width: 6,
              height: p.round ? 6 : 9,
              borderRadius: p.round ? 3 : 1.5,
              backgroundColor: tones[p.tone],
              opacity: op,
              transform: [{ translateX: tx }, { translateY: ty }, { rotate: rot }, { scale: sc }],
            }}
          />
        );
      })}
    </View>
  );
};

/** A colour mixed with white (CSS color-mix(in srgb, c share, #fff)). */
const mix = (hex: string, share: number): string => {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) return '#a5b4fc';
  const n = parseInt(m[1], 16);
  const c = (v: number) => Math.round(v * share + 255 * (1 - share));
  const h = (v: number) => c(v).toString(16).padStart(2, '0');
  return `#${h((n >> 16) & 255)}${h((n >> 8) & 255)}${h(n & 255)}`;
};

/** Sparks round the picked star or face: out from its edge, 12 px to 36 px, fading. */
export const RatingSparks: React.FC<{ top: boolean; color: string; testID?: string }> = ({ top, color, testID }) => {
  const reduced = useReducedMotion();
  const angles = useMemo(() => ratingSparks(top), [top]);
  const progress = useMemo(() => angles.map(() => new Animated.Value(0)), [angles]);
  useEffect(() => {
    if (reduced) return;
    Animated.parallel(
      angles.map((_, i) =>
        Animated.timing(progress[i], { toValue: 1, duration: i % 2 ? 600 : 750, delay: 80, easing: Easing.bezier(0.2, 0.8, 0.3, 1), useNativeDriver: true })
      )
    ).start();
  }, [reduced]);
  if (reduced) return null;
  return (
    <View pointerEvents="none" testID={testID} style={{ position: 'absolute', left: '50%', top: '50%', width: 0, height: 0 }}>
      {angles.map((a, i) => {
        const v = progress[i];
        const size = i % 2 ? 4 : 6;
        const ty = v.interpolate({ inputRange: [0, 1], outputRange: [-12, -36] });
        const sc = v.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.3] });
        const op = v.interpolate({ inputRange: [0, 0.15, 0.65, 1], outputRange: [0, 1, 1, 0] });
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left: -size / 2,
              top: -size / 2,
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: color,
              opacity: op,
              transform: [{ rotate: `${a}deg` }, { translateY: ty }, { scale: sc }],
            }}
          />
        );
      })}
    </View>
  );
};

/** "No rush - ...": a soft line under the question, a breathing dot, rising in. */
export const StallHint: React.FC<{ text: string; accent: string; muted: string; indent?: number; testID?: string }> = ({
  text,
  accent,
  muted,
  indent = 0,
  testID,
}) => {
  const reduced = useReducedMotion();
  const enter = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  const breathe = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced) {
      enter.setValue(1);
      return;
    }
    Animated.timing(enter, { toValue: 1, duration: 400, easing: EASE, useNativeDriver: true }).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [reduced]);
  const ty = enter.interpolate({ inputRange: [0, 1], outputRange: [4, 0] });
  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      accessibilityRole="text"
      testID={testID}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, marginBottom: 4, marginLeft: indent, opacity: enter, transform: [{ translateY: ty }] }}
    >
      <Animated.View
        style={{
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: accent,
          opacity: reduced ? 1 : breathe.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
          transform: [{ scale: reduced ? 1 : breathe.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.1] }) }],
        }}
      />
      <Text style={{ flex: 1, fontSize: 12.5, color: muted }}>{text}</Text>
    </Animated.View>
  );
};

/** "Edit": a small muted link right under the latest answer, at its edge. */
export const ChangeAnswerLink: React.FC<{ onPress: () => void; muted: string; font?: any; testID?: string }> = ({ onPress, muted, font, testID }) => {
  const reduced = useReducedMotion();
  const enter = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (!reduced) Animated.timing(enter, { toValue: 1, duration: 300, easing: EASE, useNativeDriver: true }).start();
  }, [reduced]);
  return (
    <Animated.View style={{ alignSelf: 'flex-end', marginTop: 2, marginRight: 2, marginBottom: 6, opacity: enter }}>
      <TouchableOpacity
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={t('chat.changeAnswer')}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 3, opacity: 0.85, padding: 2 }}
        testID={testID}
      >
        <Text style={{ fontSize: 11, color: muted }}>✎</Text>
        <Text style={[{ fontSize: 11.5, fontWeight: '500', color: muted }, font]}>{t('chat.edit')}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};
