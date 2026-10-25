/**
 * AI agent bots (Agent Studio): bots with no flow of their own, answered
 * by an AI agent from the first message.
 *
 * The server marks one with `chatbotData.agentBot` on fetched-chatbot-data
 * (embed-server chatbotController getChatbotElementsSocket). Such a bot
 * still ships a one-node shell flow (welcome -> handover to the agent) for
 * older clients, but running it as-is stages a handover the visitor should
 * never see. With agentBot set the SDK opens straight into the agent chat
 * and reuses the handover socket path silently underneath (silentStart),
 * exactly as the web widget does (conferbot-widget index.ts
 * _startAgentBotChat, ts/chat/agentShell.ts).
 *
 * Also here: the AI reply's extras as the server sends them on
 * agent-message (sources, follow-ups, action buttons, cards, an action to
 * confirm), cleaned the same way the web widget cleans them. Pure: no I/O.
 */

export interface AgentBot {
  agentId: string;
  displayName: string;
  greeting: string;
  /** Suggested first questions, shown as chips under the greeting. */
  starters: string[];
  avatar: string | null;
}

export interface AgentDetails {
  _id: string;
  name: string;
  avatar: string;
  isAIAgent: true;
}

export interface AgentSource {
  title: string;
  url?: string;
  articleId?: string;
  snippet?: string;
}

export interface AnswerAction {
  label: string;
  url: string;
}

export interface AnswerCard {
  title: string | null;
  rows: [string, string][];
  note: string | null;
  url: string | null;
}

export interface ResultCard {
  title: string;
  status: string | null;
  tone: 'done' | 'moving' | 'problem' | 'neutral';
  rows: [string, string][];
  link: { url: string; label: string } | null;
}

export interface ActionRequest {
  token: string;
  name: string;
  summary: { label: string; value: string }[];
}

export interface RichEntry {
  kind: 'article' | 'quick_replies' | 'card';
  [key: string]: unknown;
}

import { t } from './i18n';

export const DEFAULT_AGENT_NAME = 'AI Assistant';
/**
 * How long the "writing a reply" dots may wait for the AI (web
 * agentListeners.ts AWAITING_REPLY_MAX_MS): the AI path stays silent when
 * the provider fails twice, so without a ceiling they would run forever.
 */
export const AWAIT_REPLY_MS = 45000;

/** Said when that ceiling is hit, so the dots do not just vanish (web chat.replyTimeout). */
export const REPLY_TIMEOUT_TEXT = 'That took too long. Try again, or ask for a human.';
/** The same in the active language. */
export const replyTimeoutText = (): string => t('chat.replyTimeout');

/** The notice as an on-screen line (not part of the conversation's record, as on the web). */
export const replyTimeoutNotice = (now: number = Date.now()) => ({
  _id: `reply-timeout-${now}`,
  type: 'system-message' as const,
  text: replyTimeoutText(),
  time: new Date(now).toISOString(),
});

export const DEFAULT_AGENT_GREETING = 'Hi! How can I help you today?';
/** The greeting when the owner wrote none, in the active language (web index.ts t("agent.defaultGreeting")). */
export const defaultAgentGreeting = (): string => t('agent.defaultGreeting');
export const MAX_AGENT_SOURCES = 3;
const OBJECT_ID = /^[a-f0-9]{24}$/i;

const clean = (v: unknown, max: number): string =>
  typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : typeof v === 'number' ? String(v) : '';

