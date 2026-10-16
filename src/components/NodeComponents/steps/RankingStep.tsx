/**
 * RankingStep.tsx
 *
 * ranking-node (web richNodesView renderRanking): the items in order, each
 * dragged by its handle or moved with its up / down buttons ("Drag to
 * reorder, or use the arrows."), then Submit, which answers {order: ids}.
 * The row follows the finger while dragged and drops into place; nothing
 * else moves.
 */

import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { moveItem, rankingAnnouncement, submitLabel, RankItem } from '../../../core/flow/rich';
import { t } from '../../../core/i18n';
import { StepButton, StepCard, StepViewProps, useStepLook } from './stepKit';

const ROW_GAP = 6;

/** Where a row dragged by `dy` from `from` lands (rows `rowHeight` apart). */
export const dragTarget = (from: number, dy: number, rowHeight: number, count: number): number => {
  if (!(rowHeight > 0) || count < 1) return from;
  return Math.max(0, Math.min(count - 1, from + Math.round(dy / rowHeight)));
};

export const RankingStep: React.FC<StepViewProps> = ({ ui, onSubmit, busy, testID = 'step-ranking' }) => {
  const look = useStepLook();
  const start: RankItem[] = Array.isArray(ui.items) ? ui.items : (ui.buttons || []).map((b: any) => ({ id: String(b.id), text: b.label }));
  const [order, setOrder] = useState<RankItem[]>(start);
  const [said, setSaid] = useState('');
  const [drag, setDrag] = useState<{ id: string; dy: number } | null>(null);
  const rowHeight = useRef(0);
  const startY = useRef(0);

  const move = (id: string, to: number) => {
    setOrder((cur) => {
      const from = cur.findIndex((it) => it.id === id);
      const next = moveItem(cur, from, Math.max(0, Math.min(cur.length - 1, to)));
      if (next !== cur) {
        const i = next.findIndex((it) => it.id === id);
        setSaid(rankingAnnouncement(next[i], i, next.length));
      }
      return next;
    });
  };

  return (
    <StepCard look={look} testID={testID}>
      <Text style={{ color: look.muted, fontSize: look.fontSize - 2 }}>{t('ranking.help')}</Text>
      <View style={{ gap: ROW_GAP }} accessibilityRole="list">
        {order.map((it, i) => {
          const dragging = drag?.id === it.id;
          return (
            <View
              key={it.id}
              onLayout={(e) => {
                rowHeight.current = e.nativeEvent.layout.height + ROW_GAP;
              }}
              accessibilityLabel={t('ranking.position', { item: it.text, n: i + 1, total: order.length })}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                paddingVertical: 8,
                paddingHorizontal: 10,
                borderRadius: Math.min(look.radius, 10),
                backgroundColor: look.option,
                borderWidth: 1,
                borderColor: dragging ? look.accent : 'transparent',
                zIndex: dragging ? 2 : 0,
                transform: dragging ? [{ translateY: drag!.dy }] : undefined,
              }}
              testID={`${testID}-row-${it.id}`}
            >
              {/* The handle: hold and drag */}
              <View
                onStartShouldSetResponder={() => !busy}
                onMoveShouldSetResponder={() => !busy}
                onResponderTerminationRequest={() => false}
                onResponderGrant={(e) => {
                  startY.current = e.nativeEvent.pageY;
                  setDrag({ id: it.id, dy: 0 });
                }}
                onResponderMove={(e) => setDrag({ id: it.id, dy: e.nativeEvent.pageY - startY.current })}
                onResponderRelease={(e) => {
                  const dy = e.nativeEvent.pageY - startY.current;
                  setDrag(null);
                  move(it.id, dragTarget(i, dy, rowHeight.current, order.length));
                }}
                onResponderTerminate={() => setDrag(null)}
                accessibilityLabel={t('sdk.ranking.drag', { item: it.text })}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                testID={`${testID}-handle-${it.id}`}
              >
                <Text style={{ color: look.muted, fontSize: 16 }}>≡</Text>
              </View>
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: look.accent,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: look.accentInk, fontSize: 12, fontWeight: '700' }}>{i + 1}</Text>
              </View>
              <Text style={{ flex: 1, color: look.optionInk, fontSize: look.fontSize }}>{it.text}</Text>
              <TouchableOpacity
                onPress={() => move(it.id, i - 1)}
                disabled={busy || i === 0}
                accessibilityLabel={t('ranking.moveUp', { item: it.text })}
                testID={`${testID}-up-${it.id}`}
                style={{ padding: 4, opacity: i === 0 ? 0.3 : 1 }}
              >
                <Text style={{ color: look.accent, fontSize: 14 }}>▲</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => move(it.id, i + 1)}
                disabled={busy || i === order.length - 1}
                accessibilityLabel={t('ranking.moveDown', { item: it.text })}
                testID={`${testID}-down-${it.id}`}
                style={{ padding: 4, opacity: i === order.length - 1 ? 0.3 : 1 }}
              >
                <Text style={{ color: look.accent, fontSize: 14 }}>▼</Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </View>
      {said ? (
        <Text accessibilityLiveRegion="polite" style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}>
          {said}
        </Text>
      ) : null}
      <StepButton
        look={look}
        primary
        title={submitLabel(ui.stepData || {})}
        disabled={busy}
        onPress={() => onSubmit({ order: order.map((it) => it.id) })}
        testID={`${testID}-submit`}
      />
    </StepCard>
  );
};

export default RankingStep;
