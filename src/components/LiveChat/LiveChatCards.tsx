// @ts-nocheck
/**
 * The small cards and lines of a live chat, as on the web widget: the
 * owner's quick actions and "Talk to a person" above the composer, the AI's
 * follow-up email card, the queue position, the "nobody could join" email
 * ask, leave a message, a locked conversation, an agent's dropped
 * connection, an agent asking for a file, the post-chat rating, "Email me
 * this chat" and the closed chat (blocked, or ended with a new chat).
 */
import React, { useContext, useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Linking, ActivityIndicator } from 'react-native';
import { useTheme } from '../../theme';
import ConferBotContext from '../../context/ConferBotContext';
import { conversionEventOf, isAIAgentDetails, quickActionsOf } from '../../core/agentBot';
import { backAtLabel, isEmail, knownEmail, lastQuestion, maxWaitText, queueLine, secondsLeft, waitCardLines, type CsatConfig } from '../../core/liveChat';
import { MAILCHAT_TEXT, isTranscriptEmail, transcriptEmailError } from '../../core/emailTranscript';
import { LIVE_TEXT, type ClosedState } from '../../core/liveEvents';
import { t } from '../../core/i18n';
import { typicalWait } from '../../core/replyTime';

/** The wait card's lines: the estimate, else the usual wait, else a calm promise (web queueCard.ts). */
const WaitLines: React.FC<{ q: any; ctx: any; s: any }> = ({ q, ctx, s }) => {
  const lines = waitCardLines(q, typicalWait(ctx?.serverCustomizations?.replyTime, q?.typical));
  return (
    <>
      <Text style={s.sub}>{lines.estimate}</Text>
      {lines.typical ? <Text style={s.sub} testID="cb-wait-typical">{lines.typical}</Text> : null}
    </>
  );
};

/**
 * The max-wait countdown on the wait card: "Max wait 1:05", once a second
 * (web queueCard.ts setRemaining). Not a live region: it would talk every
 * second.
 */
const MaxWaitLine: React.FC<{ endsAt: number | null | undefined; s: any }> = ({ endsAt, s }) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!endsAt) return;
    setNow(Date.now());
    const timer = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= endsAt) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [endsAt]);
  if (!endsAt) return null;
  return (
    <Text style={s.sub} testID="cb-wait-countdown" accessibilityLiveRegion="none">
      {maxWaitText(secondsLeft(endsAt, now))}
    </Text>
  );
};

const useStyles = () => {
  const theme = useTheme();
  return { theme, s: createStyles(theme) };
};

/** A card on the theme's surface, past the avatar column. */
const Card: React.FC<{ children: React.ReactNode; testID?: string }> = ({ children, testID }) => {
  const { s } = useStyles();
  return (
    <View style={s.cardWrap} testID={testID}>
      <View style={s.card}>{children}</View>
    </View>
  );
};

const EmailField: React.FC<{
  placeholder?: string;
  button: string;
  onSubmit: (email: string) => Promise<boolean> | boolean | void;
  extraField?: { placeholder: string };
  initialEmail?: string;
  initialExtra?: string;
}> = ({ placeholder = 'you@example.com', button, onSubmit, extraField, initialEmail = '', initialExtra = '' }) => {
  const { theme, s } = useStyles();
  const [email, setEmail] = useState(initialEmail);
  const [extra, setExtra] = useState(initialExtra);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    if (!isEmail(email)) return setError(t('sdk.form.invalidEmail'));
    if (extraField && !extra.trim()) return setError(t('leave.writeMessage'));
    setError(null);
    setBusy(true);
    const ok = await onSubmit(email.trim(), extra.trim());
    setBusy(false);
    if (ok === false) setError(t('sdk.form.notThrough'));
  };
  return (
    <View style={{ gap: 8, marginTop: 8 }}>
      {extraField && (
        <TextInput
          value={extra}
          onChangeText={setExtra}
          placeholder={extraField.placeholder}
          placeholderTextColor={theme.colors.textSecondary}
          multiline
          style={[s.input, { minHeight: 72, textAlignVertical: 'top' }]}
        />
      )}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textSecondary}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          style={[s.input, { flex: 1 }]}
        />
        <TouchableOpacity style={s.primary} onPress={submit} disabled={busy} accessibilityRole="button">
          {busy ? <ActivityIndicator size="small" color={theme.colors.textInverse} /> : <Text style={s.primaryText}>{button}</Text>}
        </TouchableOpacity>
      </View>
      {error ? <Text style={s.error}>{error}</Text> : null}
    </View>
  );
};