const httpsUrl = (v: unknown): string | null =>
  typeof v === 'string' && /^https:\/\/[^\s"'<>]+$/i.test(v.trim()) ? v.trim() : null;

const httpUrl = (v: unknown): string => {
  const s = typeof v === 'string' ? v.trim() : '';
  return /^https?:\/\/[^\s"'<>]+$/i.test(s) ? s : '';
};

const startersOf = (raw: unknown): string[] => {
  const seen = new Set<string>();
  return (Array.isArray(raw) ? raw : [])
    .map((s: any) => clean(typeof s === 'string' ? s : s?.text, 80))
    .filter((s) => s && !seen.has(s.toLowerCase()) && !!seen.add(s.toLowerCase()))
    .slice(0, 4);
};

/**
 * The agent bot config from fetched-chatbot-data's chatbotData, or null for
 * every flow bot. Only a well-formed payload switches to agent mode.
 */
export const parseAgentBot = (chatbotData: any): AgentBot | null => {
  const a = chatbotData?.agentBot;
  if (!a || typeof a !== 'object' || !a.agentId) return null;
  return {
    agentId: String(a.agentId),
    displayName: clean(a.displayName, 60) || clean(chatbotData?.name, 60) || t('agent.defaultName'),
    greeting: typeof a.greeting === 'string' ? a.greeting.trim() : '',
    starters: startersOf(a.starters),
    avatar: typeof a.avatar === 'string' && a.avatar ? a.avatar : null,
  };
};

/** The agent as the chat presents it - the shape the server sends as agentDetails. */
export const agentDetailsOf = (bot: AgentBot): AgentDetails => ({
  _id: `ai-agent-${bot.agentId}`,
  name: bot.displayName,
  avatar: bot.avatar || '',
  isAIAgent: true,
});

/** Is this agentDetails an AI agent rather than a person? */
export const isAIAgentDetails = (d: any): boolean =>
  !!d && (d.isAIAgent === true || (typeof d._id === 'string' && d._id.startsWith('ai-agent-')));

export const isAgentShellHandover = (node: any, agentId: string): boolean =>
  node?.type === 'human-handover-node' &&
  Array.isArray(node?.data?.assignedAIAgents) &&
  node.data.assignedAIAgents.map(String).includes(String(agentId));

/**
 * The shell's welcome and handover nodes. A bot switched from a flow keeps
 * the owner's flow too, so only the handover assigned to this agent counts.
 */
export const agentShellNodes = (nodes: any[], agentId: string) => {
  const list = Array.isArray(nodes) ? nodes : [];
  const handover = list.find((n) => isAgentShellHandover(n, agentId)) || null;
  const welcome = handover ? list.find((n) => n?.type === 'welcome-node') || null : null;
  return { welcome, handover };
};

/** Handover data for the agent chat: never a form, message or wait before it. */
export const agentHandoverData = (shellData: any, agentId: string) => ({
  assignmentType: 'auto',
  assignedAgents: [],
  ...(shellData || {}),
  assignedAIAgents: [agentId],
  handoverMessage: '',
  enablePreChatQuestions: false,
  preChatQuestions: [],
});

/**
 * Is the AI still the one answering? The latest word wins: an inactivity
 * pause the visitor came back from has the AI on the chat again; a person
 * taking over, the chat ending or an inactivity close mean it is not.
 */
export const isAgentAIActive = (record: any[]): boolean => {
  const list = Array.isArray(record) ? record : [];
  for (let i = list.length - 1; i >= 0; i--) {
    const type = list[i]?.type;
    if (type === 'ai-agent-resumed') return true;
    if (type === 'agent-left-chat' || type === 'agent-chat-ended' || type === 'ai-agent-inactive-close') return false;
  }
  return true;
};

/** Sources an AI reply was grounded in: http(s) pages or help articles, at most three. */
export const normalizeAgentSources = (raw: unknown): AgentSource[] => {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: AgentSource[] = [];
  for (const item of raw as any[]) {
    const articleId = typeof item?.articleId === 'string' && OBJECT_ID.test(item.articleId) ? item.articleId : '';
    const url = String(item?.url || item?.sourceUrl || '').trim();
    const key = articleId ? `article:${articleId}` : url;
    if ((!articleId && !/^https?:\/\//i.test(url)) || seen.has(key)) continue;
    seen.add(key);
    const source: AgentSource = articleId
      ? { title: clean(item?.title, 160) || t('kb.helpArticle'), articleId, ...(httpUrl(url) ? { url } : {}) }
      : { title: clean(item?.title, 160) || sourceHost(url), url };
    const snippet = clean(item?.snippet || item?.description || item?.excerpt, 220);
    if (snippet) source.snippet = snippet;
    out.push(source);
    if (out.length >= MAX_AGENT_SOURCES) break;
  }
  return out;
};

/**
 * Where a source opens (web agentSources.ts chip): a help article in the
 * app's help centre when it can open there (the help centre is on and the
 * host can show an article), else its public page, else nowhere (drawn,
 * not tappable).
 */
export type OpenTarget = { kind: 'article'; id: string; title: string } | { kind: 'url'; url: string } | null;

export const sourceTarget = (s: AgentSource | null | undefined, canOpenArticles: boolean): OpenTarget => {
  if (!s) return null;
  if (s.articleId && OBJECT_ID.test(s.articleId) && canOpenArticles) return { kind: 'article', id: s.articleId, title: s.title || '' };
  if (s.url && httpUrl(s.url)) return { kind: 'url', url: s.url };
  return null;
};

/**
 * Where the agent's rich article card opens (web agentRich.ts): its public
 * page when it has one, else the article in the app's help centre.
 */
export const richArticleTarget = (rich: any, canOpenArticles: boolean): OpenTarget => {
  if (!rich || rich.kind !== 'article') return null;
  if (typeof rich.url === 'string' && httpUrl(rich.url)) return { kind: 'url', url: rich.url };
  const id = typeof rich.articleId === 'string' ? rich.articleId : '';
  if (id && OBJECT_ID.test(id) && canOpenArticles) return { kind: 'article', id, title: rich.title || '' };
  return null;
};

/** "https://www.conferbot.com/pricing" -> "conferbot.com" */
export const sourceHost = (url: string): string => {
  const m = /^https?:\/\/([^/?#:]+)/i.exec(String(url || ''));
  return m ? m[1].toLowerCase().replace(/^www\./, '') : '';
};

/** The buttons under an answer: labelled, http(s), at most two, once each. */
export const answerActionsOf = (list: unknown): AnswerAction[] => {
  const seen = new Set<string>();
  return (Array.isArray(list) ? list : [])
    .map((a: any) => ({ label: clean(a?.label, 28), url: httpUrl(a?.url) }))
    .filter((a) => a.label && a.url && !seen.has(a.url) && !!seen.add(a.url))
    .slice(0, 2);
};

const rowsOf = (v: unknown, max: number): [string, string][] =>
  (Array.isArray(v) ? v : [])
    .filter((r: any) => Array.isArray(r) && r.length >= 2)
    .map((r: any) => [clean(r[0], 40), clean(r[1], 60)] as [string, string])
    .filter(([a, b]) => a && b)
    .slice(0, max);

/** Facts from the knowledge as a card: a title, two to six rows, a note, a link. */
export const answerCardOf = (v: any): AnswerCard | null => {
  if (!v || typeof v !== 'object') return null;
  const rows = rowsOf(v.rows, 6);
  if (rows.length < 2) return null;
  return { title: clean(v.title, 60) || null, rows, note: clean(v.note, 120) || null, url: httpsUrl(v.url) };
};

/** What an action did ("Order #1042 · In transit"), as a card. */
export const resultCardOf = (v: any): ResultCard | null => {
  if (!v || typeof v !== 'object') return null;
  const rows = rowsOf(v.rows, 5);
  const status = clean(v.status, 30) || null;
  if (!rows.length && !status) return null;
  const tone = ['done', 'moving', 'problem', 'neutral'].includes(v.tone) ? v.tone : 'neutral';
  const url = httpsUrl(v.link?.url);
  return {
    title: clean(v.title, 50) || t('result.done'),
    status,
    tone,
    rows,
    link: url ? { url, label: clean(v.link?.label, 24) || t('result.open') } : null,
  };
};

/** An action the AI is about to take, for the visitor to confirm. */
export const actionRequestOf = (raw: any): ActionRequest | null => {
  if (!raw || typeof raw.token !== 'string' || !raw.token || typeof raw.name !== 'string') return null;
  const summary = (Array.isArray(raw.summary) ? raw.summary : [])
    .filter((l: any) => l && typeof l.label === 'string' && l.value !== undefined)
    .slice(0, 8)
    .map((l: any) => ({ label: String(l.label).slice(0, 40), value: String(l.value).slice(0, 120) }));
  return { token: raw.token, name: raw.name.slice(0, 80), summary };
};

/** What the visitor may ask next: at most three short questions. */
export const followUpsOf = (raw: unknown): string[] =>
  (Array.isArray(raw) ? raw : [])
    .filter((q) => typeof q === 'string' && q.trim())
    .map((q) => clean(q, 120))
    .slice(0, 3);

/** An article, quick replies or a card from the agent (agent-message-rich). */
export const safeRich = (rich: any): RichEntry | null => {
  if (!rich || typeof rich !== 'object') return null;
  if (rich.kind === 'article') {
    const title = clean(rich.title, 80);
    if (!title) return null;
    return { kind: 'article', articleId: clean(rich.articleId, 40), title, snippet: clean(rich.snippet, 200), url: httpsUrl(rich.url) };
  }
  if (rich.kind === 'quick_replies') {
    const options = (Array.isArray(rich.options) ? rich.options : []).map((o: any) => clean(o, 40)).filter(Boolean).slice(0, 4);
    if (options.length < 2) return null;
    return { kind: 'quick_replies', text: clean(rich.text, 300), options };
  }
  if (rich.kind === 'card') {
    const title = clean(rich.title, 80);
    if (!title) return null;
    const label = clean(rich.button?.label, 30);
    const url = httpsUrl(rich.button?.url);
    return {
      kind: 'card',
      title,
      description: clean(rich.description, 300),
      imageUrl: httpsUrl(rich.imageUrl),
      button: label && url ? { label, url } : null,
    };
  }
  return null;
};

/** The owner's quick actions above the composer: labelled, safe links, at most three. */
export const quickActionsOf = (customizations: any): AnswerAction[] =>
  (Array.isArray(customizations?.chatQuickActions) ? customizations.chatQuickActions : [])
    .map((a: any) => ({ label: clean(a?.label, 30), url: httpUrl(a?.url) || (/^(mailto|tel):/i.test(String(a?.url || '')) ? String(a.url).trim() : '') }))
    .filter((a: AnswerAction) => a.label && a.url)
    .slice(0, 3);

/** "Helpful?" under AI answers unless the owner turned it off. */
export const answerFeedbackOn = (customizations: any): boolean => customizations?.hideAnswerFeedback !== true;

/** Source cards (pages and help articles) under AI answers unless the owner turned them off. */
export const answerSourcesOn = (customizations: any): boolean => customizations?.showAnswerSources !== false;

/** The conversion a link stands for, in the analytics vocabulary. */
export const conversionEventOf = (label: string, url = ''): string => {
  const t = `${label} ${url}`.toLowerCase();
  if (/demo|book|meeting|call|calendly/.test(t)) return 'demo_booked';
  if (/trial|sign ?up|register|get started|start free/.test(t)) return 'signup';
  if (/buy|purchase|checkout|order|cart/.test(t)) return 'purchase';
  if (/contact|email|quote/.test(t)) return 'contact_form';
  if (/download/.test(t)) return 'download';
  return 'custom';
};

/**
 * The record fields an AI reply adds to its agent-message entry, only the
 * ones present so a person's message keeps its old shape.
 */
export const aiReplyExtrasOf = (data: any): Record<string, unknown> => {
  if (!isAIAgentDetails(data?.agentDetails)) return {};
  const isFallback = data?.isFallback === true;
  const out: Record<string, unknown> = {};
  const sources = normalizeAgentSources(data?.sources || data?.citations);
  if (sources.length) out.sources = sources;
  if (isFallback) {
    out.isFallback = true;
    return out;
  }
  const actions = answerActionsOf(data?.actions);
  if (actions.length) out.actions = actions;
  const card = answerCardOf(data?.card);
  if (card) out.card = card;
  const resultCard = resultCardOf(data?.resultCard);
  if (resultCard) out.resultCard = resultCard;
  const actionRequest = actionRequestOf(data?.actionRequest);
  if (actionRequest) out.actionRequest = actionRequest;
  out.isAIReply = true;
  return out;
};
