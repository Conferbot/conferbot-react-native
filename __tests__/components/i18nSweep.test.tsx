/**
 * The German sweep (core/i18n.ts): with the widget language set to "de",
 * every component the SDK draws is rendered and every string it draws is
 * collected (text, accessibilityLabel / Hint, placeholder, title). None may
 * be English the SDK wrote itself: no English table value (a word the
 * German table says differently), no tell-tale English UI word. The owner
 * content given here is German or neutral, and the flow fixtures' owner
 * text (they are English) is taken out before the check.
 */
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import ConferBotContext from '../../src/context/ConferBotContext';
import { ThemeProvider } from '../../src/theme';
import { setWidgetLanguage } from '../../src/core/i18n';
import { en } from '../../src/core/i18n/en.data';
import { de } from '../../src/core/i18n/de.data';
import { ChatInput } from '../../src/components/ChatInput';
import { ChatHeader } from '../../src/components/ChatHeader';
import { HeaderMenu } from '../../src/components/ChatHeader/HeaderMenu';
import { ChatBottomBar } from '../../src/components/ChatBottomBar/ChatBottomBar';
import { EmptyState } from '../../src/components/EmptyState';
import { OfflineBanner } from '../../src/components/OfflineBanner';
import { ConnectionStatus } from '../../src/components/ConnectionStatus';
import { MessageStatus } from '../../src/components/MessageStatus';
import { MessageBubble } from '../../src/components/MessageBubble';
import { TypingIndicator } from '../../src/components/TypingIndicator';
import { HandoverWaiting } from '../../src/components/Handover/HandoverWaiting';
import { HandoverConnected } from '../../src/components/Handover/HandoverConnected';
import { HandoverError } from '../../src/components/Handover/HandoverError';
import { HandoverView } from '../../src/components/Handover/HandoverView';
import { PreChatForm } from '../../src/components/Handover/PreChatForm';
import { PostChatSurvey } from '../../src/components/Handover/PostChatSurvey';
import { AgentTyping } from '../../src/components/Handover/AgentTyping';
import { AgentReplyExtras } from '../../src/components/AgentReply';
import {
  ClosedChatCard,
  CsatCard,
  EmailTranscriptCard,
  FileRequestCard,
  HandoverWaitingCard,
  LeadCard,
  LeaveMessageCard,
  QueueCard,
  QuickActionsStrip,
} from '../../src/components/LiveChat/LiveChatCards';
import { WaitHelpCard } from '../../src/components/LiveChat/WaitHelpCard';
import { GamesCardView } from '../../src/components/LiveChat/GamesCard';
import { createGamesCard, GamesCard } from '../../src/core/gamesCard';
import { RequestsPortal } from '../../src/components/Requests/RequestsPortal';
import { createRequestsPortal } from '../../src/core/requestsPortal';
import { HomeScreen } from '../../src/components/Home/HomeScreen';
import { KnowledgeBaseScreen } from '../../src/components/KnowledgeBase/KnowledgeBaseScreen';
import { SearchBar } from '../../src/components/KnowledgeBase/SearchBar';
import { ArticleList } from '../../src/components/KnowledgeBase/ArticleList';
import { ArticleDetail } from '../../src/components/KnowledgeBase/ArticleDetail';
import { ArticleRating } from '../../src/components/KnowledgeBase/ArticleRating';
import { CategoryFilter } from '../../src/components/KnowledgeBase/CategoryFilter';
import { VoiceRecorder } from '../../src/components/VoiceRecorder';
import { EmojiPicker } from '../../src/components/EmojiPicker';
import { ReactionPicker } from '../../src/components/ReactionPicker';
import { GreetingCard } from '../../src/components/FloatingWidget/GreetingCard';
import { NodeRenderer } from '../../src/components/NodeComponents/NodeRenderer';
import { closedStateOf } from '../../src/core/liveEvents';
import { resolveCustomizations } from '../../src/core/customizations';
import { MessageStatus as Status } from '../../src/types';
import { runFixture, Fixture } from '../parity/flowDriver';

jest.mock('react-native-svg', () => ({ SvgXml: 'SvgXml', __esModule: true, default: 'Svg', Svg: 'Svg', Path: 'Path', Circle: 'Circle', Ellipse: 'Ellipse', Rect: 'Rect', G: 'G' }));
jest.mock(
  'expo-av',
  () => ({
    Audio: {
      Recording: jest.fn().mockImplementation(() => ({
        prepareToRecordAsync: jest.fn(),
        startAsync: jest.fn(),
        stopAndUnloadAsync: jest.fn(),
        getStatusAsync: jest.fn().mockResolvedValue({ durationMillis: 0, isRecording: false }),
      })),
      setAudioModeAsync: jest.fn(),
      requestPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
      RecordingOptionsPresets: { HIGH_QUALITY: {} },
    },
  }),
  { virtual: true }
);

