/**
 * AddressStep.tsx
 *
 * address-node (web richNodesView renderAddress): type the address and
 * the step's search suggests up to five ({action: "search", q}, 300 ms
 * after typing stops, or at once from the keyboard's search key); a
 * suggestion is shown to confirm (Change / Confirm answers {action:
 * "pick", index}). "Enter it manually" opens the fields (street required)
 * and Confirm answers {action: "manual", line1, city, region, postal,
 * country}. No map and no "Use my location": an app has no browser
 * location or map to show them with.
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { t, tPlural, I18nKey } from '../../../core/i18n';
import { StepButton, StepCard, StepField, StepLink, StepRow, StepStatus, StepViewProps, useStepLook } from './stepKit';

export const ADDRESS_DEBOUNCE_MS = 300;

const MANUAL_FIELDS: Array<[string, I18nKey]> = [
  ['line1', 'address.street'],
  ['city', 'address.city'],
  ['region', 'address.region'],
  ['postal', 'address.postal'],
  ['country', 'address.country'],
];

export const AddressStep: React.FC<StepViewProps> = ({ ui, onSubmit, busy, testID = 'step-address' }) => {
  const look = useStepLook();
  const data = ui.stepData || {};
  const allowManual = ui.allowManualEntry !== false && data.allowManual !== false;
  const results: any[] = Array.isArray(ui.results) ? ui.results : [];
  const [pane, setPane] = useState<'search' | 'manual' | 'confirm'>('search');
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<number | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [searched, setSearched] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = (text: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const query = text.trim();
    if (query.length < 3 || query === searched) return;
    setSearched(query);
    onSubmit({ action: 'search', q: query });
  };

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const typed = (text: string) => {
    setQ(text);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => search(text), ADDRESS_DEBOUNCE_MS);
  };

  if (pane === 'manual') {
    return (
      <StepCard look={look} testID={testID}>
        {MANUAL_FIELDS.map(([f, label]) => (
          <StepField
            key={f}
            look={look}
            label={f === 'line1' ? t(label) : `${t(label)} ${t('common.optional')}`}
            value={fields[f] || ''}
            onChangeText={(v) => setFields((cur) => ({ ...cur, [f]: v }))}
            autoComplete={f === 'line1' ? 'street-address' : f === 'postal' ? 'postal-code' : f === 'country' ? 'country' : 'off'}
            testID={`${testID}-${f}`}
          />
        ))}
        <StepStatus look={look} error={ui.errorMessage} testID={`${testID}-status`} />
        <StepRow end>
          <StepButton look={look} title={t('common.back')} disabled={busy} onPress={() => setPane('search')} testID={`${testID}-back`} />
          <StepButton
            look={look}
            primary
            title={t('action.confirm')}
            disabled={busy}
            onPress={() =>
              onSubmit({
                action: 'manual',
                line1: fields.line1 || '',
                city: fields.city || '',
                region: fields.region || '',
                postal: fields.postal || '',
                country: fields.country || '',
              })
            }
            testID={`${testID}-manual-confirm`}
          />
        </StepRow>
      </StepCard>
    );
  }

  if (pane === 'confirm' && picked !== null && results[picked]) {
    return (
      <StepCard look={look} testID={testID}>
        <Text style={{ color: look.text, fontSize: look.fontSize }} testID={`${testID}-picked`}>
          {results[picked].formatted}
        </Text>
        <StepStatus look={look} error={ui.errorMessage} testID={`${testID}-status`} />
        <StepRow end>
          <StepButton look={look} title={t('common.change')} disabled={busy} onPress={() => setPane('search')} testID={`${testID}-change`} />
          <StepButton look={look} primary title={t('action.confirm')} disabled={busy} onPress={() => onSubmit({ action: 'pick', index: picked })} testID={`${testID}-confirm`} />
        </StepRow>
      </StepCard>
    );
  }

  const showList = results.length > 0 && q.trim() === searched;
  return (
    <StepCard look={look} testID={testID}>
      <StepField
        look={look}
        label={t('address.label')}
        value={q}
        onChangeText={typed}
        placeholder={String(data.placeholder ?? '').trim() || t('address.placeholder')}
        autoComplete="street-address"
        textContentType="fullStreetAddress"
        autoCorrect={false}
        returnKeyType="search"
        onSubmitEditing={() => search(q)}
        testID={`${testID}-query`}
      />
      {showList ? (
        <View style={{ borderWidth: 1, borderColor: look.line, borderRadius: Math.min(look.radius, 10) }} accessibilityRole="list">
          {results.map((r, i) => (
            <TouchableOpacity
              key={`${i}-${r.formatted}`}
              onPress={() => {
                setPicked(i);
                setPane('confirm');
              }}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={r.formatted}
              testID={`${testID}-result-${i}`}
              style={{ paddingVertical: 9, paddingHorizontal: 10, borderTopWidth: i ? 1 : 0, borderTopColor: look.line }}
            >
              <Text style={{ color: look.text, fontSize: look.fontSize }}>{r.formatted}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
      <StepStatus
        look={look}
        error={ui.errorMessage}
        hint={showList ? tPlural('address.suggestions', results.length) : undefined}
        testID={`${testID}-status`}
      />
      {allowManual ? <StepLink look={look} title={t('address.manual')} onPress={() => setPane('manual')} testID={`${testID}-manual`} /> : null}
    </StepCard>
  );
};

export default AddressStep;
