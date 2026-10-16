// @ts-nocheck
/**
 * The "While you wait, this might help" card (web
 * conferbot-widget src/ts/chat/waitArticles.ts mountHelpCard, its CSS in
 * src/css/polish.css .cb-wait-articles): in the bot bubble's colours, a row
 * per item (an article opens in the app, a page in the browser) and, for
 * the server's pick, "That solved it". Once the wait is over it stays as
 * history under "Articles that might help". The state is the provider's
 * (core/waitArticles.ts createWaitHelp); nothing moves on its own.
 */
import React, { useContext } from 'react';
import { View, Text, TouchableOpacity, Linking, ActivityIndicator } from 'react-native';
import { useTheme } from '../../theme';
import { mix } from '../../theme/color';
import ConferBotContext from '../../context/ConferBotContext';
import { WAIT_TEXT } from '../../core/waitArticles';

export const WaitHelpCard: React.FC<{ testID?: string }> = ({ testID = 'cb-wait-help' }) => {
  const theme = useTheme();
  const ctx = useContext(ConferBotContext);
  const card = ctx?.waitHelp;
  if (!card || !card.items.length) return null;
  const bg = theme.colors.botBubble;
  const ink = theme.colors.botBubbleText;
  const font = ctx?.customizations?.fontFamily ? { fontFamily: ctx.customizations.fontFamily } : null;
  const indent = theme.layout.avatarSize + 10 + theme.spacing.chatContentPadding;
  const title = card.settled ? WAIT_TEXT.settledTitle : WAIT_TEXT.title;

  return (
    <View style={{ paddingLeft: indent, paddingRight: theme.spacing.chatContentPadding + 12, marginTop: 4, marginBottom: 10 }} testID={testID}>
      <View
        accessibilityRole="none"
        accessibilityLabel={card.settled ? WAIT_TEXT.settledTitle : WAIT_TEXT.label}
        style={{ backgroundColor: bg, borderRadius: 14, padding: 10, gap: 6, alignSelf: 'flex-start', maxWidth: '100%' }}
      >
        <Text style={[{ color: ink, opacity: 0.8, fontSize: 12, fontWeight: '600', marginHorizontal: 2, marginBottom: 2 }, font]} testID={`${testID}-title`}>
          {title}
        </Text>
        {card.items.map((item) => (
          <TouchableOpacity
            key={item.id}
            accessibilityRole={item.kind === 'page' ? 'link' : 'button'}
            accessibilityLabel={`${WAIT_TEXT.read}: ${item.title}`}
            testID={`${testID}-row-${item.id}`}
            onPress={() => {
              ctx?.openHelpItem?.(item);
              if (item.kind === 'page' && item.url) Linking.openURL(item.url).catch(() => {});
            }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, backgroundColor: mix(bg, ink, 0.1) }}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[{ color: ink, fontSize: 13.5, fontWeight: '600', lineHeight: 17.5 }, font]}>{item.title}</Text>
              {item.description ? (
                <Text numberOfLines={2} style={[{ color: ink, opacity: 0.8, fontSize: 12, lineHeight: 16 }, font]}>
                  {item.description}
                </Text>
              ) : null}
            </View>
            <Text style={[{ color: ink, opacity: 0.85, fontSize: 12, fontWeight: '600' }, font]} accessibilityElementsHidden importantForAccessibility="no">
              {WAIT_TEXT.read}
            </Text>
          </TouchableOpacity>
        ))}
        {card.done ? (
          <Text style={[{ color: ink, opacity: 0.85, fontSize: 12, paddingHorizontal: 2, paddingTop: 2 }, font]} accessibilityLiveRegion="polite" testID={`${testID}-done`}>
            {WAIT_TEXT.done}
          </Text>
        ) : card.solvable && !card.settled ? (
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingTop: 2 }}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ disabled: card.busy, busy: card.busy }}
              disabled={card.busy}
              onPress={() => ctx?.solveWait?.()}
              testID={`${testID}-solved`}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingVertical: 6,
                paddingHorizontal: 12,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: mix(bg, ink, 0.45),
                opacity: card.busy ? 0.6 : 1,
              }}
            >
              {card.busy ? <ActivityIndicator size="small" color={ink} /> : null}
              <Text style={[{ color: ink, fontSize: 12.5, fontWeight: '600' }, font]}>{WAIT_TEXT.solved}</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    </View>
  );
};

export default WaitHelpCard;