const RN = require('react-native');
RN.AccessibilityInfo = RN.AccessibilityInfo || { isReduceMotionEnabled: () => Promise.resolve(true), addEventListener: () => ({ remove: () => {} }) };
RN.AppState.currentState = 'active';
RN.AppState.addEventListener = RN.AppState.addEventListener || (() => ({ remove: () => {} }));

// ---------------------------------------------------------------- the check

const EN = en as Record<string, string>;
const DE = de as Record<string, string>;
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** English words the SDK must not draw in German (none of them is German; checked below). */
const ENGLISH_WORDS =
  /\b(the|your|please|tap|send|message|try again|loading|search|close|cancel|submit|typing|helpful|you|with|this|here|choose|select|click|upload|thanks|retry|error|failed|connecting|waiting|ago|today|yesterday|seconds?|and|or|not|now|done|skip|next|back|open|read|sent|delivered|seen)\b/i;

/** English table values the German table words differently, as patterns. */
const ENGLISH_VALUES: { key: string; re: RegExp }[] = Object.keys(EN)
  .filter((k) => DE[k] && DE[k] !== EN[k])
  .flatMap((key) => {
    const v = EN[key];
    if (/\{\w+\}/.test(v)) {
      // The longest literal part of a template ("{name} is typing" -> " is typing").
      const part = v.split(/\{\w+\}/).map((s) => s.trim()).sort((a, b) => b.length - a.length)[0];
      return part.length >= 8 ? [{ key, re: new RegExp(esc(part)) }] : [];
    }
    if (v.trim().length < 4) return [];
    return [{ key, re: new RegExp(`(^|[^A-Za-zÀ-ÿ])${esc(v.trim())}($|[^A-Za-zÀ-ÿ])`) }];
  });

/** Text that is not the SDK's: brands, emoji, the owner content given here. */
const ALLOWED = [/^Conferbot$/, /^Powered by$/i];

/** Every string a rendered tree draws. */
const stringsOf = (json: any): string[] => {
  const out: string[] = [];
  const walk = (n: any) => {
    if (n == null) return;
    if (Array.isArray(n)) return n.forEach(walk);
    if (typeof n === 'string') return void out.push(n);
    const p = n.props || {};
    for (const k of ['accessibilityLabel', 'accessibilityHint', 'placeholder', 'title']) if (typeof p[k] === 'string') out.push(p[k]);
    const kids = n.children || [];
    const text = kids.filter((c: any) => typeof c === 'string').join('');
    if (text) out.push(text);
    kids.filter((c: any) => typeof c !== 'string').forEach(walk);
  };
  walk(json);
  return out.map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
};

/** What in `strings` is English, with the owner's own strings taken out first. */
const englishIn = (strings: string[], owner: string[] = []): string[] => {
  const own = [...owner].map((s) => s.trim()).filter((s) => s.length >= 2).sort((a, b) => b.length - a.length);
  // An owner text with {placeholders} ("Between {min} and {max} please") as it is drawn filled in.
  const templates = own.filter((o) => /\{\w+\}/.test(o)).map((o) => new RegExp(o.split(/\{\w+\}/).map(esc).join('.+?'), 'g'));
  const bad: string[] = [];
  for (const raw of strings) {
    // A piece of the owner's own text (a consent line cut around its links).
    if (raw.length >= 2 && own.some((o) => o.includes(raw.trim()))) continue;
    let s = raw;
    for (const o of own) s = s.split(o).join(' ');
    for (const re of templates) s = s.replace(re, ' ');
    s = s.trim();
    if (!s || ALLOWED.some((re) => re.test(s))) continue;
    const value = ENGLISH_VALUES.find((v) => v.re.test(s));
    if (value) bad.push(`"${raw}" (en ${value.key})`);
    else if (ENGLISH_WORDS.test(s)) bad.push(`"${raw}"`);
  }
  return [...new Set(bad)];
};

// ---------------------------------------------------------------- harness

const flush = async () => {
  for (let i = 0; i < 6; i++) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      await Promise.resolve();
    });
  }
};

const BASE_CONTEXT: any = {
  serverCustomizations: {},
  customizations: {},
  widgetTheme: { tokens: null },
  record: [],
  isConnected: true,
  botName: 'Acme',
  sendMessage: jest.fn(),
  trackGoal: jest.fn(),
  sendAnswerFeedback: jest.fn(),
};

