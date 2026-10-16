// @ts-nocheck
/**
 * An agent's rich message (agent-message-rich, cleaned by
 * core/agentBot.ts safeRich): a help article, quick replies the visitor
 * taps to answer, or a card with an image and a button.
 */
import React, { useContext, useState } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, Linking } from 'react-native';
import { useTheme } from '../../theme';
import ConferBotContext from '../../context/ConferBotContext';
import { Avatar } from '../Avatar';
import { t } from '../../core/i18n';
import { richArticleTarget } from '../../core/agentBot';
import { helpCentreOn } from '../../core/waitArticles';

export const RichAgentMessage: React.FC<{ message: any; testID?: string }> = ({ message, testID }) => {
  const theme = useTheme();
  const ctx = useContext(ConferBotContext);
  const styles = createStyles(theme);
  const rich = message.rich || {};
  const [answered, setAnswered] = useState<string | null>(message.answered || null);
  const open = (url) => url && Linking.openURL(url).catch(() => {});
  const agent = message.agentDetails || {};
  // The article card: its public page, else the article in the app's help
  // centre when it is on (web agentRich.ts openArticle).
  const article = richArticleTarget(rich, helpCentreOn(ctx?.serverCustomizations) && !!ctx?.openArticle);
  const openCard = () => {
    if (article?.kind === 'url') open(article.url);
    else if (article?.kind === 'article') ctx.openArticle(article.id);
  };

  const reply = (label: string) => {
    if (answered || !ctx?.sendMessage) return;
    setAnswered(label);
    ctx.sendMessage(label);
  };

  return (
    <View style={styles.container} testID={testID}>
      <Avatar source={agent.avatar || ctx?.botAvatarUrl || undefined} name={agent.name || t('agent.agent')} size={theme.layout.avatarSize} />
      <View style={styles.body}>
        {rich.kind === 'quick_replies' && (
          <>
            {rich.text || message.text ? (
              <View style={styles.bubble}>
                <Text style={styles.bubbleText}>{rich.text || message.text}</Text>
              </View>
            ) : null}
            <View style={styles.chips} accessibilityLabel={t('chat.quickReplies')}>
              {rich.options.map((o) => (
                <TouchableOpacity
                  key={o}
                  style={[styles.chip, answered === o && styles.chipChosen, answered && answered !== o && styles.chipOff]}
                  onPress={() => reply(o)}
                  disabled={!!answered}
                  accessibilityRole="button"
                >
                  <Text style={[styles.chipText, answered === o && styles.chipChosenText]}>{o}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {rich.kind === 'article' && (
          <TouchableOpacity
            style={styles.card}
            onPress={openCard}
            disabled={!article}
            accessibilityRole={article?.kind === 'article' ? 'button' : 'link'}
            testID={testID ? `${testID}-article` : undefined}
          >
            <Text style={styles.kicker}>{t('kb.helpArticle')}</Text>
            <Text style={styles.title}>{rich.title}</Text>
            {rich.snippet ? <Text style={styles.desc} numberOfLines={3}>{rich.snippet}</Text> : null}
            {article ? <Text style={styles.link}>{t('common.read')} {article.kind === 'url' ? '↗' : '›'}</Text> : null}
          </TouchableOpacity>
        )}

        {rich.kind === 'card' && (
          <View style={[styles.card, { padding: 0, overflow: 'hidden' }]}>
            {rich.imageUrl ? <Image source={{ uri: rich.imageUrl }} style={styles.image} resizeMode="cover" /> : null}
            <View style={{ padding: 12 }}>
              <Text style={styles.title}>{rich.title}</Text>
              {rich.description ? <Text style={styles.desc}>{rich.description}</Text> : null}
              {rich.button ? (
                <TouchableOpacity style={styles.button} onPress={() => open(rich.button.url)} accessibilityRole="link">
                  <Text style={styles.buttonText}>{rich.button.label}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        )}
      </View>
    </View>
  );
};

const createStyles = (theme) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 10,
      marginVertical: theme.spacing.xs,
      marginHorizontal: theme.spacing.chatContentPadding,
    },
    body: { flex: 1, maxWidth: theme.layout.maxBubbleWidth, gap: 6 },
    bubble: {
      alignSelf: 'flex-start',
      backgroundColor: theme.colors.agentBubble,
      paddingHorizontal: theme.spacing.bubblePaddingH,
      paddingVertical: theme.spacing.bubblePaddingV,
      borderRadius: theme.borderRadius.bubble,
      borderBottomLeftRadius: theme.borderRadius.bubbleSmall,
    },
    bubbleText: { color: theme.colors.agentBubbleText, fontSize: theme.typography.fontSize.md },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    chip: {
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: theme.borderRadius.full,
      borderWidth: 1,
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.surface,
    },
    chipChosen: { backgroundColor: theme.colors.primary },
    chipOff: { opacity: 0.45 },
    chipText: { color: theme.colors.primary, fontSize: theme.typography.fontSize.sm, fontWeight: '500' },
    chipChosenText: { color: theme.colors.textInverse },
    card: {
      padding: 12,
      borderRadius: theme.borderRadius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    kicker: { fontSize: theme.typography.fontSize.xs, color: theme.colors.textSecondary, marginBottom: 2 },
    title: { fontSize: theme.typography.fontSize.md, fontWeight: '600', color: theme.colors.text },
    desc: { fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary, marginTop: 4 },
    link: { fontSize: theme.typography.fontSize.sm, color: theme.colors.primary, fontWeight: '600', marginTop: 8 },
    image: { width: '100%', height: 140, backgroundColor: theme.colors.background },
    button: {
      marginTop: 10,
      alignItems: 'center',
      paddingVertical: 9,
      borderRadius: theme.borderRadius.button,
      backgroundColor: theme.colors.primary,
    },
    buttonText: { color: theme.colors.textInverse, fontWeight: '600', fontSize: theme.typography.fontSize.sm },
  });
