/**
 * DateTimeStep.tsx
 *
 * datetime-node (web richNodesView renderDateTime): a date (a month to
 * pick a day from, days outside minDate / maxDate off), a time (hours and
 * minutes on the step's timeStep, from minTime) or both, the closed days
 * said up front, then Send, which answers {value} ("2026-10-19", "14:30",
 * "2026-10-19T14:30"). A closed weekday or a time outside the hours is
 * refused by the step, whose words show above Send - as the web's input.
 */

import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { closedDaysNote, dateMode, disabledWeekdaysOf, resolveDateBound, submitLabel, ymd } from '../../../core/flow/rich';
import { StepButton, StepCard, StepLook, StepStatus, StepViewProps, useStepLook } from './stepKit';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const pad2 = (n: number) => String(n).padStart(2, '0');

/** Minutes past midnight as "HH:MM". */
export const hhmm = (minutes: number): string => {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
};

/** The time step in minutes (web dateInputAttrs: timeStep, 30 by default, 1-720). */
export const timeStepOf = (data: any): number => {
  const n = Math.floor(Number(data?.timeStep));
  return Number.isFinite(n) && n >= 1 ? Math.min(720, n) : 30;
};

/** Where the time starts: minTime, else 09:00. */
export const startMinutes = (data: any): number => {
  const m = TIME_RE.exec(String(data?.minTime || ''));
  return m ? Number(m[1]) * 60 + Number(m[2]) : 9 * 60;
};

/** The answer for a mode: the day, the time, or both. */
export const dateTimeValue = (mode: string, day: string | null, minutes: number): string =>
  mode === 'time' ? hhmm(minutes) : mode === 'datetime' ? (day ? `${day}T${hhmm(minutes)}` : '') : day || '';