const wrap = (el: React.ReactElement, ctx: any = {}) => (
  <ThemeProvider>
    <ConferBotContext.Provider value={{ ...BASE_CONTEXT, ...ctx }}>{el}</ConferBotContext.Provider>
  </ThemeProvider>
);

type Row = {
  name: string;
  el: () => React.ReactElement;
  ctx?: () => any;
  /** Taps or typing that open more of the component. */
  then?: (api: ReturnType<typeof render>) => void | Promise<void>;
  owner?: string[];
};

const AGENT = { id: 'a1', _id: 'a1', name: 'Sam', email: 'sam@example.com', avatar: undefined as any };
const AI_ID = '0123456789abcdef01234567';
const AI_ANSWER = { _id: AI_ID, type: 'agent-message', text: 'Unsere Tarife beginnen bei 9 €.', agentDetails: { isAIAgent: true, name: 'KI' } };
const ARTICLES = [
  { id: 'a-1', title: 'Erste Schritte', content: 'So legst du los.', categoryId: 'c-1', order: 1, excerpt: 'So legst du los…' },
  { id: 'a-2', title: 'Rechnungen', content: 'Alle Rechnungen an einem Ort.', categoryId: 'c-1', order: 2 },
];
const CATEGORIES = [
  { id: 'c-1', name: 'Grundlagen', description: 'Anleitungen', icon: 'book', articles: ARTICLES },
  { id: 'c-2', name: 'Fragen', description: 'Häufige Fragen', icon: 'help', articles: [] },
];
const PRECHAT = {
  enabled: true,
  fields: [
    { id: 'name', label: 'Name', type: 'text' as const, required: true },
    { id: 'email', label: 'E-Mail', type: 'email' as const, required: true },
    { id: 'phone', label: 'Telefon', type: 'phone' as const, required: false },
    { id: 'message', label: 'Worum geht es?', type: 'textarea' as const, required: false },
  ],
};

const gamesCard = (): GamesCard =>
  createGamesCard({
    customizations: { headerBgColor: '#123456' },
    rng: () => 0.9,
    reducedMotion: true,
    setTimer: () => 0,
    clearTimer: () => {},
  }) as GamesCard;

const requestsContext = () => {
  const summary = { id: 'mobile_1_abcdef', title: 'Meine Rechnung', status: 'open', lastAt: new Date(Date.now() - 2 * 3600000).toISOString(), lastFrom: 'team', lastText: 'Erledigt', teamName: 'Ada' };
  const api = {
    list: jest.fn(async () => [summary, { ...summary, id: 'other_123456', title: 'Lieferung', lastFrom: 'you', status: 'solved' }]),
    open: jest.fn(async () => ({ ...summary, messages: [{ id: 'm1', from: 'you', name: '', text: 'Meine Rechnung', at: null }, { id: 'm2', from: 'team', name: 'Ada', text: 'Erledigt', at: null }] })),
    close: jest.fn(),
    reply: jest.fn(async () => ({ ok: false, reason: 'offline' })),
    onUpdate: jest.fn(() => () => {}),
  };
  const portal = createRequestsPortal({ api: api as any, seen: () => ({}), markSeen: () => {}, isCurrentChat: () => false, openChat: jest.fn() });
  return { requestsPortal: portal, requests: null, requestsUnread: 0, openRequests: (id?: string) => (id ? portal.openRequest(id) : portal.openList()), closeRequests: portal.close, refreshRequests: jest.fn(), serverCustomizations: { headerBgColor: '#0808EE' }, portal };
};

const homeContext = () => ({
  serverCustomizations: { enableInitialPage: true, initialPageTitle: 'Hi there 👋', logoText: 'Acme' },
  customizations: {},
  agentBot: { displayName: 'Ava', starters: ['Preise?'], avatar: null },
  knowledgeBase: { categories: [{ _id: 'c1', name: 'Abrechnung', articles: [{ _id: 'a3', title: 'Tarif wechseln', description: 'Upgrade oder kündigen.', content: 'x' }] }], recentArticles: [{ _id: 'a2', title: 'Widget einbinden', description: 'Ein Skript-Tag.', content: 'y' }] },
  homeMemory: { name: 'Jamie', lastText: 'Lieferzeit?', at: Date.now() - 3600000 },
  requests: [{ id: 'mobile_1_abcdef', title: 'Meine Rechnung', status: 'open', lastAt: new Date().toISOString(), lastFrom: 'team', lastText: 'Erledigt', teamName: 'Ada' }],
  requestsSeen: {},
  homeView: 'home',
  showHome: jest.fn(),
  showChat: jest.fn(),
  showHelp: jest.fn(),
  openArticle: jest.fn(),
  openRequests: jest.fn(),
  searchArticleText: jest.fn(async () => []),
});

