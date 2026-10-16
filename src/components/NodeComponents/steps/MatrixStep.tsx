/**
 * MatrixStep.tsx
 *
 * matrix-node (web richNodesView renderMatrix): each row with its columns
 * as options - one per row (radio) or any (check) - with "n of total
 * answered", then Submit, which answers {cells: {rowId: colId | [colIds]}}.
 * A row left out is refused by the step, whose words show above Submit.
 */

import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { matrixColumns, matrixMode, matrixRows, matrixToggle, MatrixSelection } from '../../../core/flow/rich';
import { t } from '../../../core/flow/i18nEn';
import { StepButton, StepCard, StepStatus, StepViewProps, useStepLook } from './stepKit';

/** A tap on a cell: single picks that column for the row, multiple ticks / unticks it. */
export const matrixTap = (sel: MatrixSelection, rowId: string, colId: string, mode: 'single' | 'multiple'): MatrixSelection =>
  matrixToggle(sel, rowId, colId, mode, !(mode === 'multiple' && (sel[rowId] || []).includes(colId)));

/** The answer the step takes. */
export const matrixCells = (sel: MatrixSelection, mode: 'single' | 'multiple'): Record<string, string | string[]> => {
  const out: Record<string, string | string[]> = {};
  Object.entries(sel).forEach(([row, cols]) => {
    if (cols.length) out[row] = mode === 'multiple' ? cols : cols[cols.length - 1];
  });
  return out;
};

export const MatrixStep: React.FC<StepViewProps> = ({ ui, onSubmit, busy, testID = 'step-matrix' }) => {
  const look = useStepLook();
  const data = ui.stepData || {};
  const rows = matrixRows(data);
  const cols = matrixColumns(data);
  const mode = matrixMode(data) as 'single' | 'multiple';
  const [sel, setSel] = useState<MatrixSelection>({});
  const answered = rows.filter((r) => (sel[r.id] || []).length).length;

  return (
    <StepCard look={look} testID={testID}>
      <Text style={{ color: look.muted, fontSize: look.fontSize - 2 }}>
        {mode === 'multiple' ? 'Pick any that apply in each row' : 'Rate each row'}
      </Text>
      {rows.map((r) => (
        <View key={r.id} style={{ gap: 6 }} accessibilityRole={mode === 'multiple' ? undefined : 'radiogroup'} accessibilityLabel={r.text}>
          <Text style={{ color: look.text, fontSize: look.fontSize, fontWeight: '600' }}>{r.text}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {cols.map((c) => {
              const on = (sel[r.id] || []).includes(c.id);
              return (
                <StepButton
                  key={c.id}
                  look={look}
                  title={c.text}
                  picked={on}
                  leading={mode === 'multiple' ? (on ? '☑' : '☐') : on ? '◉' : '○'}
                  disabled={busy}
                  onPress={() => setSel((cur) => matrixTap(cur, r.id, c.id, mode))}
                  accessibilityLabel={`${r.text}: ${c.text}`}
                  testID={`${testID}-${r.id}-${c.id}`}
                  style={{ paddingVertical: 7, paddingHorizontal: 10 }}
                />
              );
            })}
          </View>
        </View>
      ))}
      <StepStatus look={look} error={ui.errorMessage} hint={t('matrix.progress', { n: answered, total: rows.length })} testID={`${testID}-status`} />
      <StepButton
        look={look}
        primary
        title={String(data.submitLabel || '').trim() || 'Submit'}
        disabled={busy}
        onPress={() => onSubmit({ cells: matrixCells(sel, mode) })}
        testID={`${testID}-submit`}
      />
    </StepCard>
  );
};

export default MatrixStep;
