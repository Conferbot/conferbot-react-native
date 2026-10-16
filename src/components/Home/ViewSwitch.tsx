// @ts-nocheck
/**
 * The open chat's views - home, conversation, help centre - and how the
 * new one comes in: core/viewTransition.ts viewMotion from the owner's
 * viewTransition / viewTransitionDirection (web ts/layout/viewTransition.ts).
 * Native-driven, played once per switch; reduced motion is a 200ms fade.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, AccessibilityInfo, StyleSheet, View } from 'react-native';
import { VIEW_EASE, VIEW_EASE_IO, viewMotion, type ViewMotion } from '../../core/viewTransition';

export interface ViewSwitchProps {
  /** The view on screen ('home', 'chat', 'help'). */
  view: string;
  /** customizations.viewTransition and viewTransitionDirection. */
  kind?: unknown;
  sweep?: unknown;
  children: React.ReactNode;
  testID?: string;
}

export const ViewSwitch: React.FC<ViewSwitchProps> = ({ view, kind, sweep, children, testID }) => {
  const shown = useRef(view);
  const motion = useRef<ViewMotion>({ kind: 'none' });
  const pending = useRef(false);
  const reduced = useRef(false);
  const v = useRef(new Animated.Value(1)).current;
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    let gone = false;
    try {
      Promise.resolve((AccessibilityInfo as any)?.isReduceMotionEnabled?.())
        .then((r) => {
          if (!gone) reduced.current = !!r;
        })
        .catch(() => {});
    } catch {
      /* no setting: full motion */
    }
    return () => {
      gone = true;
    };
  }, []);

  // Decided while drawing, so the new view's first frame is already where it starts.
  if (shown.current !== view) {
    motion.current = viewMotion(kind, sweep, shown.current, view, reduced.current);
    shown.current = view;
    if (motion.current.kind === 'none') v.setValue(1);
    else {
      v.setValue(0);
      pending.current = true;
    }
  }

  useEffect(() => {
    if (!pending.current) return;
    pending.current = false;
    const mo = motion.current;
    if (mo.kind === 'none') return;
    const easing =
      mo.kind === 'reduced' ? Easing.linear : mo.kind === 'slide' ? Easing.bezier(...VIEW_EASE_IO) : Easing.bezier(...VIEW_EASE);
    Animated.timing(v, { toValue: 1, duration: mo.duration, delay: mo.kind === 'fade' ? mo.delay : 0, easing, useNativeDriver: true }).start();
  });

  const mo = motion.current;
  const style =
    mo.kind === 'reduced'
      ? { opacity: v }
      : mo.kind === 'fade'
        ? { opacity: v, transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [mo.scaleFrom, 1] }) }] }
        : mo.kind === 'slide'
          ? {
              transform: [
                { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [mo.dx * size.w, 0] }) },
                { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [mo.dy * size.h, 0] }) },
              ],
            }
          : null;

  return (
    <View
      style={{ flex: 1, overflow: 'hidden' }}
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      testID={testID}
    >
      <Animated.View key={view} style={[StyleSheet.absoluteFill, style]}>
        {children}
      </Animated.View>
    </View>
  );
};

export default ViewSwitch;
