/**
 * SignatureStep.tsx
 *
 * signature-node (web richNodesView renderSignature): a pad to sign on
 * with a finger ("Sign here", Undo, Clear), the full name when the step
 * asks for it, "Type instead" when typed signatures are allowed, then
 * Sign. The strokes go to the step as an SVG image ({action: "sign",
 * method: "drawn", dataUrl, width, height}; nothing drawn: strokes 0 and
 * the step says why); a typed name as {action: "sign", method: "typed",
 * name}. The pad draws with react-native-svg; an app without it signs
 * by typed name (the spec's fallback).
 */

import React, { useRef, useState } from 'react';
import { View, Text } from 'react-native';
import { cleanSignatureName, markdownLitePlain, signatureConfig, smoothSegments, strokeBounds, trimRect } from '../../../core/flow/rich';
import { t } from '../../../core/i18n';
import { StepButton, StepCard, StepField, StepLink, StepRow, StepStatus, StepViewProps, useStepLook } from './stepKit';
import { loadSvg } from '../../../optional/svg';

let Svg: any = null;
let SvgPath: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const svg = loadSvg();
  Svg = svg.default || svg.Svg;
  SvgPath = svg.Path;
} catch {
  Svg = null;
}

export type Point = { x: number; y: number };
export const PAD_HEIGHT = 140;
const INK = '#111827';
const LINE = 2.6;

/** One stroke as an SVG path ("M x y Q cx cy x y ..."; a single point is a dot). */
export const strokePath = (pts: Point[]): string => {
  const { start, segs } = smoothSegments(pts);
  if (!start) return '';
  const r = (n: number) => Math.round(n * 10) / 10;
  if (!segs.length) return `M${r(start.x)} ${r(start.y)} l0.1 0.1`;
  return `M${r(start.x)} ${r(start.y)}` + segs.map((s) => ` Q${r(s.cx)} ${r(s.cy)} ${r(s.x)} ${r(s.y)}`).join('');
};

/** The strokes as an SVG image, trimmed to the ink (web exports the canvas the same way, as PNG). */
export const signatureSvg = (strokes: Point[][], padWidth: number, padHeight = PAD_HEIGHT, ink = INK) => {
  const b = strokeBounds(strokes.map((s) => s.map((p) => ({ ...p, p: 0.5 }))), LINE);
  if (!b) return null;
  const rect = trimRect(b, 8, Math.max(1, padWidth), padHeight);
  const paths = strokes
    .map((s) => `<path d="${strokePath(s)}" fill="none" stroke="${ink}" stroke-width="${LINE}" stroke-linecap="round" stroke-linejoin="round"/>`)
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${rect.w}" height="${rect.h}" viewBox="${rect.x} ${rect.y} ${rect.w} ${rect.h}">${paths}</svg>`;
  return { dataUrl: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, width: rect.w, height: rect.h };
};

