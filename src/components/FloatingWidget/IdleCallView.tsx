import React, { useMemo, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { mascotLayers, type MascotLook } from '../../core/mascotArt';
import type { IdleCallPerformance } from '../../core/launcherIdleCall';
import { MascotFigure } from '../Mascot/MascotFigure';

type SvgComponent = React.ComponentType<{ xml: string; width: number | string; height: number | string }>;

/**
 * The idle call's mascot on its stage over the launcher (idleCall.ts
 * perform): the owner's mascot (shape, eyes, accessory, colour), just behind
 * the button (it slips out from behind it), or in front for "knock" and
 * "tap", whose paw lands on it; the white rings where it lands. Each part
 * of the drawing is its own layer, moved on the clock.
 */
export const IdleCallStage: React.FC<{ perf: IdleCallPerformance; styles: any; look?: Partial<MascotLook>; launcherAccent: string; Svg: SvgComponent }> = ({ perf, styles, look, launcherAccent, Svg }) => {
  const layers = useMemo(
    () => mascotLayers(launcherAccent, perf.mascot.arm, look),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [launcherAccent, perf.mascot.arm, look?.shape, look?.eyes, look?.accessory, look?.color]
  );
  const n = perf.mascot.size;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: perf.mascot.x, top: perf.mascot.y, width: n, height: n }, styles.mascot]}>
        <MascotFigure layers={layers} size={n} Svg={Svg} styles={{ body: styles.body, arm: styles.arm, look: styles.look, lid: styles.lid, brow: styles.brow, smile: styles.smile, o: styles.o, grin: styles.grin }} />
      </Animated.View>
      {styles.rings.map((r: any, i: number) => (
        <Animated.View
          key={i}
          pointerEvents="none"
          style={[
            { position: 'absolute', left: r.x - r.d / 2, top: r.y - r.d / 2, width: r.d, height: r.d, borderRadius: r.d / 2, borderWidth: 2.5, borderColor: 'rgba(255,255,255,0.9)' },
            Platform.select({ ios: { shadowColor: '#0f172a', shadowOpacity: 0.25, shadowRadius: 1, shadowOffset: { width: 0, height: 0 } }, default: {} }),
            r.style,
          ]}
        />
      ))}
    </View>
  );
};

/**
 * The speech bubble over the mascot (.cb-ic-bubble): its tail on the
 * mascot, kept inside the screen, popping in and out on the clock. Tapping
 * it opens the chat. None while the greeting is up (it does the talking).
 */
export const IdleCallBubble: React.FC<{
  perf: IdleCallPerformance;
  style: any;
  line: string;
  launcherLeft: number;
  launcherHeight: number;
  screenWidth: number;
  font: string | null;
  onPress: () => void;
}> = ({ perf, style, line, launcherLeft, launcherHeight, screenWidth, font, onPress }) => {
  const [bw, setBw] = useState(0);
  const want = launcherLeft + perf.sayX - bw / 2;
  const left = Math.max(8, Math.min(screenWidth - bw - 8, want)) - launcherLeft;
  const tail = Math.max(14, Math.min(bw - 14, perf.sayX - left));
  return (
    <Animated.View
      style={[{ position: 'absolute', left, bottom: launcherHeight - (perf.sayY - 10), zIndex: 10002, elevation: 9 }, style, bw ? null : { opacity: 0 }]}
      onLayout={(e) => setBw(e.nativeEvent.layout.width)}
    >
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${line} Open the chat`} style={bubble.box}>
        <Text style={[bubble.text, font ? { fontFamily: font } : null]} numberOfLines={1}>
          {line}
        </Text>
        <View style={[bubble.tail, { left: tail - 6 }]} />
      </Pressable>
    </Animated.View>
  );
};

const bubble = StyleSheet.create({
  box: {
    paddingVertical: 8,
    paddingHorizontal: 13,
    borderRadius: 16,
    backgroundColor: '#fff',
    ...Platform.select({
      ios: { shadowColor: '#0f172a', shadowOpacity: 0.3, shadowRadius: 14, shadowOffset: { width: 0, height: 10 } },
      android: { elevation: 8 },
    }),
  },
  text: { color: '#0f172a', fontWeight: '700', fontSize: 13.5, lineHeight: 16.2 },
  tail: { position: 'absolute', bottom: -6, width: 12, height: 12, backgroundColor: '#fff', transform: [{ rotate: '45deg' }] },
});