const CSAT = { ratingType: 'stars', showFeedbackInput: true };
const helpItem = { kind: 'article', id: 'a1', title: 'Rechnungen herunterladen', description: 'Alle Rechnungen an einem Ort.' };
const waitCard = (o: any = {}) => ({ key: 1, items: [helpItem], solvable: true, settled: false, busy: false, done: false, ...o });
const OWNER_GERMAN = ['Acme', 'Sam', 'Ada', 'Ava', 'Jamie', 'KI', 'Pip', 'sam@example.com', 'you@example.com', 'ada@example.com'];

const ROWS: Row[] = [
  { name: 'ChatInput', el: () => <ChatInput onSend={jest.fn()} /> },
  { name: 'ChatInput (disabled)', el: () => <ChatInput onSend={jest.fn()} disabled /> },
  { name: 'ChatHeader', el: () => <ChatHeader title="Acme" onClose={jest.fn()} onBack={jest.fn()} /> },
  {
    name: 'HeaderMenu (open)',
    el: () => <HeaderMenu items={[{ key: 'restart', label: 'Neu starten', onPress: jest.fn() } as any]} testID="menu" />,
    then: (api) => {
      const btn = api.UNSAFE_root.findAll((n: any) => typeof n.props.onPress === 'function')[0];
      if (btn) fireEvent.press(btn);
    },
    owner: ['Neu starten'],
  },
  { name: 'ChatBottomBar', el: () => <ChatBottomBar onSend={jest.fn()} onAttach={jest.fn()} /> },
  { name: 'EmptyState', el: () => <EmptyState /> },
  { name: 'OfflineBanner', el: () => <OfflineBanner isOffline animated={false} pendingCount={2} showPendingCount /> as any },
  ...(['connected', 'connecting', 'disconnected', 'reconnecting', 'error'] as const).map((status) => ({
    name: `ConnectionStatus ${status}`,
    el: () => <ConnectionStatus status={status as any} showRetry onRetry={jest.fn()} /> as any,
  })),
  ...Object.values(Status).map((s) => ({ name: `MessageStatus ${s}`, el: () => <MessageStatus status={s as any} /> })),
  { name: 'MessageBubble user', el: () => <MessageBubble message={{ _id: 'u1', type: 'user-message', text: 'Hallo', time: new Date() } as any} showTimestamp messageStatus={Status.FAILED} />, ctx: () => ({ customizations: resolveCustomizations({}) }) },
  { name: 'MessageBubble bot', el: () => <MessageBubble message={{ _id: 'b1', type: 'bot-message', text: 'Willkommen', time: new Date() } as any} showTimestamp />, ctx: () => ({ customizations: resolveCustomizations({}) }) },
  { name: 'MessageBubble agent', el: () => <MessageBubble message={{ _id: 'g1', type: 'agent-message', text: 'Moin', time: new Date(), agentDetails: { _id: 'a1', name: 'Sam' } } as any} />, ctx: () => ({ customizations: resolveCustomizations({}) }) },
  ...['dots', 'wave', 'shimmer', 'pencil', 'mascot'].map((variant) => ({
    name: `TypingIndicator ${variant}`,
    el: () => <TypingIndicator visible variant={variant as any} mascot={variant === 'mascot' ? { look: { shape: 'owl', eyes: 'happy', accessory: 'none', color: '', name: 'Pip' } as any, accent: '#4f46e5' } : null} />,
  })),
  { name: 'HandoverWaiting', el: () => <HandoverWaiting onCancel={jest.fn()} queueInfo={{ position: 3, estimatedWaitTime: 180 } as any} /> },
  { name: 'HandoverConnected', el: () => <HandoverConnected agent={AGENT as any} onEndChat={jest.fn()} /> },
  ...(['error', 'no_agents', 'timeout'] as const).map((errorType) => ({
    name: `HandoverError ${errorType}`,
    el: () => <HandoverError errorType={errorType as any} onRetry={jest.fn()} onCancel={jest.fn()} />,
  })),
  ...(['pre_chat', 'waiting', 'connecting', 'connected', 'agent_typing', 'ended', 'post_chat', 'no_agents', 'timeout'] as const).map((stage) => ({
    name: `HandoverView ${stage}`,
    el: () => <HandoverView nodeId="h1" stage={stage as any} agent={AGENT as any} queueInfo={{ position: 2, estimatedWaitTime: 120 } as any} />,
  })),
  {
    name: 'PreChatForm (sent empty)',
    el: () => <PreChatForm config={PRECHAT as any} onSubmit={jest.fn()} />,
    then: (api) => {
      const btns = api.UNSAFE_root.findAll((n: any) => typeof n.props.onPress === 'function');
      if (btns.length) fireEvent.press(btns[btns.length - 1]);
    },
    owner: ['Name', 'E-Mail', 'Telefon', 'Worum geht es?'],
  },
  { name: 'PostChatSurvey', el: () => <PostChatSurvey config={{ enabled: true, ratingEnabled: true, commentEnabled: true } as any} onSubmit={jest.fn()} onSkip={jest.fn()} /> },
  { name: 'AgentTyping', el: () => <AgentTyping agent={AGENT as any} /> },
  { name: 'AgentReplyExtras', el: () => <AgentReplyExtras message={AI_ANSWER} />, ctx: () => ({ record: [AI_ANSWER] }), owner: [AI_ANSWER.text] },
  {
    name: 'AgentReplyExtras (No, reasons)',
    el: () => <AgentReplyExtras message={AI_ANSWER} />,
    ctx: () => ({ record: [AI_ANSWER] }),
    then: (api) => {
      fireEvent.press(api.getByTestId('cb-helpful-down'));
      fireEvent.press(api.getByTestId('cb-helpful-reason-outdated'));
    },
  },
  {
    name: 'AgentReplyExtras (Yes)',
    el: () => <AgentReplyExtras message={AI_ANSWER} />,
    ctx: () => ({ record: [AI_ANSWER] }),
    then: (api) => fireEvent.press(api.getByTestId('cb-helpful-up')),
  },
  {
    name: 'QuickActionsStrip',
    el: () => <QuickActionsStrip offerHuman />,
    ctx: () => ({ serverCustomizations: { chatQuickActions: [{ label: 'Demo buchen', url: 'https://x.co/demo' }], chatTalkToHuman: true }, record: [AI_ANSWER] }),
    owner: ['Demo buchen'],
  },
  { name: 'QueueCard', el: () => <QueueCard />, ctx: () => ({ queue: { status: 'waiting', position: 2, ahead: 1, agentsOnline: 1, estimateLabel: null } }) },
  { name: 'HandoverWaitingCard', el: () => <HandoverWaitingCard />, ctx: () => ({ handoverWaiting: { offline: false, reason: 'busy', backAt: null, askEmail: true, email: null }, shareEmailForReply: jest.fn() }) },
  { name: 'HandoverWaitingCard offline', el: () => <HandoverWaitingCard />, ctx: () => ({ handoverWaiting: { offline: true, reason: 'offline', backAt: null, askEmail: false, email: 'jo@example.com' } }), owner: ['jo@example.com'] },
  { name: 'LeaveMessageCard', el: () => <LeaveMessageCard />, ctx: () => ({ noAgentsAvailable: true, leaveMessage: jest.fn() }) },
  { name: 'LeaveMessageCard sent', el: () => <LeaveMessageCard />, ctx: () => ({ noAgentsAvailable: false, leftMessageTo: 'jo@example.com' }), owner: ['jo@example.com'] },
  { name: 'LeadCard', el: () => <LeadCard />, ctx: () => ({ leadCardOpen: true, captureLeadEmail: jest.fn() }) },
  { name: 'LeadCard done', el: () => <LeadCard />, ctx: () => ({ leadCardOpen: false, leadEmail: 'jo@example.com' }), owner: ['jo@example.com'] },
  { name: 'FileRequestCard', el: () => <FileRequestCard onUpload={jest.fn()} />, ctx: () => ({ fileRequestedBy: 'Sam' }) },
  { name: 'CsatCard', el: () => <CsatCard />, ctx: () => ({ csatConfig: CSAT, csatOpen: true, submitRating: jest.fn(), dismissCsat: jest.fn() }) },
  { name: 'CsatCard thumbs', el: () => <CsatCard />, ctx: () => ({ csatConfig: { ratingType: 'thumbs' }, csatOpen: true, submitRating: jest.fn(), dismissCsat: jest.fn() }) },
  { name: 'CsatCard emoji', el: () => <CsatCard />, ctx: () => ({ csatConfig: { ratingType: 'emoji' }, csatOpen: true, submitRating: jest.fn(), dismissCsat: jest.fn() }) },
  { name: 'CsatCard sent', el: () => <CsatCard />, ctx: () => ({ csatConfig: CSAT, csatOpen: true, csatSent: true }) },
  { name: 'EmailTranscriptCard', el: () => <EmailTranscriptCard />, ctx: () => ({ emailTranscriptOpen: true, emailTranscript: jest.fn(), closeEmailTranscript: jest.fn() }) },
  {
    name: 'EmailTranscriptCard (bad address)',
    el: () => <EmailTranscriptCard />,
    ctx: () => ({ emailTranscriptOpen: true, emailTranscript: jest.fn(), closeEmailTranscript: jest.fn() }),
    then: (api) => {
      fireEvent.changeText(api.getByTestId('cb-mailchat-email'), 'nope');
      fireEvent.press(api.getByTestId('cb-mailchat-send'));
    },
    owner: ['nope'],
  },
  { name: 'EmailTranscriptCard sent', el: () => <EmailTranscriptCard />, ctx: () => ({ emailTranscriptOpen: false, emailTranscriptSentTo: 'sam@example.com' }) },
  {
    name: 'ClosedChatCard ended',
    el: () => <ClosedChatCard closed={closedStateOf([{ _id: 'e1', type: 'agent-chat-ended' }]) || { kind: 'ended', text: 'x', newChat: true, inputOff: true }} onNewChat={jest.fn()} />,
  },
  { name: 'WaitHelpCard', el: () => <WaitHelpCard />, ctx: () => ({ waitHelp: waitCard(), openHelpItem: jest.fn(), solveWait: jest.fn() }), owner: [helpItem.title, helpItem.description] },
  { name: 'WaitHelpCard done', el: () => <WaitHelpCard />, ctx: () => ({ waitHelp: waitCard({ done: true, settled: true }) }), owner: [helpItem.title, helpItem.description] },
  ...(['menu', 'rps', 'ttt', 'quiz', 'memory', 'reaction', 'scramble', 'paused'] as const).map((game) => ({
    name: `GamesCard ${game}`,
    el: () => {
      const c = gamesCard();
      if (game === 'paused') {
        c.open('memory');
        c.wrapUp('Sam');
      } else if (game !== 'menu') c.open(game as any);
      return <GamesCardView card={c} />;
    },
    ctx: () => ({ serverCustomizations: { headerBgColor: '#123456' } }),
  })),
  {
    name: 'RequestsPortal list',
    el: () => <RequestsPortal />,
    ctx: () => {
      const c = requestsContext();
      c.portal.openList();
      return c;
    },
    owner: ['Meine Rechnung', 'Lieferung', 'Erledigt'],
  },
  {
    name: 'RequestsPortal one',
    el: () => <RequestsPortal />,
    ctx: () => {
      const c = requestsContext();
      c.portal.openRequest('mobile_1_abcdef');
      return c;
    },
    owner: ['Meine Rechnung', 'Erledigt'],
  },
  { name: 'HomeScreen', el: () => <HomeScreen onClose={jest.fn()} />, ctx: homeContext, owner: ['Preise?', 'Abrechnung', 'Tarif wechseln', 'Upgrade oder kündigen.', 'Widget einbinden', 'Ein Skript-Tag.', 'Meine Rechnung', 'Erledigt', 'Lieferzeit?'] },
  { name: 'HomeScreen help', el: () => <HomeScreen onClose={jest.fn()} />, ctx: () => ({ ...homeContext(), homeView: 'help' }), owner: ['Abrechnung', 'Tarif wechseln', 'Upgrade oder kündigen.', 'Widget einbinden', 'Ein Skript-Tag.'] },
  { name: 'KnowledgeBaseScreen', el: () => <KnowledgeBaseScreen categories={CATEGORIES as any} onClose={jest.fn()} />, owner: ['Grundlagen', 'Fragen', 'Anleitungen', 'Häufige Fragen', 'Erste Schritte', 'Rechnungen', 'So legst du los', 'Alle Rechnungen an einem Ort.'] },
  { name: 'KnowledgeBaseScreen empty', el: () => <KnowledgeBaseScreen categories={[]} onClose={jest.fn()} /> },
  { name: 'SearchBar', el: () => <SearchBar onSearch={jest.fn()} /> },
  { name: 'ArticleList', el: () => <ArticleList articles={ARTICLES as any} onArticlePress={jest.fn()} />, owner: ['Erste Schritte', 'Rechnungen', 'So legst du los…', 'So legst du los.', 'Alle Rechnungen an einem Ort.'] },
  { name: 'ArticleList empty', el: () => <ArticleList articles={[]} onArticlePress={jest.fn()} /> },
  { name: 'ArticleDetail', el: () => <ArticleDetail article={{ ...ARTICLES[0], tags: ['start'], updatedAt: '2024-01-15T00:00:00Z' } as any} onBack={jest.fn()} />, owner: ['Erste Schritte', 'So legst du los.', 'start'] },
  { name: 'ArticleRating', el: () => <ArticleRating articleId="a-1" onRate={jest.fn(async () => true)} /> },
  { name: 'ArticleRating rated', el: () => <ArticleRating articleId="a-1" onRate={jest.fn(async () => true)} hasRated /> },
  { name: 'CategoryFilter', el: () => <CategoryFilter categories={CATEGORIES as any} onCategorySelect={jest.fn()} />, owner: ['Grundlagen', 'Fragen'] },
  { name: 'VoiceRecorder', el: () => <VoiceRecorder onRecordingComplete={jest.fn()} /> },
  { name: 'EmojiPicker', el: () => <EmojiPicker visible onEmojiSelect={jest.fn()} onClose={jest.fn()} /> as any },
  { name: 'ReactionPicker', el: () => <ReactionPicker visible onSelectReaction={jest.fn()} onClose={jest.fn()} /> },
  ...['card', 'note', 'imessage', 'postcard', 'notification', 'voice'].map((style) => ({
    name: `GreetingCard ${style}`,
    el: () => (
      <GreetingCard
        style={style as any}
        text="Hallo! Wie können wir helfen?"
        head={{ avatar: null, name: 'Acme', online: true }}
        starters={['Preise']}
        bubble={{ bg: '#4f46e5', tail: '#4f46e5', fg: '#ffffff' }}
        accent="#4f46e5"
        font={null}
        firstShow={false}
        onPress={jest.fn()}
        onClose={jest.fn()}
        onStarter={jest.fn()}
      />
    ),
    owner: ['Hallo! Wie können wir helfen?', 'Preise'],
  })),
];

