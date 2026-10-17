// @ts-nocheck
/**
 * The home screen (web conferbot-widget src/ts/home/firstImpression.ts
 * enhanceHome, askBox.ts, trust.ts, requests/card.ts over
 * templates/shared.ts generateInitialPage; CSS src/css/polish.css "Home",
 * polish-home.css, polish-requests.css "Home card"). Draws core/home.ts
 * homeModel and sends each tap where the web sends it:
 *
 *   "Talk to us" and a starter question     the conversation (asking it)
 *   "Ask anything" rows                     ask the agent, open an article, or the chat
 *   "Pick up where you left off"            the conversation, or ask again
 *   "Your requests" rows / See all (n)      the requests portal over the home
 *   a recent article / a topic / See all    the article over the home / the help centre
 *   the cross                               closes the chat
 *
 * Calm, as the web: the brand band, white (theme) cards, one accent; each
 * part rises 8pt into place once (the web's cb-rise), none with reduced
 * motion, and it stays still after.
 */
import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  StyleSheet,
  Animated,
  Easing,
  AccessibilityInfo,
} from 'react-native';
import ConferBotContext from '../../context/ConferBotContext';
import { useChatFont } from '../../hooks/useChatFont';
import { mix } from '../../theme/color';
import { useHomeOf } from '../../hooks/useHome';
import { StateIcon } from '../Requests/RequestsPortal';
import {
  HIDDEN_WHILE_ASKING,
  HOME_TEXT,
  askDefault,
  askRows,
  helpSearch,
  homePalette,
  remoteQueryFor,
  type HomeModel,
} from '../../core/home';
import { loadSvg } from '../../optional/svg';

let SvgXml: any = null;
try {
  SvgXml = loadSvg().SvgXml;
} catch {
  SvgXml = null;
}

// The web's icons (askBox.ts, firstImpression.ts, the template's send arrow, polish.css's document).
const ICONS = {
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  spark: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5l1.9 5.6 5.6 1.9-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.9zM18.5 15l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9z"/></svg>',
  chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12z"/></svg>',
  history: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/></svg>',
  doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>',
  send: '<svg viewBox="0 0 14 14" fill="currentColor"><path fill-rule="evenodd" d="M11.821.098a1.62 1.62 0 0 1 2.077 2.076l-3.574 10.712a1.62 1.62 0 0 1-1.168 1.069a1.599 1.599 0 0 1-1.52-.434l-1.918-1.909l-2.014 1.042a.5.5 0 0 1-.73-.457l.083-3.184l7.045-5.117a.625.625 0 1 0-.735-1.012L2.203 8.088l-1.73-1.73a1.6 1.6 0 0 1-.437-1.447a1.62 1.62 0 0 1 1.069-1.238h.003L11.82.097Z" clip-rule="evenodd"/></svg>',
  close: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4 4l12 12M16 4L4 16"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.6l2.9 6 6.6.8-4.9 4.6 1.3 6.5L12 17.3l-5.9 3.2 1.3-6.5-4.9-4.6 6.6-.8z"/></svg>',
};
const GLYPHS = { search: '⌕', spark: '✦', chat: '💬', history: '↺', doc: '▤', send: '➤', close: '✕', star: '★' };

const Icon = ({ name, color, size = 20 }) =>
  SvgXml ? (
    <SvgXml xml={ICONS[name].replace(/currentColor/g, color)} width={size} height={size} />
  ) : (
    <Text style={{ color, fontSize: size * 0.8, lineHeight: size }}>{GLYPHS[name]}</Text>
  );

/** The brand band and the button: the launcher's colours, 150deg / 135deg (polish-home.css). */
const Gradient = ({ a, b, angle, radius = 0 }) => {
  if (!SvgXml || a === b) return <View style={[StyleSheet.absoluteFill, { backgroundColor: a, borderRadius: radius }]} />;
  const r = (angle * Math.PI) / 180;
  const x = Math.sin(r) / 2;
  const y = -Math.cos(r) / 2;
  const xml = `<svg viewBox="0 0 100 100" preserveAspectRatio="none"><defs><linearGradient id="g" x1="${0.5 - x}" y1="${0.5 - y}" x2="${0.5 + x}" y2="${0.5 + y}"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="100" height="100" rx="0" fill="url(#g)"/></svg>`;
  return (
    <View style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden' }]} pointerEvents="none">
      <SvgXml xml={xml} width="100%" height="100%" />
    </View>
  );
};

