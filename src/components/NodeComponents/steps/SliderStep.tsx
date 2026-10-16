/**
 * SliderStep.tsx
 *
 * slider-node (web richNodesView renderSlider): the value with its unit
 * over a track from min to max on the step's grid (dragged, tapped, or
 * stepped by the screen reader's adjust actions), the ends under it, then
 * Send, which answers {value} snapped to the step.
 */

import React, { useRef, useState } from 'react';
import { View, Text } from 'react-native';
import { sliderConfig, sliderLabel, snapToStep, submitLabel } from '../../../core/flow/rich';
import { t } from '../../../core/i18n';
import { StepButton, StepCard, StepViewProps, useStepLook } from './stepKit';

const THUMB = 22;

/** The value at `x` along a track `width` wide. */
export const sliderValueAt = (x: number, width: number, cfg: { min: number; max: number; step: number }): number => {
  if (!(width > 0)) return cfg.min;
  const f = Math.max(0, Math.min(1, x / width));
  return snapToStep(cfg.min + f * (cfg.max - cfg.min), cfg);
};

export const SliderStep: React.FC<StepViewProps> = ({ ui, onSubmit, busy, testID = 'step-slider' }) => {
  const look = useStepLook();
  const data = ui.stepData || {};
  const cfg = sliderConfig(data);
  const [value, setValue] = useState(() => snapToStep(cfg.start, cfg));
  const width = useRef(0);
  const span = cfg.max - cfg.min;
  const pct = span > 0 ? ((value - cfg.min) / span) * 100 : 0;
  const text = sliderLabel(value, cfg);
  const nudge = (dir: number) => setValue((v) => snapToStep(Math.max(cfg.min, Math.min(cfg.max, v + dir * cfg.step)), cfg));

  return (
    <StepCard look={look} testID={testID}>
      <Text style={{ color: look.text, fontSize: look.fontSize + 6, fontWeight: '600', textAlign: 'center' }} testID={`${testID}-value`}>
        {text}
      </Text>
      <View
        onLayout={(e) => {
          width.current = e.nativeEvent.layout.width;
        }}
        onStartShouldSetResponder={() => !busy}
        onMoveShouldSetResponder={() => !busy}
        onResponderTerminationRequest={() => false}
        onResponderGrant={(e) => setValue(sliderValueAt(e.nativeEvent.locationX, width.current, cfg))}
        onResponderMove={(e) => setValue(sliderValueAt(e.nativeEvent.locationX, width.current, cfg))}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={String(ui.question || '').trim() || t('rich.value')}
        accessibilityValue={{ min: cfg.min, max: cfg.max, now: value, text }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => nudge(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
        testID={`${testID}-track`}
        style={{ height: THUMB + 10, justifyContent: 'center' }}
      >
        <View pointerEvents="none" style={{ height: 6, borderRadius: 3, backgroundColor: look.line }}>
          <View style={{ width: `${pct}%`, height: 6, borderRadius: 3, backgroundColor: look.accent }} />
        </View>
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: `${pct}%`,
            marginLeft: -THUMB / 2,
            width: THUMB,
            height: THUMB,
            borderRadius: THUMB / 2,
            backgroundColor: look.accent,
            borderWidth: 3,
            borderColor: look.card,
          }}
        />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: look.muted, fontSize: look.fontSize - 2 }}>{sliderLabel(cfg.min, cfg)}</Text>
        <Text style={{ color: look.muted, fontSize: look.fontSize - 2 }}>{sliderLabel(cfg.max, cfg)}</Text>
      </View>
      <StepButton look={look} primary title={submitLabel(data)} disabled={busy} onPress={() => onSubmit({ value: snapToStep(value, cfg) })} testID={`${testID}-submit`} />
    </StepCard>
  );
};

export default SliderStep;
