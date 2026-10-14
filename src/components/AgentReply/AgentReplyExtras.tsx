// @ts-nocheck
/**
 * What goes under an AI agent's reply, as on the web widget: the sources it
 * was grounded in, the pages it points to (buttons), a facts card or an
 * action's result card, an action to confirm, and "Helpful?". Each piece is
 * drawn only when the reply carries it (core/agentBot.ts cleans them).
 */
import React, { useContext, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking, ActivityIndicator } from 'react-native';
import { useTheme } from '../../theme';
import ConferBotContext from '../../context/ConferBotContext';
import { answerFeedbackOn, conversionEventOf, sourceHost } from '../../core/agentBot';

const OBJECT_ID = /^[a-f0-9]{24}$/i;

const REASONS = [
  ['wrong', 'Wrong'],
  ['outdated', 'Outdated'],
  ['unanswered', "Didn't answer"],
  ['other', 'Other'],
] as const;

export interface AgentReplyExtrasProps {
  message: any;
  testID?: string;
}

export const AgentReplyExtras: React.FC<AgentReplyExtrasProps> = ({ message, testID }) => {
  const theme = useTheme();
  const ctx = useContext(ConferBotContext);
  const styles = createStyles(theme);
  const open = (url: string) => url && Linking.openURL(url).catch(() => {});

  const sources = Array.isArray(message.sources) ? message.sources : [];
  const actions = Array.isArray(message.actions) ? message.actions : [];
  const showHelpful =
    !message.isFallback &&
    OBJECT_ID.test(String(message._id || message.id || '')) &&
    answerFeedbackOn(ctx?.serverCustomizations) &&
    !!ctx?.sendAnswerFeedback;

  if (!sources.length && !actions.length && !message.card && !message.resultCard && !message.actionRequest && !showHelpful) return null;

  return (
    <View style={styles.wrap} testID={testID}>
      {sources.length > 0 && (
        <View style={styles.sources} accessibilityLabel="Sources">
          {sources.map((s, i) => (
            <TouchableOpacity
              key={i}
              style={styles.source}
              onPress={() => open(s.url)}
              disabled={!s.url}
              accessibilityRole="link"
              accessibilityLabel={`Source: ${s.title}`}
            >
              <Text style={styles.sourceTitle} numberOfLines={1}>{s.title}</Text>
              {s.url ? <Text style={styles.sourceHost}>{sourceHost(s.url)} ↗</Text> : null}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {message.card && <FactsCard card={message.card} styles={styles} open={open} />}
      {message.resultCard && <ResultCard card={message.resultCard} styles={styles} theme={theme} open={open} />}
      {message.actionRequest && <ActionCard request={message.actionRequest} styles={styles} theme={theme} decide={ctx?.decideAction} />}

      {actions.length > 0 && (
        <View style={styles.actions}>
          {actions.map((a, i) => (
            <TouchableOpacity
              key={i}
              style={styles.action}
              onPress={() => {
                ctx?.trackGoal?.(`answer-action:${a.label}`, conversionEventOf(a.label, a.url));
                open(a.url);
              }}
              accessibilityRole="link"
            >
              <Text style={styles.actionText}>{a.label} {'↗'}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {showHelpful && <Helpful message={message} styles={styles} send={ctx.sendAnswerFeedback} />}
    </View>
  );
};

const FactsCard = ({ card, styles, open }) => (
  <View style={styles.card}>
    {card.title ? <Text style={styles.cardTitle}>{card.title}</Text> : null}
    {card.rows.map(([k, v], i) => (
      <View key={i} style={[styles.row, i > 0 && styles.rowDivider]}>
        <Text style={styles.rowLabel}>{k}</Text>
        <Text style={styles.rowValue}>{v}</Text>
      </View>
    ))}
    {card.note ? <Text style={styles.cardNote}>{card.note}</Text> : null}
    {card.url ? (
      <TouchableOpacity onPress={() => open(card.url)} accessibilityRole="link">
        <Text style={styles.cardLink}>Learn more {'↗'}</Text>
      </TouchableOpacity>
    ) : null}
  </View>
);

const TONE = (theme) => ({ done: theme.colors.success, moving: theme.colors.info, problem: theme.colors.error, neutral: theme.colors.textSecondary });

const ResultCard = ({ card, styles, theme, open }) => (
  <View style={styles.card}>
    <View style={styles.resultHead}>
      <Text style={[styles.cardTitle, { flex: 1, marginBottom: 0 }]}>{card.title}</Text>
      {card.status ? (
        <View style={[styles.status, { borderColor: TONE(theme)[card.tone] }]}>
          <Text style={[styles.statusText, { color: TONE(theme)[card.tone] }]}>{card.status}</Text>
        </View>
      ) : null}
    </View>
    {card.rows.map(([k, v], i) => (
      <View key={i} style={[styles.row, styles.rowDivider]}>
        <Text style={styles.rowLabel}>{k}</Text>
        <Text style={styles.rowValue}>{v}</Text>
      </View>
    ))}
    {card.link ? (
      <TouchableOpacity onPress={() => open(card.link.url)} accessibilityRole="link">
        <Text style={styles.cardLink}>{card.link.label} {'↗'}</Text>
      </TouchableOpacity>
    ) : null}
  </View>
);

const ActionCard = ({ request, styles, theme, decide }) => {
  const [state, setState] = useState<'ask' | 'busy' | 'done' | 'declined' | 'failed'>('ask');
  const answer = async (accept: boolean) => {
    if (!decide || state !== 'ask') return;
    setState('busy');
    const res = await decide(request.token, accept);
    setState(res?.ok ? (accept ? 'done' : 'declined') : res?.code === 'declined' ? 'declined' : 'failed');
  };
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{request.name}</Text>
      {request.summary.map((l, i) => (
        <View key={i} style={[styles.row, i > 0 && styles.rowDivider]}>
          <Text style={styles.rowLabel}>{l.label}</Text>
          <Text style={styles.rowValue}>{l.value}</Text>
        </View>
      ))}
      {state === 'ask' || state === 'busy' ? (
        <View style={styles.decide}>
          <TouchableOpacity style={styles.confirm} onPress={() => answer(true)} disabled={state === 'busy'} accessibilityRole="button">
            {state === 'busy' ? <ActivityIndicator size="small" color={theme.colors.textInverse} /> : <Text style={styles.confirmText}>Confirm</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.decline} onPress={() => answer(false)} disabled={state === 'busy'} accessibilityRole="button">
            <Text style={styles.declineText}>Not now</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Text style={styles.settled}>
          {state === 'done' ? 'Confirmed' : state === 'declined' ? 'Not now' : 'That did not go through. Please ask again.'}
        </Text>
      )}
    </View>
  );
};

const Helpful = ({ message, styles, send }) => {
  const given = message.feedback;
  const [askWhy, setAskWhy] = useState(false);
  const id = String(message._id || message.id);
  if (given) {
    return <Text style={styles.thanks}>{given.helpful ? 'Thanks, glad it helped' : 'Thanks for telling us'}</Text>;
  }
  if (askWhy) {
    return (
      <View style={styles.reasons}>
        <Text style={styles.helpfulLabel}>What was wrong?</Text>
        {REASONS.map(([key, label]) => (
          <TouchableOpacity key={key} style={styles.reason} onPress={() => send(id, { helpful: false, reason: key })} accessibilityRole="button">
            <Text style={styles.reasonText}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  }
  return (
    <View style={styles.helpful}>
      <Text style={styles.helpfulLabel}>Helpful?</Text>
      <TouchableOpacity style={styles.reason} onPress={() => send(id, { helpful: true })} accessibilityRole="button" accessibilityLabel="Helpful">
        <Text style={styles.reasonText}>Yes</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.reason} onPress={() => setAskWhy(true)} accessibilityRole="button" accessibilityLabel="Not helpful">
        <Text style={styles.reasonText}>No</Text>
      </TouchableOpacity>
    </View>
  );
};

const createStyles = (theme) =>
  StyleSheet.create({
    wrap: {
      marginLeft: theme.layout.avatarSize + 10 + theme.spacing.chatContentPadding,
      marginRight: theme.spacing.chatContentPadding,
      marginTop: 2,
      marginBottom: theme.spacing.xs,
      maxWidth: theme.layout.maxBubbleWidth,
      gap: 6,
    },
    sources: { gap: 4 },
    source: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: theme.borderRadius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    sourceTitle: { flexShrink: 1, fontSize: theme.typography.fontSize.sm, color: theme.colors.text, fontWeight: '500' },
    sourceHost: { fontSize: theme.typography.fontSize.xs, color: theme.colors.textSecondary },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    action: {
      paddingVertical: 7,
      paddingHorizontal: 12,
      borderRadius: theme.borderRadius.full,
      borderWidth: 1,
      borderColor: theme.colors.primary,
    },
    actionText: { fontSize: theme.typography.fontSize.sm, color: theme.colors.primary, fontWeight: '600' },
    card: {
      padding: 12,
      borderRadius: theme.borderRadius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    cardTitle: { fontSize: theme.typography.fontSize.md, fontWeight: '600', color: theme.colors.text, marginBottom: 6 },
    row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, gap: 12 },
    rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.divider },
    rowLabel: { fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary, flexShrink: 1 },
    rowValue: { fontSize: theme.typography.fontSize.sm, color: theme.colors.text, fontWeight: '500', flexShrink: 1, textAlign: 'right' },
    cardNote: { fontSize: theme.typography.fontSize.xs, color: theme.colors.textSecondary, marginTop: 6 },
    cardLink: { fontSize: theme.typography.fontSize.sm, color: theme.colors.primary, fontWeight: '600', marginTop: 8 },
    resultHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
    status: { borderWidth: 1, borderRadius: theme.borderRadius.full, paddingHorizontal: 8, paddingVertical: 2 },
    statusText: { fontSize: theme.typography.fontSize.xs, fontWeight: '600' },
    decide: { flexDirection: 'row', gap: 8, marginTop: 10 },
    confirm: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 9,
      borderRadius: theme.borderRadius.button,
      backgroundColor: theme.colors.primary,
    },
    confirmText: { color: theme.colors.textInverse, fontWeight: '600', fontSize: theme.typography.fontSize.sm },
    decline: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 9,
      borderRadius: theme.borderRadius.button,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
    },
    declineText: { color: theme.colors.text, fontWeight: '500', fontSize: theme.typography.fontSize.sm },
    settled: { marginTop: 8, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary },
    helpful: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    helpfulLabel: { fontSize: theme.typography.fontSize.xs, color: theme.colors.textSecondary, marginRight: 4 },
    reasons: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
    reason: {
      paddingVertical: 4,
      paddingHorizontal: 10,
      borderRadius: theme.borderRadius.full,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
    },
    reasonText: { fontSize: theme.typography.fontSize.xs, color: theme.colors.text },
    thanks: { fontSize: theme.typography.fontSize.xs, color: theme.colors.textSecondary },
  });