export const SignatureStep: React.FC<StepViewProps> = ({ ui, onSubmit, busy, testID = 'step-signature' }) => {
  const look = useStepLook();
  const cfg = signatureConfig(ui.stepData || {});
  const canDraw = !!(Svg && SvgPath);
  const [typing, setTyping] = useState(!canDraw && cfg.allowTyped);
  const [strokes, setStrokes] = useState<Point[][]>([]);
  const [typed, setTyped] = useState('');
  const [fullName, setFullName] = useState('');
  const width = useRef(0);
  const ink = cfg.penColor !== 'auto' ? cfg.penColor : INK;

  const at = (e: any): Point => {
    const w = width.current || 1;
    return {
      x: Math.max(0, Math.min(w, Number(e.nativeEvent.locationX) || 0)),
      y: Math.max(0, Math.min(PAD_HEIGHT, Number(e.nativeEvent.locationY) || 0)),
    };
  };

  const sign = () => {
    const name = cfg.requireName ? { fullName: cleanSignatureName(fullName) } : {};
    if (typing) {
      onSubmit({ action: 'sign', method: 'typed', name: cleanSignatureName(typed), ...name });
      return;
    }
    const image = signatureSvg(strokes, width.current, PAD_HEIGHT, ink);
    onSubmit(image ? { action: 'sign', method: 'drawn', ...image, ...name } : { action: 'sign', method: 'drawn', strokes: 0, ...name });
  };

  return (
    <StepCard look={look} testID={testID}>
      {cfg.requireName ? (
        <StepField
          look={look}
          label={t('signature.fullName')}
          value={fullName}
          onChangeText={setFullName}
          placeholder={t('signature.namePlaceholder')}
          autoComplete="name"
          autoCapitalize="words"
          testID={`${testID}-fullname`}
        />
      ) : null}
      {typing ? (
        <View style={{ gap: 8 }}>
          <StepField
            look={look}
            label={t('signature.typeToSign')}
            value={typed}
            onChangeText={setTyped}
            placeholder={t('signature.namePlaceholder')}
            autoComplete="name"
            autoCapitalize="words"
            returnKeyType="done"
            onSubmitEditing={sign}
            testID={`${testID}-typed`}
          />
          <View style={{ height: 70, borderBottomWidth: 1, borderBottomColor: look.line, justifyContent: 'flex-end', paddingBottom: 6 }}>
            <Text style={{ color: ink, fontSize: 30, fontStyle: 'italic', textAlign: 'center' }} numberOfLines={1} adjustsFontSizeToFit>
              {cleanSignatureName(typed)}
            </Text>
          </View>
        </View>
      ) : (
        <View
          onLayout={(e) => {
            width.current = e.nativeEvent.layout.width;
          }}
          onStartShouldSetResponder={() => !busy}
          onMoveShouldSetResponder={() => !busy}
          onResponderTerminationRequest={() => false}
          onResponderGrant={(e) => {
            const p = at(e);
            setStrokes((cur) => [...cur, [p]]);
          }}
          onResponderMove={(e) => {
            const p = at(e);
            setStrokes((cur) => (cur.length ? [...cur.slice(0, -1), [...cur[cur.length - 1], p]] : [[p]]));
          }}
          accessibilityLabel={t('sdk.signature.pad')}
          testID={`${testID}-pad`}
          style={{
            height: PAD_HEIGHT,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: look.line,
            backgroundColor: '#ffffff',
            overflow: 'hidden',
          }}
        >
          {strokes.length === 0 ? (
            <View pointerEvents="none" style={{ position: 'absolute', alignSelf: 'center', top: PAD_HEIGHT / 2 - 10 }}>
              <Text style={{ color: '#9ca3af', fontSize: look.fontSize - 1 }}>{t('signature.here')}</Text>
            </View>
          ) : null}
          <View pointerEvents="none" style={{ position: 'absolute', left: 16, right: 16, bottom: 30, borderBottomWidth: 1, borderBottomColor: '#d1d5db' }} />
          {!canDraw
            ? // No react-native-svg: the ink as dots (the image sent is the same SVG).
              strokes.flat().map((p, i) => (
                <View
                  key={i}
                  pointerEvents="none"
                  style={{ position: 'absolute', left: p.x - LINE / 2, top: p.y - LINE / 2, width: LINE, height: LINE, borderRadius: LINE / 2, backgroundColor: ink }}
                />
              ))
            : null}
          {canDraw ? (
            <Svg width="100%" height={PAD_HEIGHT} pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0 }}>
              {strokes.map((s, i) => (
                <SvgPath key={i} d={strokePath(s)} fill="none" stroke={ink} strokeWidth={LINE} strokeLinecap="round" strokeLinejoin="round" />
              ))}
            </Svg>
          ) : null}
        </View>
      )}
      <StepRow>
        {!typing ? (
          <>
            <StepLink look={look} title={t('signature.undo')} disabled={busy || !strokes.length} onPress={() => setStrokes((cur) => cur.slice(0, -1))} testID={`${testID}-undo`} />
            <StepLink look={look} title={t('signature.clear')} disabled={busy || !strokes.length} onPress={() => setStrokes([])} testID={`${testID}-clear`} />
          </>
        ) : null}
        {cfg.allowTyped && canDraw ? (
          <StepLink look={look} title={typing ? t('signature.drawInstead') : t('signature.typeInstead')} disabled={busy} onPress={() => setTyping((v) => !v)} testID={`${testID}-mode`} />
        ) : null}
      </StepRow>
      {cfg.consentText ? <Text style={{ color: look.muted, fontSize: look.fontSize - 2 }}>{markdownLitePlain(cfg.consentText)}</Text> : null}
      <StepStatus look={look} error={ui.errorMessage} testID={`${testID}-status`} />
      <StepButton look={look} primary title={cfg.submitLabel} disabled={busy} onPress={sign} testID={`${testID}-sign`} />
    </StepCard>
  );
};

export default SignatureStep;
