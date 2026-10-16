// @ts-nocheck
/**
 * What goes under an AI agent's reply, as on the web widget: the sources it
 * was grounded in, the pages it points to (buttons), a facts card or an
 * action's result card, an action to confirm, and "Helpful?". Each piece is
 * drawn only when the reply carries it (core/agentBot.ts cleans them).
 */
import React, { useContext, useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Linking, ActivityIndicator } from 'react-native';
import { useTheme } from '../../theme';
import ConferBotContext from '../../context/ConferBotContext';
import { answerFeedbackOn, conversionEventOf, isAIAgentDetails, sourceHost, sourceTarget } from '../../core/agentBot';
import { helpCentreOn } from '../../core/waitArticles';
import { talkToPersonAllowed } from '../../core/handoverState';
import {
  FEEDBACK_REASONS,
  HELPFUL_TEXT,
  THANKS_MS,
  helpfulStart,
  helpfulStep,
  ratedLabel,
  type HelpfulTap,
} from '../../core/answerFeedback';
import { t } from '../../core/i18n';

const OBJECT_ID = /^[a-f0-9]{24}$/i;

/** The newest AI answer that can be rated: only it asks (web: an older unrated one steps aside). */
const newestRateableId = (record: any[]): string | null => {
  for (let i = (record || []).length - 1; i >= 0; i--) {
    const r = record[i];
    const id = String(r?._id || r?.id || '');
    if (r?.type === 'agent-message' && isAIAgentDetails(r?.agentDetails) && !r?.isFallback && OBJECT_ID.test(id)) return id;
  }
  return null;
};

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
  // A help article opens in the app's help centre when it is on (web
  // agentSources.ts), else its public page.
  const canOpenArticles = helpCentreOn(ctx?.serverCustomizations) && !!ctx?.openArticle;
  const go = (s: any) => {
    const target = sourceTarget(s, canOpenArticles);
    if (target?.kind === 'article') ctx.openArticle(target.id);
    else if (target?.kind === 'url') open(target.url);
  };
  const actions = Array.isArray(message.actions) ? message.actions : [];
  const answerId = String(message._id || message.id || '');
  const showHelpful =
    !message.isFallback &&
    OBJECT_ID.test(answerId) &&
    answerFeedbackOn(ctx?.serverCustomizations) &&
    !!ctx?.sendAnswerFeedback &&
    // Rated answers keep their line; only the newest unrated one asks.
    (!!message.feedback || newestRateableId(ctx?.record || []) === answerId);

  if (!sources.length && !actions.length && !message.card && !message.resultCard && !message.actionRequest && !showHelpful) return null;

  return (
    <View style={styles.wrap} testID={testID}>
      {sources.length > 0 && (
        <View style={styles.sources} accessibilityLabel={t('sources.count', { n: sources.length })}>
          {sources.map((s, i) => {
            const target = sourceTarget(s, canOpenArticles);
            return (
              <TouchableOpacity
                key={i}
                style={styles.source}
                onPress={() => go(s)}
                disabled={!target}
                accessibilityRole={target?.kind === 'article' ? 'button' : 'link'}
                accessibilityLabel={`${t('sources.one')}: ${s.title}`}
                testID={testID ? `${testID}-source-${i}` : undefined}
              >
                <Text style={styles.sourceTitle} numberOfLines={1}>{s.title}</Text>
                {target?.kind === 'article' ? (
                  <Text style={styles.sourceHost}>{t('kb.helpArticle')} ›</Text>
                ) : target?.kind === 'url' ? (
                  <Text style={styles.sourceHost}>{sourceHost(target.url)} ↗</Text>
                ) : s.articleId ? (
                  <Text style={styles.sourceHost}>{t('kb.helpArticle')}</Text>
                ) : null}
              </TouchableOpacity>
            );
          })}
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

      {showHelpful && (
        <Helpful
          message={message}
          styles={styles}
          send={ctx.sendAnswerFeedback}
          // "Talk to a person" only while nobody is coming or here (web offerHuman).
          askAsVisitor={talkToPersonAllowed(ctx?.record || []) && ctx?.sendMessage ? (text) => ctx.sendMessage(text) : undefined}
        />
      )}
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
        <Text style={styles.cardLink}>{t('result.seeDetails')} {'↗'}</Text>
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
            {state === 'busy' ? <ActivityIndicator size="small" color={theme.colors.textInverse} /> : <Text style={styles.confirmText}>{t('action.confirm')}</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.decline} onPress={() => answer(false)} disabled={state === 'busy'} accessibilityRole="button">
            <Text style={styles.declineText}>{t('common.notNow')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Text style={styles.settled}>
          {state === 'done' ? t('action.done') : state === 'declined' ? t('action.cancelled') : t('action.failedRetry')}
        </Text>
      )}
    </View>
  );
};

/**
 * "Helpful?" (core/answerFeedback.ts, web answerFeedback.ts): a vote goes
 * the moment it is given - a No too, before any reason - then the reasons,
 * an optional comment, "Talk to a person" and "Ask another way". The rated
 * line's thumbs change the vote.
 */