/**
 * The owner's quick actions (and "Talk to a person") above the composer,
 * as on the web (quickActions.ts): from the first AI answer on. "Talk to a
 * person" only while no handover is under way and nobody is here
 * (`offerHuman`, core/handoverState.ts talkToPersonAllowed); it goes on tap
 * and never comes back on the strip, and the owner's links stay.
 */
export const QuickActionsStrip: React.FC<{ offerHuman: boolean }> = ({ offerHuman }) => {
  const { s } = useStyles();
  const ctx = useContext(ConferBotContext);
  // Retired once tapped, or once a handover took it off: an AI reply
  // arriving mid-handover cannot bring it back.
  const [humanRetired, setHumanRetired] = useState(false);
  const record = ctx?.record || [];
  const aiAnswered = record.some((r: any) => r?.type === 'agent-message' && isAIAgentDetails(r?.agentDetails));
  const offered = offerHuman && ctx?.serverCustomizations?.chatTalkToHuman === true;
  React.useEffect(() => {
    if (aiAnswered && !offerHuman) setHumanRetired(true);
  }, [aiAnswered, offerHuman]);
  if (!aiAnswered) return null;
  const actions = quickActionsOf(ctx?.serverCustomizations);
  const human = offered && !humanRetired;
  if (!actions.length && !human) return null;
  return (
    <View style={s.strip} accessibilityLabel={t('chat.quickActions')}>
      {actions.map((a) => (
        <TouchableOpacity
          key={a.url}
          style={s.stripButton}
          accessibilityRole="link"
          onPress={() => {
            ctx?.trackGoal?.(`quick-action:${a.label}`, conversionEventOf(a.label, a.url));
            Linking.openURL(a.url).catch(() => {});
          }}
        >
          <Text style={s.stripText}>{a.label} {'↗'}</Text>
        </TouchableOpacity>
      ))}
      {human && (
        <TouchableOpacity
          style={s.stripButton}
          accessibilityRole="button"
          testID="cb-talk-to-person"
          onPress={() => {
            setHumanRetired(true);
            ctx?.sendMessage?.(t('chat.talkToPersonAsk'));
          }}
        >
          <Text style={s.stripText}>{t('chat.talkToPerson')}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

/** The AI saw buying intent and has no email yet: one field. */
export const LeadCard: React.FC = () => {
  const { s } = useStyles();
  const ctx = useContext(ConferBotContext);
  const done = ctx?.leadEmail || null;
  if (!ctx?.leadCardOpen && !done) return null;
  return (
    <Card testID="cb-lead-card">
      {done ? (
        <Text style={s.body}>{t('lead.done', { email: done })}</Text>
      ) : (
        <>
          <Text style={s.title}>{t('lead.title')}</Text>
          <Text style={s.sub}>{t('lead.sub')}</Text>
          <EmailField
            button={t('common.send')}
            onSubmit={(email) => {
              ctx.captureLeadEmail(email);
              return true;
            }}
          />
        </>
      )}
    </Card>
  );
};

/** Where the visitor stands while waiting for a person. */
export const QueueCard: React.FC = () => {
  const { s, theme } = useStyles();
  const ctx = useContext(ConferBotContext);
  const q = ctx?.queue;
  // The handover step's own waiting view shows it while that step is up.
  if (!q || ctx?.currentUIState?.type === 'humanHandover') return null;
  return (
    <Card testID="cb-queue">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <ActivityIndicator size="small" color={theme.colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{queueLine(q)}</Text>
          <WaitLines q={q} ctx={ctx} s={s} />
        </View>
      </View>
    </Card>
  );
};

/**
 * The handover step while it waits for a person: the same compact card as
 * the web widget (where they stand, about how long), not a full panel.
 */
export const HandoverWaitCard: React.FC<{ onCancel?: () => void }> = ({ onCancel }) => {
  const { s, theme } = useStyles();
  const ctx = useContext(ConferBotContext);
  const q = ctx?.queue;
  return (
    <Card testID="cb-handover-wait">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <ActivityIndicator size="small" color={theme.colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{q ? queueLine(q) : t('queue.connecting')}</Text>
          <WaitLines q={q} ctx={ctx} s={s} />
          <MaxWaitLine endsAt={ctx?.waitEndsAt} s={s} />
        </View>
        {onCancel ? (
          <TouchableOpacity onPress={onCancel} accessibilityRole="button" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={[s.sub, { marginTop: 0 }]}>{t('common.cancel')}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </Card>
  );
};

/** Nobody could take the chat: the AI is back, and the team replies by email. */
export const HandoverWaitingCard: React.FC = () => {
  const { s } = useStyles();
  const ctx = useContext(ConferBotContext);
  const w = ctx?.handoverWaiting;
  const [sentTo, setSentTo] = useState<string | null>(null);
  if (!w) return null;
  const back = backAtLabel(w.backAt);
  const line = w.offline
    ? back
      ? t('sdk.waiting.offlineBack', { when: back })
      : t('sdk.waiting.offline')
    : t('sdk.waiting.busy');
  const email = sentTo || w.email;
  return (
    <Card testID="cb-handover-waiting">
      <Text style={s.body}>{line} {email ? t('sdk.waiting.replyTo', { email }) : t('sdk.waiting.leaveEmail')}</Text>
      {!email && w.askEmail && (
        <EmailField
          button={t('common.send')}
          onSubmit={async (value) => {
            const ok = await ctx.shareEmailForReply(value);
            if (ok) setSentTo(value);
            return ok;
          }}
        />
      )}
    </Card>
  );
};

/** No one is available: leave a message, answered by email. */
export const LeaveMessageCard: React.FC = () => {
  const { s } = useStyles();
  const ctx = useContext(ConferBotContext);
  const sentTo = ctx?.leftMessageTo || null;
  if ((!ctx?.noAgentsAvailable && !sentTo) || ctx?.serverCustomizations?.chatLeaveMessage === false) return null;
  return (
    <Card testID="cb-leave-message">
      {sentTo ? (
        <>
          <Text style={s.title}>{t('leave.sent', { email: sentTo })}</Text>
          <Text style={s.sub}>{t('leave.sentSub')}</Text>
        </>
      ) : (
        <>
          <Text style={s.title}>{t('leave.title')}</Text>
          <Text style={s.sub}>{t('leave.sub')}</Text>
          <EmailField
            button={t('common.send')}
            extraField={{ placeholder: t('leave.messagePlaceholder') }}
            // Their email if known, and what they last asked in their own words.
            initialEmail={knownEmail(ctx.chatState?.getUserMetadata?.()?.email, ctx.chatState?.getAnswerVariables?.())}
            initialExtra={lastQuestion(ctx.chatState?.getRecord?.())}
            onSubmit={(email, message) => ctx.leaveMessage(email, message)}
          />
          <TouchableOpacity onPress={ctx.skipLeaveMessage} accessibilityRole="button" style={{ marginTop: 8, alignSelf: 'flex-start' }}>
            <Text style={s.sub}>{t('common.notNow')}</Text>
          </TouchableOpacity>
        </>
      )}
    </Card>
  );
};

/**
 * "Email me this chat" (web emailTranscript.ts): one card, the visitor's
 * email filled in when known; Send, Cancel; the server's reason when it did
 * not go; "Sent! Check your inbox at ..." once it did.
 */
export const EmailTranscriptCard: React.FC = () => {
  const { s, theme } = useStyles();
  const ctx = useContext(ConferBotContext);
  const known = knownEmail(ctx?.chatState?.getUserMetadata?.()?.email, ctx?.chatState?.getAnswerVariables?.()) || '';
  const [email, setEmail] = useState(known);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentTo = ctx?.emailTranscriptSentTo || null;
  if (!ctx?.emailTranscriptOpen && !sentTo) return null;
  if (sentTo) {
    return (
      <Card testID="cb-mailchat">
        <Text style={s.title}>{MAILCHAT_TEXT.sent(sentTo)}</Text>
      </Card>
    );
  }
  const submit = async () => {
    if (!isTranscriptEmail(email)) return setError(MAILCHAT_TEXT.checkEmail);
    setError(null);
    setBusy(true);
    const r = await ctx.emailTranscript(email.trim());
    setBusy(false);
    if (!r?.ok) setError(transcriptEmailError(r));
  };
  return (
    <Card testID="cb-mailchat">
      <Text style={s.title}>{MAILCHAT_TEXT.title}</Text>
      <Text style={s.sub}>{MAILCHAT_TEXT.sub}</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
        <TextInput
          value={email}
          onChangeText={(v) => {
            setEmail(v);
            setError(null);
          }}
          placeholder={MAILCHAT_TEXT.placeholder}
          placeholderTextColor={theme.colors.textSecondary}
          accessibilityLabel={MAILCHAT_TEXT.label}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          maxLength={120}
          onSubmitEditing={submit}
          style={[s.input, { flex: 1 }]}
          testID="cb-mailchat-email"
        />
        <TouchableOpacity style={s.primary} onPress={submit} disabled={busy} accessibilityRole="button" testID="cb-mailchat-send">
          <Text style={s.primaryText}>{busy ? MAILCHAT_TEXT.sending : MAILCHAT_TEXT.send}</Text>
        </TouchableOpacity>
      </View>
      {error ? (
        <Text style={[s.error, { marginTop: 6 }]} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      <TouchableOpacity onPress={ctx.closeEmailTranscript} accessibilityRole="button" style={{ marginTop: 8, alignSelf: 'flex-start' }} testID="cb-mailchat-cancel">
        <Text style={s.sub}>{MAILCHAT_TEXT.cancel}</Text>
      </TouchableOpacity>
    </Card>
  );
};

/**
 * The closed chat (core/liveEvents.ts closedStateOf): a blocked visitor's
 * neutral line, or, under an ended chat's own line, a button to start a
 * new chat.
 */
export const ClosedChatCard: React.FC<{ closed: ClosedState | null; onNewChat?: () => void }> = ({ closed, onNewChat }) => {
  const { s } = useStyles();
  if (!closed) return null;
  return (
    <View style={{ alignItems: 'center', marginVertical: 8, gap: 8 }} testID={`cb-closed-${closed.kind}`} accessibilityRole="summary">
      {/* An ended chat's "Chat has ended" line is in the record already. */}
      {closed.kind === 'blocked' ? (
        <View style={s.systemLine}>
          <Text style={s.systemText}>{closed.text}</Text>
        </View>
      ) : null}
      {closed.newChat && onNewChat ? (
        <TouchableOpacity style={s.primary} onPress={onNewChat} accessibilityRole="button" testID="cb-new-chat">
          <Text style={s.primaryText}>{LIVE_TEXT.newChat}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

/** A centred system line (locked, connection dropped, file asked for). */
export const SystemLine: React.FC<{ text: string; testID?: string }> = ({ text, testID }) => {
  const { s } = useStyles();
  return (
    <View style={s.systemLine} testID={testID}>
      <Text style={s.systemText}>{text}</Text>
    </View>
  );
};

/** An agent asked for a file: the visitor's upload button, once. */
export const FileRequestCard: React.FC<{ onUpload?: () => void }> = ({ onUpload }) => {
  const { s } = useStyles();
  const ctx = useContext(ConferBotContext);
  if (!ctx?.fileRequestedBy) return null;
  return (
    <Card testID="cb-file-request">
      <Text style={s.body}>{t('file.requested', { name: ctx.fileRequestedBy })}</Text>
      {onUpload ? (
        <TouchableOpacity style={[s.primary, { marginTop: 10, alignSelf: 'flex-start' }]} onPress={onUpload} accessibilityRole="button">
          <Text style={s.primaryText}>{t('sdk.file.choose')}</Text>
        </TouchableOpacity>
      ) : null}
    </Card>
  );
};

const FACES = ['\u{1F61E}', '\u{1F615}', '\u{1F610}', '\u{1F642}', '\u{1F604}'];

/** The post-chat rating, from the bot's csatConfig. */
export const CsatCard: React.FC = () => {
  const { s, theme } = useStyles();
  const ctx = useContext(ConferBotContext);
  const config: CsatConfig | null = ctx?.csatConfig;
  const [value, setValue] = useState<number | boolean | null>(null);
  const [feedback, setFeedback] = useState('');
  const sent = ctx?.csatSent === true;
  if (!config || !ctx?.csatOpen) return null;
  if (sent) {
    return (
      <Card testID="cb-csat">
        <Text style={s.title}>{config.thankYouText}</Text>
      </Card>
    );
  }
  const options: (number | boolean)[] =
    config.ratingType === 'thumbs' ? [true, false] : config.ratingType === 'nps' ? Array.from({ length: 11 }, (_, i) => i) : [1, 2, 3, 4, 5];
  const label = (o: number | boolean) =>
    config.ratingType === 'thumbs' ? (o ? t('sdk.csat.yes') : t('sdk.csat.no')) : config.ratingType === 'emoji' ? FACES[(o as number) - 1] : config.ratingType === 'stars' ? '★' : String(o);
  const chosen = (o: number | boolean) =>
    value !== null && (config.ratingType === 'stars' ? (o as number) <= (value as number) : o === value);
  return (
    <Card testID="cb-csat">
      <Text style={s.title}>{config.titleText}</Text>
      <Text style={s.sub}>{config.subtitleText}</Text>
      <View style={[s.ratingRow, config.ratingType === 'nps' && { flexWrap: 'wrap' }]}>
        {options.map((o) => (
          <TouchableOpacity
            key={String(o)}
            onPress={() => setValue(o)}
            accessibilityRole="button"
            accessibilityLabel={config.ratingType === 'stars' ? t('rating.outOf', { n: o as number, max: 5 }) : String(label(o))}
            style={[
              config.ratingType === 'stars' ? s.star : s.ratingPill,
              chosen(o) && config.ratingType !== 'stars' && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
            ]}
          >
            <Text
              style={[
                config.ratingType === 'stars' ? { fontSize: 26, color: chosen(o) ? '#F5A623' : theme.colors.border } : s.ratingText,
                chosen(o) && config.ratingType !== 'stars' && { color: theme.colors.textInverse },
              ]}
            >
              {label(o)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {value !== null && config.showFeedbackInput && (
        <TextInput
          value={feedback}
          onChangeText={setFeedback}
          placeholder={config.feedbackPlaceholder}
          placeholderTextColor={theme.colors.textSecondary}
          multiline
          style={[s.input, { minHeight: 64, textAlignVertical: 'top', marginTop: 10 }]}
        />
      )}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
        <TouchableOpacity
          style={[s.primary, { flex: 1 }, value === null && { opacity: 0.5 }]}
          disabled={value === null}
          onPress={() => {
            ctx.submitRating(value, feedback);
          }}
          accessibilityRole="button"
        >
          <Text style={s.primaryText}>{t('common.send')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.secondary} onPress={ctx.dismissCsat} accessibilityRole="button">
          <Text style={s.secondaryText}>{t('common.notNow')}</Text>
        </TouchableOpacity>
      </View>
    </Card>
  );
};

const createStyles = (theme) =>
  StyleSheet.create({
    cardWrap: {
      marginLeft: theme.layout.avatarSize + 10 + theme.spacing.chatContentPadding,
      marginRight: theme.spacing.chatContentPadding,
      marginVertical: theme.spacing.xs,
    },
    card: {
      padding: 12,
      borderRadius: theme.borderRadius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    title: { fontSize: theme.typography.fontSize.md, fontWeight: '600', color: theme.colors.text },
    sub: { fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary, marginTop: 2 },
    body: { fontSize: theme.typography.fontSize.sm, color: theme.colors.text, lineHeight: theme.typography.fontSize.sm * 1.45 },
    error: { fontSize: theme.typography.fontSize.xs, color: theme.colors.error },
    input: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.borderRadius.md,
      paddingHorizontal: 12,
      paddingVertical: 9,
      fontSize: theme.typography.fontSize.md,
      color: theme.colors.text,
      backgroundColor: theme.colors.background,
    },
    primary: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: theme.borderRadius.button,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryText: { color: theme.colors.textInverse, fontWeight: '600', fontSize: theme.typography.fontSize.sm },
    secondary: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: theme.borderRadius.button,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      alignItems: 'center',
    },
    secondaryText: { color: theme.colors.text, fontSize: theme.typography.fontSize.sm },
    strip: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      paddingHorizontal: theme.spacing.chatContentPadding,
      paddingVertical: 8,
    },
    stripButton: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.botBubble,
    },
    stripText: { color: theme.colors.botBubbleText, fontSize: theme.typography.fontSize.sm, fontWeight: '500' },
    systemLine: { alignSelf: 'center', marginVertical: 8, paddingHorizontal: 12, paddingVertical: 6, borderRadius: theme.borderRadius.full, backgroundColor: theme.colors.systemBubble },
    systemText: { fontSize: theme.typography.fontSize.xs, color: theme.colors.systemBubbleText, textAlign: 'center' },
    ratingRow: { flexDirection: 'row', gap: 6, marginTop: 10 },
    star: { paddingHorizontal: 2 },
    ratingPill: {
      minWidth: 36,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: theme.borderRadius.full,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
    },
    ratingText: { fontSize: theme.typography.fontSize.sm, color: theme.colors.text },
  });
