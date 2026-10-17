// @ts-nocheck
/**
 * "Your requests": the screens (web conferbot-widget
 * src/ts/home/requests/view.ts, its CSS src/css/polish-requests.css). Draws
 * the provider's portal state (core/requestsPortal.ts) over whatever it is
 * placed in: the list, one request with its banner, the conversation and
 * the reply box. Back (and Android's back button) goes one step back.
 *
 * Calm: the theme's page, card and ink, the bot's font, one accent for the
 * Back link, the visitor's bubbles and Send (core/requests.ts
 * requestsAccent, the web's --cb-accent). It slides in 14pt over 220ms
 * unless reduced motion is on, and stays still after.
 */
import React, { useContext, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Linking,
  BackHandler,
  Animated,
  Easing,
  AccessibilityInfo,
  Platform,
} from 'react-native';
import { useTheme } from '../../theme';
import { mix } from '../../theme/color';
import ConferBotContext from '../../context/ConferBotContext';
import {
  MAX_REPLY,
  REQUESTS_TEXT,
  isNewReply,
  linkRuns,
  requestsAccent,
  rowLine,
  stateOf,
  whenWords,
} from '../../core/requests';
import { useRequestsOf } from '../../hooks/useRequests';
import { loadSvg } from '../../optional/svg';

let SvgXml: any = null;
try {
  SvgXml = loadSvg().SvgXml;
} catch {
  SvgXml = null;
}

/** The web's state icons (view.ts STATE_ICONS). */
const STATE_ICONS = {
  replied:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12z"/><path d="M8.5 11h7M8.5 14.5h4"/></svg>',
  waiting:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  solved:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.6 2.6L16 9.6"/></svg>',
};
const GLYPHS = { replied: '…', waiting: '◷', solved: '✓' };
const SOLVED = '#16a34a';
const ERROR = '#dc2626';

/** A request's state icon (also the home screen's requests card). */
export const StateIcon = ({ state, color }) =>
  SvgXml ? (
    <SvgXml xml={STATE_ICONS[state].replace(/currentColor/g, color)} width={20} height={20} />
  ) : (
    <Text style={{ color, fontSize: 16, fontWeight: '700' }}>{GLYPHS[state]}</Text>
  );

/** Text with its links tappable (view.ts appendText). */
const Linked = ({ text, style }) => (
  <Text style={style} selectable>
    {linkRuns(text).map((run, i) =>
      run.url ? (
        <Text key={i} style={{ textDecorationLine: 'underline' }} accessibilityRole="link" onPress={() => Linking.openURL(run.url).catch(() => {})}>
          {run.text}
        </Text>
      ) : (
        run.text
      )
    )}
  </Text>
);

export interface RequestsPortalProps {
  testID?: string;
  style?: any;
}