/** The generic node states (the steps' own cards come from the flow fixtures below). */
const NODE_STATES: any[] = [
  { type: 'textInput', nodeId: 'n1', question: '', inputType: 'text' },
  { type: 'textInput', nodeId: 'n2', question: '', inputType: 'email' },
  { type: 'textInput', nodeId: 'n3', question: '', inputType: 'phone' },
  { type: 'textInput', nodeId: 'n4', question: '', inputType: 'number' },
  { type: 'textInput', nodeId: 'n5', question: '', inputType: 'url' },
  { type: 'buttons', nodeId: 'n6', question: '', buttons: [{ id: 'b1', label: 'Eins' }, { id: 'b2', label: 'Zwei' }], multiSelect: true },
  { type: 'dropdown', nodeId: 'n7', question: '', options: [{ id: 'o1', label: 'Eins', value: '1' }] },
  { type: 'rating', nodeId: 'n8', question: '', maxRating: 5 },
  { type: 'opinionScale', nodeId: 'n9', question: '', min: 0, max: 10 },
  { type: 'slider', nodeId: 'n10', question: '', min: 0, max: 100, step: 1 },
  { type: 'calendar', nodeId: 'n11', question: '', mode: 'date' },
  { type: 'calendar', nodeId: 'n12', question: '', mode: 'datetime' },
  { type: 'multipleQuestions', nodeId: 'n13', questions: [{ id: 'q1', question: 'Name', type: 'text', required: true }] },
  { type: 'fileUpload', nodeId: 'n14', question: '', maxSize: 5 },
  { type: 'locationPicker', nodeId: 'n15', question: '' },
  { type: 'humanHandover', nodeId: 'n16', stage: 'waiting' },
  { type: 'humanHandover', nodeId: 'n17', stage: 'connected', agent: AGENT },
  { type: 'gptResponse', nodeId: 'n18', isStreaming: true, text: '' },
  { type: 'loading', nodeId: 'n19' },
  { type: 'quiz', nodeId: 'n20', question: 'Frage?', options: [{ id: 'q1', text: 'Ja' }, { id: 'q2', text: 'Nein' }], correctAnswer: 'q1' },
  { type: 'cards', nodeId: 'n21', cards: [{ id: 'c1', title: 'Karte', description: 'Text', buttons: [] }] },
  { type: 'pictureChoice', nodeId: 'n22', question: '', choices: [{ id: 'p1', label: 'Bild', image: 'https://x.co/a.png' }], multiSelect: true },
  { type: 'file', nodeId: 'n23', url: 'https://x.co/a.pdf', fileName: 'a.pdf' },
  { type: 'audio', nodeId: 'n24', url: 'https://x.co/a.mp3' },
  { type: 'video', nodeId: 'n25', url: 'https://x.co/a.mp4' },
  { type: 'image', nodeId: 'n26', url: 'https://x.co/a.png' },
];