const Helpful = ({ message, styles, send, askAsVisitor }) => {
  const id = String(message._id || message.id);
  const [state, setState] = useState(() => helpfulStart(message.feedback));
  const [comment, setComment] = useState('');
  const tap = (t: HelpfulTap) => {
    const r = helpfulStep(state, t);
    if (r.send) send(id, r.send);
    if (r.ask) askAsVisitor?.(r.ask);
    setState(r.state);
  };
  // "Thanks for letting us know!", then the quiet rated line.
  useEffect(() => {
    if (state.view !== 'thanks') return;
    const t = setTimeout(() => setState((s) => helpfulStep(s, { kind: 'settle' }).state), THANKS_MS);
    return () => clearTimeout(t);
  }, [state.view]);

  const thumb = (helpful: boolean, pressed = false) => (
    <TouchableOpacity
      key={helpful ? 'up' : 'down'}
      style={[styles.thumb, pressed && styles.thumbPressed]}
      onPress={() => tap({ kind: 'vote', helpful })}
      accessibilityRole="button"
      accessibilityState={{ selected: pressed }}
      accessibilityLabel={state.view === 'rated' ? (helpful ? HELPFUL_TEXT.ratedUp : HELPFUL_TEXT.ratedDown) : helpful ? HELPFUL_TEXT.yes : HELPFUL_TEXT.no}
      testID={`cb-helpful-${helpful ? 'up' : 'down'}`}
    >
      <Text style={[styles.thumbGlyph, !pressed && state.view === 'rated' && styles.thumbIdle]}>{helpful ? '\u{1F44D}' : '\u{1F44E}'}</Text>
    </TouchableOpacity>
  );

  if (state.view === 'thanks') return <Text style={styles.thanks}>{HELPFUL_TEXT.thanks}</Text>;

  if (state.view === 'rated') {
    return (
      <View style={styles.helpful} accessibilityLabel={HELPFUL_TEXT.groupLabel} testID="cb-helpful-rated">
        {thumb(true, state.current?.helpful === true)}
        {thumb(false, state.current?.helpful === false)}
        <Text style={styles.helpfulLabel}>{ratedLabel(state.current)}</Text>
      </View>
    );
  }

  if (state.view === 'down') {
    const reason = state.current?.reason;
    return (
      <View style={styles.downWrap} accessibilityLabel={HELPFUL_TEXT.groupLabel} testID="cb-helpful-down">
        <Text style={styles.helpfulLabel}>{HELPFUL_TEXT.sorry}</Text>
        <View style={styles.reasons} accessibilityRole="radiogroup" accessibilityLabel={HELPFUL_TEXT.whatWentWrong}>
          {FEEDBACK_REASONS.map(([key, label]) => (
            <TouchableOpacity
              key={key}
              style={[styles.reason, reason === key && styles.reasonOn]}
              onPress={() => tap({ kind: 'reason', reason: key })}
              accessibilityRole="radio"
              accessibilityState={{ checked: reason === key }}
              testID={`cb-helpful-reason-${key}`}
            >
              <Text style={[styles.reasonText, reason === key && styles.reasonTextOn]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {state.commented ? (
          <Text style={styles.thanks}>{HELPFUL_TEXT.thanksComment}</Text>
        ) : reason ? (
          <View style={styles.noteRow}>
            <TextInput
              value={comment}
              onChangeText={setComment}
              placeholder={HELPFUL_TEXT.comment}
              accessibilityLabel={HELPFUL_TEXT.comment}
              maxLength={500}
              autoFocus
              returnKeyType="send"
              onSubmitEditing={() => tap({ kind: 'comment', text: comment })}
              style={styles.noteInput}
              testID="cb-helpful-comment"
            />
            <TouchableOpacity
              style={styles.noteSend}
              onPress={() => tap({ kind: 'comment', text: comment })}
              accessibilityRole="button"
              accessibilityLabel={HELPFUL_TEXT.sendFeedback}
              testID="cb-helpful-send"
            >
              <Text style={styles.noteSendText}>{'\u2192'}</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        <View style={styles.reasons}>
          {askAsVisitor ? (
            <TouchableOpacity style={styles.reason} onPress={() => tap({ kind: 'human' })} accessibilityRole="button" testID="cb-helpful-human">
              <Text style={styles.reasonText}>{HELPFUL_TEXT.talkToPerson}</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={styles.reason} onPress={() => tap({ kind: 'retry' })} accessibilityRole="button" testID="cb-helpful-retry">
            <Text style={styles.reasonText}>{HELPFUL_TEXT.retry}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.helpful} accessibilityLabel={HELPFUL_TEXT.groupLabel} testID="cb-helpful-ask">
      <Text style={styles.helpfulLabel}>{HELPFUL_TEXT.ask}</Text>
      {thumb(true)}
      {thumb(false)}
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
    reasonOn: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
    reasonTextOn: { color: theme.colors.textInverse },
    downWrap: { gap: 6 },
    thumb: { paddingVertical: 3, paddingHorizontal: 6, borderRadius: theme.borderRadius.full },
    thumbPressed: { backgroundColor: theme.colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.border },
    thumbGlyph: { fontSize: theme.typography.fontSize.sm },
    thumbIdle: { opacity: 0.45 },
    noteRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    noteInput: {
      flex: 1,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      borderRadius: theme.borderRadius.md,
      paddingHorizontal: 10,
      paddingVertical: 6,
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.text,
      backgroundColor: theme.colors.background,
    },
    noteSend: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: theme.borderRadius.md, backgroundColor: theme.colors.primary },
    noteSendText: { color: theme.colors.textInverse, fontWeight: '700', fontSize: theme.typography.fontSize.sm },
    thanks: { fontSize: theme.typography.fontSize.xs, color: theme.colors.textSecondary },
  });