const PortalView: React.FC<RequestsPortalProps> = ({ testID = 'cb-requests', style }) => {
  const theme = useTheme();
  const ctx = useContext(ConferBotContext);
  const r = useRequestsOf(ctx);
  const s = r.state;
  const open = !!s && s.screen !== 'closed';
  const scroll = useRef<any>(null);
  const slide = useRef(new Animated.Value(0)).current;
  const [focused, setFocused] = useState(false);

  // In from the side, once per opening; still with reduced motion.
  useEffect(() => {
    if (!open) return;
    slide.setValue(0);
    let gone = false;
    let reduceMotion: Promise<any>;
    try {
      reduceMotion = Promise.resolve((AccessibilityInfo as any)?.isReduceMotionEnabled?.());
    } catch {
      reduceMotion = Promise.resolve(false);
    }
    reduceMotion
      .catch(() => false)
      .then((reduce) => {
        if (gone) return;
        if (reduce) slide.setValue(1);
        else Animated.timing(slide, { toValue: 1, duration: 220, easing: Easing.bezier(0.22, 1, 0.36, 1), useNativeDriver: true }).start();
      });
    return () => {
      gone = true;
    };
  }, [open]);

  // Android's back: one step back, as the web's Escape.
  useEffect(() => {
    if (!open) return;
    const sub = (BackHandler as any)?.addEventListener?.('hardwareBackPress', () => {
      r.back();
      return true;
    });
    return () => sub?.remove?.();
  }, [open, r.back]);

  if (!open) return null;

  const page = theme.colors.background;
  const card = theme.colors.surface || page;
  const ink = theme.colors.text;
  const muted = mix(page, ink, 0.64);
  const line = mix(card, ink, 0.14);
  const accent = requestsAccent(ctx?.serverCustomizations || {});
  const font = ctx?.customizations?.fontFamily ? { fontFamily: ctx.customizations.fontFamily } : null;
  const ff = [font];

  const note = (children) => (
    <View style={{ marginVertical: 28, marginHorizontal: 8, alignItems: 'center', gap: 8 }}>{children}</View>
  );
  const noteText = (t, id?) => (
    <Text style={[{ color: muted, fontSize: 15, lineHeight: 22, textAlign: 'center' }, ff]} testID={id}>
      {t}
    </Text>
  );
  const link = (label, onPress, id, color = accent) => (
    <Text accessibilityRole="button" onPress={onPress} testID={id} style={[{ color, fontWeight: '700', textDecorationLine: 'underline' }, ff]}>
      {label}
    </Text>
  );

  const iconBox = (state, size, round) => {
    const tint = state === 'solved' ? SOLVED : state === 'replied' ? accent : ink;
    const bg = state === 'solved' ? 'rgba(22,163,74,0.14)' : state === 'replied' ? mix(card, accent, 0.1) : mix(card, ink, 0.09);
    return (
      <View style={{ width: size, height: size, borderRadius: round ? size / 2 : 10, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
        <StateIcon state={state} color={tint} />
      </View>
    );
  };

  // ---------- the body ----------
  let body = null;
  if (s.loading) body = note(noteText(REQUESTS_TEXT.loading, `${testID}-loading`));
  else if (s.failed)
    body = note(
      <>
        {noteText(REQUESTS_TEXT.loadFailed, `${testID}-failed`)}
        {link(REQUESTS_TEXT.tryAgain, r.reload, `${testID}-reload`)}
      </>
    );
  else if (s.screen === 'list') {
    const list = s.list || [];
    body = !list.length
      ? note(noteText(REQUESTS_TEXT.empty, `${testID}-empty`))
      : (
        <View style={{ borderRadius: 14, backgroundColor: card, borderWidth: StyleSheet.hairlineWidth, borderColor: line, overflow: 'hidden' }}>
          {list.map((q, i) => {
            const fresh = isNewReply(q, s.seen);
            const state = stateOf(q);
            const words = rowLine(q, s.seen);
            return (
              <TouchableOpacity
                key={q.id}
                accessibilityRole="button"
                accessibilityLabel={`${q.title}. ${words}`}
                onPress={() => r.pick(q.id)}
                testID={`${testID}-row-${q.id}`}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderTopWidth: i ? StyleSheet.hairlineWidth : 0, borderColor: line }}
              >
                {iconBox(state, 40, false)}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={2} style={[{ color: ink, fontSize: 15, fontWeight: fresh ? '700' : '600', lineHeight: 20 }, ff]}>
                    {q.title}
                  </Text>
                  <Text numberOfLines={1} style={[{ color: ink, opacity: fresh ? 1 : 0.72, fontSize: 13, marginTop: 2, fontWeight: fresh ? '700' : '400' }, ff]}>
                    {words}
                  </Text>
                </View>
                {fresh ? <View style={{ width: 9, height: 9, borderRadius: 4.5, backgroundColor: accent }} testID={`${testID}-new-${q.id}`} /> : null}
              </TouchableOpacity>
            );
          })}
        </View>
      );
  } else if (s.request) {
    const q = s.request;
    const bubble = (m, pending?) => {
      const you = m.from === 'you';
      const who = you ? REQUESTS_TEXT.you : m.name || REQUESTS_TEXT.supportTeam;
      const when = whenWords(m.at);
      return (
        <View key={pending ? pending.entryId : m.id} style={{ maxWidth: '86%', alignSelf: you ? 'flex-end' : 'flex-start', alignItems: you ? 'flex-end' : 'flex-start' }} testID={pending ? `${testID}-pending` : `${testID}-msg-${m.id}`}>
          <Text style={[{ color: muted, fontSize: 12.5, marginHorizontal: 4, marginBottom: 4 }, ff]}>{when ? `${who} · ${when}` : who}</Text>
          <View
            style={{
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderRadius: 16,
              borderBottomLeftRadius: you ? 16 : 4,
              borderBottomRightRadius: you ? 4 : 16,
              backgroundColor: you ? accent : card,
              borderWidth: you ? 0 : StyleSheet.hairlineWidth,
              borderColor: line,
              opacity: pending ? 0.75 : 1,
            }}
          >
            <Linked text={m.text} style={[{ color: you ? '#fff' : ink, fontSize: 15, lineHeight: 22 }, ff]} />
          </View>
          {pending ? (
            pending.status === 'sending' ? (
              <Text style={[{ color: muted, fontSize: 12.5, marginTop: 4, marginHorizontal: 4 }, ff]}>{REQUESTS_TEXT.sending}</Text>
            ) : pending.status === 'locked' ? (
              <Text style={[{ color: ERROR, fontSize: 12.5, fontWeight: '600', marginTop: 4, marginHorizontal: 4 }, ff]} testID={`${testID}-locked`}>
                {REQUESTS_TEXT.locked}
              </Text>
            ) : (
              <Text style={[{ color: ERROR, fontSize: 12.5, fontWeight: '600', marginTop: 4, marginHorizontal: 4 }, ff]} testID={`${testID}-not-sent`}>
                {`${REQUESTS_TEXT.notSent} `}
                {link(REQUESTS_TEXT.tryAgain, () => r.retry(pending.entryId), `${testID}-retry`, ERROR)}
              </Text>
            )
          ) : null}
        </View>
      );
    };
    body = (
      <>
        <View
          accessibilityLiveRegion="polite"
          style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', padding: 14, marginBottom: 18, borderRadius: 14, backgroundColor: card, borderWidth: StyleSheet.hairlineWidth, borderColor: line }}
          testID={`${testID}-banner`}
        >
          {iconBox(s.requestState, 38, true)}
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[{ color: ink, fontSize: 16, fontWeight: '700', lineHeight: 23 }, ff]}>{s.banner.label}</Text>
            <Text style={[{ color: muted, fontSize: 14, lineHeight: 20 }, ff]}>{s.banner.detail}</Text>
          </View>
        </View>
        <View style={{ gap: 14 }}>
          {q.messages.map((m) => bubble(m))}
          {s.pending.map((p) => bubble({ id: p.entryId, from: 'you', name: '', text: p.text, at: p.at }, p))}
        </View>
      </>
    );
  }

  const showCompose = s.screen === 'request' && !!s.request;
  const slideStyle = {
    opacity: slide,
    transform: [{ translateX: slide.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
  };

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, { backgroundColor: page, zIndex: 30 }, slideStyle, style]}
      accessibilityViewIsModal
      accessibilityLabel={s.title}
      testID={testID}
    >
      <View style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 12, backgroundColor: card, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: line }}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={REQUESTS_TEXT.back}
          onPress={r.back}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingRight: 12, paddingLeft: 6, minWidth: 72 }}
          testID={`${testID}-back`}
        >
          <Text style={{ color: accent, fontSize: 22, lineHeight: 22, marginRight: 2, marginTop: -2 }}>‹</Text>
          <Text style={[{ color: accent, fontSize: 15, fontWeight: '600' }, ff]}>{REQUESTS_TEXT.back}</Text>
        </TouchableOpacity>
        <Text style={[{ flex: 1, textAlign: 'center', color: ink, fontSize: 16, fontWeight: '700' }, ff]} accessibilityRole="header" numberOfLines={1}>
          {s.title}
        </Text>
        <View style={{ minWidth: 72 }} />
      </View>

      <ScrollView
        ref={scroll}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => {
          if (s.screen === 'request') scroll.current?.scrollToEnd?.({ animated: false });
        }}
        testID={`${testID}-body`}
      >
        {body}
      </ScrollView>

      {showCompose ? (
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: card, borderTopWidth: StyleSheet.hairlineWidth, borderColor: line }}>
          <TextInput
            value={s.draft}
            onChangeText={r.setDraft}
            placeholder={s.placeholder}
            placeholderTextColor={muted}
            accessibilityLabel={REQUESTS_TEXT.yourReply}
            multiline
            maxLength={MAX_REPLY}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={[
              {
                flex: 1,
                minHeight: 46,
                maxHeight: 120,
                paddingHorizontal: 14,
                paddingTop: Platform.OS === 'ios' ? 13 : 10,
                paddingBottom: Platform.OS === 'ios' ? 13 : 10,
                borderWidth: 1.5,
                borderRadius: 12,
                borderColor: focused ? accent : mix(card, ink, 0.24),
                backgroundColor: card,
                color: ink,
                fontSize: 15,
                textAlignVertical: 'top',
              },
              ff,
            ]}
            testID={`${testID}-input`}
          />
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={{ disabled: !s.canSend }}
            disabled={!s.canSend}
            onPress={r.send}
            style={{ height: 46, paddingHorizontal: 18, borderRadius: 12, backgroundColor: accent, justifyContent: 'center', opacity: s.canSend ? 1 : 0.45 }}
            testID={`${testID}-send`}
          >
            <Text style={[{ color: '#fff', fontSize: 15, fontWeight: '700' }, ff]}>{REQUESTS_TEXT.send}</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </Animated.View>
  );
};

/** Inside a ConferBotProvider; nothing outside one. */
export const RequestsPortal: React.FC<RequestsPortalProps> = (props) => (ConferBotContext ? <PortalView {...props} /> : null);

export default RequestsPortal;