// ---------------------------------------------------------------- tests

beforeAll(() => {
  setWidgetLanguage('de', []);
});
afterAll(() => {
  setWidgetLanguage('en', []);
});

describe('the check itself', () => {
  it('no German string looks English to it', () => {
    const fp = Object.entries(DE)
      .map(([k, v]) => [k, v.replace(/\{\w+\}/g, '')])
      .filter(([, v]) => ENGLISH_WORDS.test(v));
    expect(fp).toEqual([]);
  });

  it('it catches English', () => {
    expect(englishIn(['Type a message...'])).not.toEqual([]);
    expect(englishIn(['Sam is typing'])).not.toEqual([]);
    expect(englishIn([DE['chat.composer.placeholder'], 'Sam'])).toEqual([]);
  });

  it('it sees what a tree draws: the same rows in English are caught', async () => {
    setWidgetLanguage('en', []);
    try {
      const caught = [];
      for (const row of ROWS.filter((r) => ['ChatInput', 'HandoverWaiting', 'CsatCard', 'GamesCard menu', 'HomeScreen'].includes(r.name))) {
        const api = render(wrap(row.el(), row.ctx ? row.ctx() : {}));
        // eslint-disable-next-line no-await-in-loop
        await flush();
        caught.push(englishIn(stringsOf(api.toJSON()), [...OWNER_GERMAN, ...(row.owner || [])]).length);
        api.unmount();
      }
      expect(caught.every((n) => n > 0)).toBe(true);
    } finally {
      setWidgetLanguage('de', []);
    }
  });
});

