// @ts-nocheck
/**
 * The small cards and lines of a live chat, as on the web widget: the
 * owner's quick actions and "Talk to a person" above the composer, the AI's
 * follow-up email card, the queue position, the "nobody could join" email
 * ask, leave a message, a locked conversation, an agent's dropped
 * connection, an agent asking for a file, and the post-chat rating.
 */
import React, { useContext, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Linking, ActivityIndicator } from 'react-native';
import { useTheme } from '../../theme';
import ConferBotContext from '../../context/ConferBotContext';
import { conversionEventOf, isAIAgentDetails, quickActionsOf } from '../../core/agentBot';
import { backAtLabel, isEmail, knownEmail, lastQuestion, queueLine, type CsatConfig } from '../../core/liveChat';

const TALK_TO_PERSON_ASK = "I'd like to talk to a person, please.";

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
    if (!isEmail(email)) return setError('Please enter a valid email.');
    if (extraField && !extra.trim()) return setError('Please write a short message.');
    setError(null);
    setBusy(true);
    const ok = await onSubmit(email.trim(), extra.trim());
    setBusy(false);
    if (ok === false) setError('That did not go through. Please try again.');
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

/** The owner's quick actions (and "Talk to a person") above the composer. */
export const QuickActionsStrip: React.FC<{ offerHuman: boolean }> = ({ offerHuman }) => {
  const { s } = useStyles();
  const ctx = useContext(ConferBotContext);
  // As on the web: from the first AI answer on, and gone once a person answers.
  const record = ctx?.record || [];
  const aiAnswered = record.some((r: any) => r?.type === 'agent-message' && isAIAgentDetails(r?.agentDetails));
  const agent: any = ctx?.currentAgent;
  const personHere = !!agent && agent.isAIAgent !== true && !String(agent.id || '').startsWith('ai-agent-');
  if (!aiAnswered || personHere) return null;
  const actions = quickActionsOf(ctx?.serverCustomizations);
  const human = offerHuman && ctx?.serverCustomizations?.chatTalkToHuman === true;
  if (!actions.length && !human) return null;
  return (
    <View style={s.strip} accessibilityLabel="Quick actions">
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
        <TouchableOpacity style={s.stripButton} accessibilityRole="button" onPress={() => ctx?.sendMessage?.(TALK_TO_PERSON_ASK)}>
          <Text style={s.stripText}>Talk to a person</Text>
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
        <Text style={s.body}>Thanks! We'll follow up at {done}</Text>
      ) : (
        <>
          <Text style={s.title}>Want us to follow up?</Text>
          <Text style={s.sub}>Leave your email and the team will get back to you.</Text>
          <EmailField
            button="Send"
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
          <Text style={s.sub}>{q.estimateLabel || 'Our team will be with you soon'}</Text>
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
          <Text style={s.title}>{q ? queueLine(q) : 'Connecting you to the team'}</Text>
          <Text style={s.sub}>{q?.estimateLabel || 'Our team will be with you soon'}</Text>
        </View>
        {onCancel ? (
          <TouchableOpacity onPress={onCancel} accessibilityRole="button" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={[s.sub, { marginTop: 0 }]}>Cancel</Text>
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
    ? `The team is offline right now${back ? `, back around ${back}` : ''}.`
    : "Everyone's busy right now.";
  const email = sentTo || w.email;
  return (
    <Card testID="cb-handover-waiting">
      <Text style={s.body}>{line} {email ? `They'll reply to ${email}.` : 'Leave your email and they will reply.'}</Text>
      {!email && w.askEmail && (
        <EmailField
          button="Send"
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
          <Text style={s.title}>Message sent. We'll reply to you at {sentTo}.</Text>
          <Text style={s.sub}>Replies will reach your inbox, and show here if you come back.</Text>
        </>
      ) : (
        <>
          <Text style={s.title}>Leave a message</Text>
          <Text style={s.sub}>No one is available right now. We'll reply by email.</Text>
          <EmailField
            button="Send"
            extraField={{ placeholder: 'How can we help?' }}
            // Their email if known, and what they last asked in their own words.
            initialEmail={knownEmail(ctx.chatState?.getUserMetadata?.()?.email, ctx.chatState?.getAnswerVariables?.())}
            initialExtra={lastQuestion(ctx.chatState?.getRecord?.())}
            onSubmit={(email, message) => ctx.leaveMessage(email, message)}
          />
          <TouchableOpacity onPress={ctx.skipLeaveMessage} accessibilityRole="button" style={{ marginTop: 8, alignSelf: 'flex-start' }}>
            <Text style={s.sub}>Not now</Text>
          </TouchableOpacity>
        </>
      )}
    </Card>
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
      <Text style={s.body}>{ctx.fileRequestedBy} asked you to send a file</Text>
      {onUpload ? (
        <TouchableOpacity style={[s.primary, { marginTop: 10, alignSelf: 'flex-start' }]} onPress={onUpload} accessibilityRole="button">
          <Text style={s.primaryText}>Choose a file</Text>
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
    config.ratingType === 'thumbs' ? (o ? 'Yes' : 'No') : config.ratingType === 'emoji' ? FACES[(o as number) - 1] : config.ratingType === 'stars' ? '★' : String(o);
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
            accessibilityLabel={config.ratingType === 'stars' ? `${o} out of 5` : String(label(o))}
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
          <Text style={s.primaryText}>Send</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.secondary} onPress={ctx.dismissCsat} accessibilityRole="button">
          <Text style={s.secondaryText}>Not now</Text>
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