const reduceMotion = (): Promise<boolean> => {
  try {
    return Promise.resolve((AccessibilityInfo as any)?.isReduceMotionEnabled?.()).then((v) => !!v).catch(() => false);
  } catch {
    return Promise.resolve(false);
  }
};

/** The web's cb-rise: up 8pt and in, once, after `delay`. */
const Rise = ({ delay = 0, still, children, style, onLayout }: any) => {
  const v = useRef(new Animated.Value(still ? 1 : 0)).current;
  useEffect(() => {
    if (still) return v.setValue(1);
    Animated.timing(v, { toValue: 1, duration: 450, delay, easing: Easing.bezier(0.22, 1, 0.36, 1), useNativeDriver: true }).start();
  }, [still]);
  return (
    <Animated.View onLayout={onLayout} style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
};

export interface HomeScreenProps {
  /** The cross at the top: close the chat. */
  onClose?: () => void;
  /**
   * The app's own mascot spot, above the greeting: given the owner's mascot
   * (look and colour), e.g. `(m) => <Mascot look={m.look} accent={m.accent} mood="wave" />`.
   * The web's home draws none, so nothing is drawn without it.
   */
  renderMascot?: (mascot: HomeModel['mascot']) => React.ReactNode;
  testID?: string;
}

const HomeView: React.FC<HomeScreenProps> = ({ onClose, renderMascot, testID = 'cb-home' }) => {
  const ctx = useContext(ConferBotContext);
  const home = useHomeOf(ctx);
  const m = home.model;
  const pal = homePalette(ctx?.widgetTheme?.tokens);
  // The chat's font (core/ownerFont.ts): the owner's, else the theme's, once loaded.
  const font = useChatFont().body();
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [helpQuery, setHelpQuery] = useState('');
  const [remote, setRemote] = useState(null);
  const [band, setBand] = useState(250);
  const [still, setStill] = useState(true);
  const [broken, setBroken] = useState<Record<string, true>>({});
  const [logosReady, setLogosReady] = useState(false);
  // Where "Talk to us" sits in the scroll content: its Rise's offset, the
  // wrapper's offset in that Rise, the card's offset in the wrapper (#86).
  const talkAt = useRef({ rise: 0, y: 0, cardY: 0, h: 0 });
  // The band runs down to the middle of the card (at most 72 into it).
  const fitBand = () => {
    const t = talkAt.current;
    if (t.h > 0) setBand(Math.round(t.rise + t.y + t.cardY + Math.min(72, t.h / 2)));
  };

  useEffect(() => {
    let gone = false;
    reduceMotion().then((r) => !gone && setStill(r));
    return () => {
      gone = true;
    };
  }, []);

  // The server's matches inside article text, 280ms after the last key (askBox.ts askRemote).
  const rawArticles = useMemo(() => {
    const kb = ctx?.knowledgeBase || { categories: [], recentArticles: [] };
    return [...(kb.recentArticles || []), ...(kb.categories || []).flatMap((c) => c?.articles || [])];
  }, [ctx?.knowledgeBase]);
  useEffect(() => {
    const q = query.trim();
    const key = q && m?.ask ? remoteQueryFor(q, rawArticles) : null;
    if (!key) return;
    let gone = false;
    const t = setTimeout(() => {
      home.searchArticleText(key).then((hits) => {
        if (!gone) setRemote({ query: q.toLowerCase(), hits: hits || [] });
      });
    }, 280);
    return () => {
      gone = true;
      clearTimeout(t);
    };
  }, [query, rawArticles]);

  // The customer logos show once one has really loaded (trust.ts): a label over nothing is a claim with no proof.
  const logoKey = m?.trust?.logos.join(' ') || '';
  useEffect(() => {
    setLogosReady(false);
    if (!m?.trust) return;
    const prefetch = (Image as any).prefetch;
    if (typeof prefetch !== 'function') return setLogosReady(true);
    let gone = false;
    m.trust.logos.forEach((url) =>
      Promise.resolve(prefetch(url))
        .then((ok) => {
          if (!gone && ok !== false) setLogosReady(true);
        })
        .catch(() => {})
    );
    return () => {
      gone = true;
    };
  }, [logoKey]);

  if (!m) return null;

  const accent = m.accent;
  const bandInk = m.light ? '#0f172a' : '#ffffff';
  const ff = [font];
  const asking = !!m.ask && query.trim().length > 0;
  const rows = m.ask ? askRows(query, { agentName: m.ask.agentName, articles: m.articles, remote }) : [];
  const ok = (url) => !!url && !broken[url];
  const lose = (url) => setBroken((b) => ({ ...b, [url]: true }));

  const cardStyle = {
    backgroundColor: pal.card,
    borderRadius: 18,
    shadowColor: '#0f172a',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  };
  const helpCard = { ...cardStyle, padding: 6, shadowOpacity: 0.09 };
  const label = (text, id?) => (
    <Text style={[{ marginTop: 8, marginHorizontal: 10, marginBottom: 2, fontSize: 11.5, fontWeight: '600', letterSpacing: 0.46, textTransform: 'uppercase', color: pal.muted }, ff]} testID={id}>
      {text}
    </Text>
  );
  const seeAll = (text, onPress, id) => (
    <TouchableOpacity accessibilityRole="button" onPress={onPress} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }} style={{ paddingVertical: 4, paddingHorizontal: 6, borderRadius: 6 }} testID={id}>
      <Text style={[{ fontSize: 12.5, fontWeight: '600', color: accent }, ff]}>{text}</Text>
    </TouchableOpacity>
  );
  const iconBox = (name, tint = accent, bg = mix(pal.card, accent, 0.12)) => (
    <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={name} color={tint} />
    </View>
  );
  const runs = (list) =>
    list.map((r, i) =>
      r.mark ? (
        <Text key={i} style={{ backgroundColor: mix(pal.card, accent, 0.12) }}>
          {r.text}
        </Text>
      ) : (
        r.text
      )
    );
  // A row of a card (polish.css .recent-articles .article-card / .cb-home-row).
  const row = ({ key, lead, title, sub, onPress, id, lines = 1, weight = '600', subStyle = null, trail = null, a11y }) => (
    <TouchableOpacity
      key={key}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, paddingLeft: 10, paddingRight: 34, borderRadius: 12 }}
      testID={id}
    >
      {lead}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={lines} style={[{ fontSize: 14, fontWeight: weight, color: pal.ink, lineHeight: 19 }, ff]}>
          {title}
        </Text>
        {sub ? (
          <Text numberOfLines={1} style={[{ fontSize: 12.5, color: pal.muted, lineHeight: 17.5, marginTop: 2 }, ff, subStyle]}>
            {sub}
          </Text>
        ) : null}
      </View>
      {trail || <Text style={{ position: 'absolute', right: 12, color: mix(pal.card, pal.muted, 0.8), fontSize: 18 }}>›</Text>}
    </TouchableOpacity>
  );
  const searchBox = (value, onChange, placeholder, a11y, onSubmit, returnKey, id) => (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        height: 42,
        paddingHorizontal: 12,
        margin: 4,
        borderRadius: 12,
        backgroundColor: focused ? pal.card : pal.soft,
        borderWidth: 2,
        borderColor: focused ? mix(pal.card, accent, 0.35) : 'transparent',
      }}
    >
      <Icon name="search" color={pal.muted} size={18} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={pal.muted}
        accessibilityLabel={a11y}
        returnKeyType={returnKey}
        onSubmitEditing={onSubmit}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        maxLength={300}
        autoCorrect={false}
        style={[{ flex: 1, minWidth: 0, fontSize: 14.5, color: pal.ink, paddingVertical: 0 }, ff]}
        testID={id}
      />
    </View>
  );

  // ---------- the parts ----------

  const runAsk = (r) => {
    if (!r) return;
    if (r.kind === 'ask') home.showChat(r.query);
    else if (r.kind === 'article') home.openArticle(r.id);
    else if (r.kind === 'chat') home.showChat();
  };

  const parts = {
    ask: () => (
      <View style={[helpCard, { marginBottom: 14 }]} testID={`${testID}-ask`}>
        {searchBox(query, setQuery, m.ask.placeholder, m.ask.label, () => runAsk(askDefault(rows)), m.ask.agentName ? 'send' : 'search', `${testID}-ask-input`)}
        {asking ? (
          <View style={{ paddingTop: 4 }} accessibilityRole="list">
            {rows.map((r, i) => {
              if (r.kind === 'label') return <View key={r.key}>{label(r.text)}</View>;
              if (r.kind === 'none')
                return (
                  <Text key={r.key} style={[{ marginTop: 12, marginHorizontal: 10, marginBottom: 4, fontSize: 13.5, textAlign: 'center', color: pal.muted }, ff]} testID={`${testID}-ask-none`}>
                    {r.text}
                  </Text>
                );
              const first = r === askDefault(rows);
              const lead = r.kind === 'article' ? iconBox('doc') : iconBox(r.kind === 'ask' ? 'spark' : 'chat');
              const title =
                r.kind === 'ask' ? (
                  <>
                    {`${HOME_TEXT.askQuery} `}
                    <Text style={{ fontWeight: '700' }}>{`“${r.query}”`}</Text>
                  </>
                ) : r.kind === 'article' ? (
                  runs(r.title)
                ) : (
                  r.title
                );
              return (
                <View key={r.key} style={first ? { backgroundColor: mix(pal.card, accent, 0.08), borderRadius: 12 } : null}>
                  {row({
                    key: r.key,
                    lead,
                    title,
                    sub: r.sub,
                    lines: r.kind === 'ask' ? 2 : 1,
                    weight: r.kind === 'ask' ? '500' : '600',
                    onPress: () => runAsk(r),
                    id: `${testID}-ask-${r.kind}${r.kind === 'article' ? `-${r.id}` : ''}`,
                    trail: <View />,
                  })}
                </View>
              );
            })}
          </View>
        ) : null}
      </View>
    ),

    resume: () => (
      <View style={[helpCard, { marginBottom: 14 }]} testID={`${testID}-resume`}>
        <View style={{ marginTop: -2 }}>{label(HOME_TEXT.resume)}</View>
        {row({
          key: 'resume',
          lead: iconBox('history'),
          title: m.resume.topic,
          sub: m.resume.line,
          lines: 2,
          // The conversation is on the device: open it. Otherwise ask again.
          onPress: () => home.showChat(m.resume.resumable ? undefined : m.resume.topic),
          id: `${testID}-resume-row`,
        })}
      </View>
    ),

    requests: () => (
      <View
        style={[
          helpCard,
          m.requests.fresh ? { marginBottom: 14, borderWidth: 1.5, borderColor: mix(pal.card, accent, 0.45) } : { marginTop: 14 },
        ]}
        testID={`${testID}-requests`}
      >
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingRight: 6 }}>
          {label(HOME_TEXT.requestsTitle)}
          {m.requests.seeAll ? seeAll(m.requests.seeAll, () => home.openRequests(), `${testID}-requests-all`) : null}
        </View>
        {m.requests.rows.map((r) => {
          const tint = r.state === 'solved' ? '#16a34a' : r.state === 'replied' ? accent : pal.ink;
          const bg = r.state === 'solved' ? 'rgba(22,163,74,0.14)' : r.state === 'replied' ? mix(pal.card, accent, 0.1) : mix(pal.card, pal.ink, 0.09);
          return row({
            key: r.id,
            lead: (
              <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
                <StateIcon state={r.state} color={tint} />
              </View>
            ),
            title: r.title,
            sub: r.line,
            lines: 2,
            weight: r.fresh ? '700' : '600',
            subStyle: { color: pal.ink, fontSize: 13, opacity: r.fresh ? 1 : 0.72, fontWeight: r.fresh ? '700' : '400' },
            onPress: () => home.openRequests(r.id),
            id: `${testID}-request-${r.id}`,
            a11y: `${r.title}. ${r.line}`,
            trail: r.fresh ? <View style={{ position: 'absolute', right: 14, width: 9, height: 9, borderRadius: 4.5, backgroundColor: accent }} testID={`${testID}-request-new-${r.id}`} /> : <View />,
          });
        })}
      </View>
    ),

    talk: () => {
      const t = m.talk;
      return (
        <View
          onLayout={(e) => {
            talkAt.current.y = e.nativeEvent.layout.y;
            fitBand();
          }}
          testID={`${testID}-talk`}
        >
          {m.message ? <Text style={[{ color: bandInk, fontSize: 14, marginBottom: 8 }, ff]}>{m.message}</Text> : null}
          <View
            style={[cardStyle, { padding: 16 }]}
            onLayout={(e) => {
              const { y, height } = e.nativeEvent.layout;
              talkAt.current.cardY = y;
              talkAt.current.h = height;
              fitBand();
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <View style={{ width: 46, height: 46 }}>
                {ok(t.avatar) ? (
                  <Image source={{ uri: t.avatar }} onError={() => lose(t.avatar)} style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: mix(pal.card, pal.ink, 0.06) }} accessibilityIgnoresInvertColors />
                ) : (
                  <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: mix(pal.card, pal.ink, 0.06) }} />
                )}
                {t.dot ? (
                  <View style={{ position: 'absolute', left: 34, top: 34, width: 11, height: 11, borderRadius: 5.5, backgroundColor: '#22c55e', borderWidth: 2.5, borderColor: pal.card }} testID={`${testID}-online-dot`} />
                ) : null}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={[{ fontSize: 15, fontWeight: '700', color: pal.ink, marginBottom: 1 }, ff]}>
                  {t.title}
                </Text>
                {t.tagline ? <Text style={[{ fontSize: 13, fontWeight: '500', color: pal.muted, lineHeight: 17.5 }, ff]}>{t.tagline}</Text> : null}
                {t.status ? (
                  <Text style={[{ fontSize: 13, fontWeight: '500', color: pal.muted, lineHeight: 17.5 }, ff]} testID={`${testID}-status`}>
                    {t.status}
                  </Text>
                ) : null}
              </View>
              {t.faces.filter(ok).length ? (
                <View style={{ flexDirection: 'row', paddingLeft: 10 }} accessible accessibilityLabel={HOME_TEXT.ourTeam} testID={`${testID}-faces`}>
                  {t.faces.filter(ok).map((src, i) => (
                    <Image
                      key={src}
                      source={{ uri: src }}
                      onError={() => lose(src)}
                      style={{ width: 24, height: 24, borderRadius: 12, marginLeft: i ? -7 : 0, borderWidth: 2, borderColor: pal.card, backgroundColor: '#e2e8f0' }}
                    />
                  ))}
                </View>
              ) : null}
            </View>

            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => home.showChat()}
              style={{ height: 44, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, overflow: 'hidden' }}
              testID={`${testID}-talk-button`}
            >
              <Gradient a={m.band[0]} b={m.band[1]} angle={135} radius={12} />
              <Text style={[{ color: bandInk, fontSize: 14.5, fontWeight: '600', letterSpacing: 0.15 }, ff]}>{t.button}</Text>
              <Icon name="send" color={bandInk} size={16} />
            </TouchableOpacity>

            {t.starters.length ? (
              <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderColor: pal.line, gap: 6 }} testID={`${testID}-starters`}>
                {t.starters.map((s, i) => (
                  <TouchableOpacity
                    key={`${i}-${s}`}
                    accessibilityRole="button"
                    onPress={() => home.showChat(s)}
                    style={{ borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: mix(pal.card, accent, 0.07), borderWidth: 1, borderColor: mix(pal.card, accent, 0.22) }}
                    testID={`${testID}-starter-${i}`}
                  >
                    <Text numberOfLines={1} style={[{ color: accent, fontSize: 13, fontWeight: '600', lineHeight: 17 }, ff]}>
                      {s}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}

            {t.rating ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 16 }} accessible accessibilityLabel={t.rating.label} testID={`${testID}-rating`}>
                <View style={{ flexDirection: 'row' }}>
                  <View style={{ flexDirection: 'row', opacity: 0.3 }}>
                    {[0, 1, 2, 3, 4].map((i) => (
                      <Icon key={i} name="star" color="#f5b544" size={12} />
                    ))}
                  </View>
                  <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${t.rating.fill}%`, overflow: 'hidden', flexDirection: 'row' }}>
                    {[0, 1, 2, 3, 4].map((i) => (
                      <Icon key={i} name="star" color="#f5b544" size={12} />
                    ))}
                  </View>
                </View>
                <Text style={[{ fontSize: 12.5, fontWeight: '500', color: mix(pal.muted, pal.ink, 0.5) }, ff]}>{t.rating.average}</Text>
                <Text style={[{ fontSize: 12.5, color: pal.muted, opacity: 0.7 }, ff]}>·</Text>
                <Text style={[{ fontSize: 12.5, color: pal.muted }, ff]}>{t.rating.count}</Text>
              </View>
            ) : null}
          </View>
        </View>
      );
    },

    help: () => {
      const h = m.help;
      const found = h.search ? helpSearch(helpQuery, m.articles, !!ctx?.agentBot) : null;
      return (
        <View style={[helpCard, { marginTop: 14 }]} testID={`${testID}-help`}>
          {h.search
            ? searchBox(helpQuery, setHelpQuery, HOME_TEXT.searchPlaceholder, HOME_TEXT.searchLabel, () => {
                if (found?.kind === 'results' && found.rows[0]) home.openArticle(found.rows[0].id);
              }, 'search', `${testID}-help-input`)
            : null}
          {found ? (
            found.kind === 'results' ? (
              found.rows.map((r) => row({ key: r.id, lead: iconBox('doc'), title: runs(r.title), sub: r.sub, onPress: () => home.openArticle(r.id), id: `${testID}-help-result-${r.id}` }))
            ) : (
              <View style={{ paddingTop: 14, paddingHorizontal: 10, paddingBottom: 12, alignItems: 'center' }} testID={`${testID}-help-empty`}>
                <Text style={[{ fontSize: 13.5, color: pal.muted, marginBottom: 10, textAlign: 'center' }, ff]}>{found.text}</Text>
                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={() => home.showChat(found.asks ? helpQuery.trim() : undefined)}
                  style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10, backgroundColor: accent }}
                  testID={`${testID}-help-instead`}
                >
                  <Text style={[{ color: '#fff', fontSize: 13.5, fontWeight: '600' }, ff]}>{found.action}</Text>
                </TouchableOpacity>
              </View>
            )
          ) : (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingRight: 6 }}>
                <Text style={[{ paddingTop: 10, paddingHorizontal: 12, paddingBottom: 6, fontSize: 13, fontWeight: '700', letterSpacing: 0.26, color: pal.ink }, ff]} accessibilityRole="header">
                  {h.title}
                </Text>
                {h.seeAll ? seeAll(HOME_TEXT.seeAll, () => home.showHelp(), `${testID}-help-all`) : null}
              </View>
              {h.recent.map((a) =>
                row({
                  key: a.id,
                  lead:
                    a.image && ok(a.image) ? (
                      <Image source={{ uri: a.image }} onError={() => lose(a.image)} style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: pal.soft }} />
                    ) : (
                      iconBox('doc')
                    ),
                  title: a.title,
                  sub: a.description,
                  onPress: () => home.openArticle(a.id),
                  id: `${testID}-article-${a.id}`,
                })
              )}
              {h.topics.length ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4, marginBottom: 2, borderTopWidth: 1, borderColor: pal.line }} contentContainerStyle={{ gap: 6, paddingTop: 8, paddingHorizontal: 6, paddingBottom: 6 }} testID={`${testID}-topics`}>
                  {h.topics.map((tp) => (
                    <TouchableOpacity
                      key={tp.id}
                      accessibilityRole="button"
                      onPress={() => home.showHelp(tp.id)}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, backgroundColor: pal.soft }}
                      testID={`${testID}-topic-${tp.id}`}
                    >
                      <Text style={[{ fontSize: 12.5, fontWeight: '600', color: mix(pal.muted, pal.ink, 0.6) }, ff]}>{tp.name}</Text>
                      <Text style={[{ fontSize: 11, fontWeight: '600', color: mix(pal.card, pal.muted, 0.75) }, ff]}>{String(tp.count)}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              ) : null}
            </>
          )}
        </View>
      );
    },

    trust: () => {
      const logos = m.trust.logos.filter(ok);
      if (!logosReady || !logos.length) return null;
      return (
        <View style={{ marginTop: 16, marginHorizontal: 4, marginBottom: 6, alignItems: 'center' }} testID={`${testID}-trust`}>
          {m.trust.label ? <Text style={[{ marginBottom: 10, fontSize: 12, fontWeight: '600', color: pal.muted, textAlign: 'center' }, ff]}>{m.trust.label}</Text> : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', columnGap: 18, rowGap: 12 }}>
            {logos.map((src) => (
              <Image key={src} source={{ uri: src }} onError={() => lose(src)} resizeMode="contain" accessibilityLabel={HOME_TEXT.customerLogo} style={{ height: 22, width: 88, opacity: 0.55 }} />
            ))}
          </View>
        </View>
      );
    },
  };

  const shown = m.order.filter((p) => !(asking && HIDDEN_WHILE_ASKING.includes(p)));
  const delays = { ask: 220, resume: 220, requests: 220, talk: 220, help: 300, trust: 300 };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: pal.page }}
      contentContainerStyle={{ paddingTop: 22, paddingHorizontal: 16, paddingBottom: 24 }}
      keyboardShouldPersistTaps="handled"
      testID={testID}
    >
      {/* The brand band, scrolling with the content, ending behind the middle of "Talk to us". */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: asking ? 250 : band }} pointerEvents="none" testID={`${testID}-band`}>
        <Gradient a={m.band[0]} b={m.band[1]} angle={150} />
      </View>

      <Rise delay={100} still={still}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            {m.brand ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }} testID={`${testID}-brand`}>
                {ok(m.brand.logo) ? (
                  <Image source={{ uri: m.brand.logo }} onError={() => lose(m.brand.logo)} style={{ width: 40, height: 40, borderRadius: 20 }} />
                ) : null}
                {m.brand.name ? (
                  <Text numberOfLines={1} style={[{ flexShrink: 1, color: bandInk, fontSize: 15, fontWeight: '600', letterSpacing: -0.15 }, ff]}>
                    {m.brand.name}
                  </Text>
                ) : null}
              </View>
            ) : null}
            {renderMascot ? renderMascot(m.mascot) : null}
            <Text style={[{ color: bandInk, fontSize: 13.5, fontWeight: '600', opacity: 0.82 }, ff]} testID={`${testID}-hello`}>
              {m.hello}
            </Text>
            {m.title ? (
              <Text style={[{ color: bandInk, fontSize: 24, fontWeight: '700', letterSpacing: -0.48, lineHeight: 29 }, ff]} accessibilityRole="header" testID={`${testID}-title`}>
                {m.title}
              </Text>
            ) : null}
          </View>
          {onClose ? (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={HOME_TEXT.close}
              onPress={onClose}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              style={{ width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }}
              testID={`${testID}-close`}
            >
              <Icon name="close" color={bandInk} size={18} />
            </TouchableOpacity>
          ) : null}
        </View>
      </Rise>

      <Rise delay={160} still={still}>
        <Text style={[{ color: bandInk, opacity: 0.92, fontSize: 14.5, lineHeight: 21, marginBottom: 16 }, ff]} testID={`${testID}-description`}>
          {m.description}
        </Text>
      </Rise>

      {shown.map((p) => {
        const node = parts[p]();
        return node ? (
          <Rise
            key={p}
            delay={delays[p]}
            still={still}
            onLayout={
              p === 'talk'
                ? (e) => {
                    talkAt.current.rise = e.nativeEvent.layout.y;
                    fitBand();
                  }
                : undefined
            }
          >
            {node}
          </Rise>
        ) : null;
      })}
    </ScrollView>
  );
};

/** Inside a ConferBotProvider; nothing outside one, or while the owner has no home screen. */
export const HomeScreen: React.FC<HomeScreenProps> = (props) => <HomeView {...props} />;

export default HomeScreen;