const Stepper: React.FC<{ look: StepLook; label: string; value: string; onStep: (dir: number) => void; testID: string; disabled?: boolean }> = ({
  look,
  label,
  value,
  onStep,
  testID,
  disabled,
}) => (
  <View style={{ alignItems: 'center', gap: 4 }} accessible accessibilityRole="adjustable" accessibilityLabel={label} accessibilityValue={{ text: value }}
    accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
    onAccessibilityAction={(e) => onStep(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
  >
    <TouchableOpacity onPress={() => onStep(1)} disabled={disabled} accessibilityLabel={`${label} up`} testID={`${testID}-up`} style={{ padding: 4 }}>
      <Text style={{ color: look.accent, fontSize: 14 }}>▲</Text>
    </TouchableOpacity>
    <Text style={{ color: look.text, fontSize: look.fontSize + 8, fontWeight: '600', minWidth: 40, textAlign: 'center' }}>{value}</Text>
    <TouchableOpacity onPress={() => onStep(-1)} disabled={disabled} accessibilityLabel={`${label} down`} testID={`${testID}-down`} style={{ padding: 4 }}>
      <Text style={{ color: look.accent, fontSize: 14 }}>▼</Text>
    </TouchableOpacity>
  </View>
);

export const DateTimeStep: React.FC<StepViewProps> = ({ ui, onSubmit, busy, testID = 'step-datetime' }) => {
  const look = useStepLook();
  const data = ui.stepData || {};
  const mode = dateMode(data);
  const today = new Date();
  const min = resolveDateBound(data.minDate, today);
  const max = resolveDateBound(data.maxDate, today);
  const closed = disabledWeekdaysOf(data);
  const first = min && min > ymd(today) ? new Date(Number(min.slice(0, 4)), Number(min.slice(5, 7)) - 1, 1) : new Date(today.getFullYear(), today.getMonth(), 1);
  const [month, setMonth] = useState({ y: first.getFullYear(), m: first.getMonth() });
  const [day, setDay] = useState<string | null>(null);
  const [minutes, setMinutes] = useState(() => startMinutes(data));
  const step = timeStepOf(data);

  const cells = useMemo(() => {
    const lead = new Date(month.y, month.m, 1).getDay();
    const count = new Date(month.y, month.m + 1, 0).getDate();
    return [...Array(lead).fill(null), ...Array.from({ length: count }, (_, i) => ymd(new Date(month.y, month.m, i + 1)))];
  }, [month]);

  const shift = (dir: number) => setMonth((c) => ({ y: c.m + dir < 0 ? c.y - 1 : c.m + dir > 11 ? c.y + 1 : c.y, m: (c.m + dir + 12) % 12 }));
  const monthKey = `${month.y}-${pad2(month.m + 1)}`;
  const canBack = !min || monthKey > min.slice(0, 7);
  const canNext = !max || monthKey < max.slice(0, 7);

  return (
    <StepCard look={look} testID={testID}>
      {mode !== 'time' ? (
        <View style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <TouchableOpacity onPress={() => canBack && shift(-1)} disabled={!canBack} accessibilityLabel="Previous month" testID={`${testID}-prev`} style={{ padding: 6, opacity: canBack ? 1 : 0.3 }}>
              <Text style={{ color: look.accent, fontSize: 16 }}>‹</Text>
            </TouchableOpacity>
            <Text style={{ color: look.text, fontSize: look.fontSize, fontWeight: '600' }} testID={`${testID}-month`}>
              {`${MONTHS[month.m]} ${month.y}`}
            </Text>
            <TouchableOpacity onPress={() => canNext && shift(1)} disabled={!canNext} accessibilityLabel="Next month" testID={`${testID}-next`} style={{ padding: 6, opacity: canNext ? 1 : 0.3 }}>
              <Text style={{ color: look.accent, fontSize: 16 }}>›</Text>
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {DAYS.map((d, i) => (
              <Text key={`h${i}`} style={{ width: `${100 / 7}%`, textAlign: 'center', color: look.muted, fontSize: look.fontSize - 3 }}>
                {d}
              </Text>
            ))}
            {cells.map((key, i) => {
              if (!key) return <View key={`e${i}`} style={{ width: `${100 / 7}%`, height: 36 }} />;
              const off = (!!min && key < min) || (!!max && key > max);
              const isClosed = closed.includes(new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10))).getDay());
              const on = key === day;
              return (
                <TouchableOpacity
                  key={key}
                  onPress={() => !off && setDay(key)}
                  disabled={off || busy}
                  accessibilityRole="button"
                  accessibilityLabel={key}
                  accessibilityState={{ selected: on, disabled: off }}
                  testID={`${testID}-day-${key}`}
                  style={{ width: `${100 / 7}%`, height: 36, alignItems: 'center', justifyContent: 'center' }}
                >
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: on ? look.accent : 'transparent',
                    }}
                  >
                    <Text style={{ color: on ? look.accentInk : off || isClosed ? look.muted : look.text, opacity: off ? 0.35 : 1, fontSize: look.fontSize - 1 }}>
                      {Number(key.slice(8, 10))}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ) : null}
      {mode !== 'date' ? (
        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 }}>
          <Stepper look={look} label="Hours" value={hhmm(minutes).slice(0, 2)} onStep={(d) => setMinutes((m) => m + d * 60)} testID={`${testID}-hour`} disabled={busy} />
          <Text style={{ color: look.text, fontSize: look.fontSize + 8, fontWeight: '600' }}>:</Text>
          <Stepper look={look} label="Minutes" value={hhmm(minutes).slice(3)} onStep={(d) => setMinutes((m) => m + d * step)} testID={`${testID}-minute`} disabled={busy} />
        </View>
      ) : null}
      <StepStatus look={look} error={ui.errorMessage} hint={closedDaysNote(data)} testID={`${testID}-status`} />
      <StepButton
        look={look}
        primary
        title={submitLabel(data)}
        disabled={busy}
        onPress={() => onSubmit({ value: dateTimeValue(mode, day, ((minutes % 1440) + 1440) % 1440) })}
        testID={`${testID}-submit`}
      />
    </StepCard>
  );
};

export default DateTimeStep;
