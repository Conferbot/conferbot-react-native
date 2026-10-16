/**
 * ConsentStep.tsx
 *
 * consent-node (web richNodesView renderConsent): the consent text, its
 * links opening in the browser (never ticking the box), a box to tick and
 * Continue. Continue answers {agreed}; a required consent not ticked is
 * refused by the step, whose words show under the box.
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Linking } from 'react-native';
import { consentContinueLabel, safeLink } from '../../../core/flow/rich';
import { t } from '../../../core/i18n';
import { StepButton, StepCard, StepStatus, StepViewProps, useStepLook } from './stepKit';

/** A piece of the consent text: plain, bold, or a link. */
export interface ConsentPiece {
  text: string;
  url?: string;
  bold?: boolean;
}

const MD_LINK = /\[([^\]\n]{1,200})\]\(((?:[^()\s]|\([^()\s]*\)){1,500})\)/g;

/** The markdown-lite text as pieces (links http(s) / mailto only, **bold**; *italic* drawn plain). */
export const consentPieces = (md: any): ConsentPiece[] => {
  const src = String(md ?? '');
  // Links first (as the web parks them), then **bold** across the rest - a
  // link inside bold text is bold too. An unpaired ** stays as typed.
  const raw: ConsentPiece[] = [];
  let last = 0;
  src.replace(MD_LINK, (whole: string, text: string, url: string, at: number) => {
    if (at > last) raw.push({ text: src.slice(last, at) });
    const href = safeLink(url);
    raw.push(href ? { text, url: href } : { text: whole });
    last = at + whole.length;
    return whole;
  });
  if (last < src.length) raw.push({ text: src.slice(last) });
  const marks = raw.reduce((n, p) => n + (p.url ? 0 : (p.text.match(/\*\*/g) || []).length), 0);
  const italic = (t: string) => t.replace(/(^|[\s(])[*_]([^*_\n]+)[*_](?=[\s).,!?:;]|$)/g, '$1$2');
  const out: ConsentPiece[] = [];
  let bold = false;
  raw.forEach((p) => {
    if (p.url) {
      out.push(bold ? { ...p, bold: true } : p);
      return;
    }
    const parts = marks % 2 === 0 ? p.text.split('**') : [p.text];
    parts.forEach((part, i) => {
      if (i > 0) bold = !bold;
      if (part) out.push(bold ? { text: italic(part), bold: true } : { text: italic(part) });
    });
  });
  return out;
};

export const ConsentStep: React.FC<StepViewProps> = ({ ui, onSubmit, busy, testID = 'step-consent' }) => {
  const look = useStepLook();
  const data = ui.stepData || {};
  const [agreed, setAgreed] = useState(false);
  const pieces = consentPieces(data.consentText);

  return (
    <StepCard look={look} testID={testID}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
        <TouchableOpacity
          onPress={() => setAgreed((a) => !a)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: agreed }}
          accessibilityLabel={pieces.map((p) => p.text).join('') || t('sdk.consent.agree')}
          testID={`${testID}-box`}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{
            width: 22,
            height: 22,
            marginTop: 1,
            borderRadius: 5,
            borderWidth: 2,
            borderColor: agreed ? look.accent : look.muted,
            backgroundColor: agreed ? look.accent : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {agreed ? <Text style={{ color: look.accentInk, fontSize: 14, fontWeight: '700', lineHeight: 16 }}>✓</Text> : null}
        </TouchableOpacity>
        <Text style={{ flex: 1, color: look.text, fontSize: look.fontSize, lineHeight: look.fontSize * 1.4 }} onPress={() => setAgreed((a) => !a)}>
          {pieces.length ? (
            pieces.map((p, i) =>
              p.url ? (
                <Text
                  key={i}
                  accessibilityRole="link"
                  style={{ color: look.accent, textDecorationLine: 'underline', fontWeight: p.bold ? '700' : undefined }}
                  onPress={() => Linking.openURL(p.url!).catch(() => undefined)}
                  testID={`${testID}-link-${i}`}
                >
                  {p.text}
                </Text>
              ) : (
                <Text key={i} style={p.bold ? { fontWeight: '700' } : undefined}>
                  {p.text}
                </Text>
              )
            )
          ) : (
            t('sdk.consent.agree')
          )}
        </Text>
      </View>
      <StepStatus look={look} error={agreed ? undefined : ui.errorMessage} testID={`${testID}-status`} />
      <StepButton
        look={look}
        primary
        title={consentContinueLabel(data)}
        disabled={busy}
        onPress={() => onSubmit({ agreed })}
        testID={`${testID}-continue`}
      />
    </StepCard>
  );
};

export default ConsentStep;