describe('nothing the SDK draws is English under "de"', () => {
  test.each(ROWS.map((r) => [r.name, r] as [string, Row]))('%s', async (_name, row) => {
    const api = render(wrap(row.el(), row.ctx ? row.ctx() : {}));
    await flush();
    if (row.then) {
      await row.then(api);
      await flush();
    }
    const bad = englishIn(stringsOf(api.toJSON()), [...OWNER_GERMAN, ...(row.owner || [])]);
    api.unmount();
    expect(bad).toEqual([]);
  });

  test.each(NODE_STATES.map((ui) => [`${ui.type} ${ui.inputType || ui.mode || ui.stage || ''}`.trim(), ui]))('node %s', async (_name, ui) => {
    const api = render(wrap(<NodeRenderer uiState={ui} onSubmit={jest.fn()} />));
    await flush();
    const bad = englishIn(stringsOf(api.toJSON()), [...OWNER_GERMAN, 'Eins', 'Zwei', 'Name', 'Frage?', 'Ja', 'Nein', 'Karte', 'Text', 'Bild', 'a.pdf']);
    api.unmount();
    expect(bad).toEqual([]);
  });
});

describe('the flow steps, as the fixtures reach them, under "de"', () => {
  const DIR = '../parity/../../scripts/parity/flows/fixtures';
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const index = require(`${DIR}/index.json`);
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const all: Fixture[] = index.cases.map((c: any) => require(`${DIR}/${c.file}`));

  /** Every string in the fixture (the owner's flow, the server's answers, the visitor's input). */
  const ownerOf = (fx: Fixture): string[] => {
    const out: string[] = [];
    const walk = (v: any) => {
      if (typeof v === 'string') {
        out.push(v);
        // Owner HTML and markdown: its text too.
        out.push(...v.replace(/<[^>]*>/g, '\n').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').split(/\n|\*\*/).map((s) => s.trim()));
      } else if (v && typeof v === 'object') Object.values(v).forEach(walk);
    };
    walk([fx.flow, fx.server, fx.inputs, fx.customizations]);
    return out.filter((s) => s && s.length >= 2);
  };

  test.each(all.map((fx) => [fx.id, fx] as [string, Fixture]))('%s', async (_id, fx) => {
    const owner = ownerOf(fx);
    const bad: string[] = [];
    const seen = new Set<any>();
    await runFixture(fx, {
      answer: (_a, ui) => {
        if (ui && !seen.has(ui)) {
          seen.add(ui);
          const api = render(wrap(<NodeRenderer uiState={ui} onSubmit={() => {}} />));
          bad.push(...englishIn(stringsOf(api.toJSON()), [...OWNER_GERMAN, ...owner]).map((b) => `${ui.stepType || ui.type}: ${b}`));
          api.unmount();
        }
        return null;
      },
    });
    expect([...new Set(bad)]).toEqual([]);
  });
});
