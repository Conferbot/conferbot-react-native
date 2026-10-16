/**
 * "Your requests": the screens as states (web conferbot-widget
 * src/ts/home/requests/view.ts mountRequestsView). One thing at a time:
 *
 *   list      each request's question and where it stands, in words
 *   request   a banner saying where it stands and what happens next, the
 *             conversation, and a reply box with a Send button. A reply to
 *             a solved request opens it again; the banner says so first.
 *
 * Back always goes one step back. Team replies arrive live while a request
 * is open (`my-request-update`), keeping what the visitor was typing and
 * any reply that did not go out. The views draw `getState()` and call the
 * actions; nothing here touches React.
 */
import {
  REQUESTS_TEXT,
  STATE_WORDS,
  ordered,
  replyEntryId,
  seenAt,
  stateOf,
  type RequestDetail,
  type RequestState,
  type RequestSummary,
  type RequestsApi,
} from './requests';

export type PendingStatus = 'sending' | 'failed' | 'locked';

/** A reply on its way, or one that did not go (web `.cb-req__msg.is-pending`). */
export interface PendingReply {
  entryId: string;
  text: string;
  at: string;
  status: PendingStatus;
}

export interface RequestsPortalState {
  screen: 'closed' | 'list' | 'request';
  /** The bar's title. */
  title: string;
  loading: boolean;
  /** It could not be read: "We couldn't load this just now." and Try again (`reload`). */
  failed: boolean;
  /** The list screen's requests, newest replies first; null until read. */
  list: RequestSummary[] | null;
  /** When each was last read here, for "New reply". */
  seen: Record<string, number>;
  /** The open request. */
  request: RequestDetail | null;
  requestState: RequestState | null;
  /** The banner: where it stands and what happens next. */
  banner: { label: string; detail: string } | null;
  pending: PendingReply[];
  draft: string;
  placeholder: string;
  canSend: boolean;
}

export interface RequestsPortalDeps {
  api: RequestsApi;
  /** When each request was last read here, and marking one read. */
  seen: () => Record<string, number>;
  markSeen: (id: string, at: number) => void;
  /** The request is the chat on screen right now: open that instead. */
  isCurrentChat: (id: string) => boolean;
  openChat: () => void;
  /** Something changed (the portal closed): read the list again. */
  onChanged?: () => void;
  now?: () => number;
  rand?: () => number;
}

export interface RequestsPortal {
  getState: () => RequestsPortalState;
  subscribe: (fn: (s: RequestsPortalState) => void) => () => void;
  isOpen: () => boolean;
  /** All requests (web openList). Back leaves the portal. */
  openList: () => Promise<void>;
  /** One request (web openRequest). Back leaves the portal. */
  openRequest: (id: string) => Promise<void>;
  /** From the list: Back comes back to the list. */
  pick: (id: string) => Promise<void>;
  /** One step back: a request opened from the list goes to the list, else the portal closes. */
  back: () => void;
  /** Leave the portal. */
  close: () => void;
  /** Try again after a failed load. */
  reload: () => void;
  setDraft: (text: string) => void;
  /** Send the draft as a reply. */
  send: () => void;
  /** Try again on a reply that did not go. */
  retry: (entryId: string) => void;
  /** A new conversation: the drafts go. */
  reset: () => void;
  destroy: () => void;
}

const closedState = (): RequestsPortalState => ({
  screen: 'closed',
  title: '',
  loading: false,
  failed: false,
  list: null,
  seen: {},
  request: null,
  requestState: null,
  banner: null,
  pending: [],
  draft: '',
  placeholder: REQUESTS_TEXT.replyPlaceholder,
  canSend: false,
});

export const createRequestsPortal = (deps: RequestsPortalDeps): RequestsPortal => {
  const { api } = deps;
  const now = deps.now || Date.now;
  let state = closedState();
  let openId: string | null = null;
  let fromList = false;
  let drafts: Record<string, string> = {};
  let lastLoad: (() => Promise<void>) | null = null;
  const listeners = new Set<(s: RequestsPortalState) => void>();

  const set = (patch: Partial<RequestsPortalState>) => {
    state = { ...state, ...patch };
    if (state.screen === 'request') {
      const draft = openId ? drafts[openId] || '' : '';
      state.draft = draft;
      state.canSend = !!draft.trim();
    }
    listeners.forEach((l) => l(state));
  };

  const leave = () => {
    if (openId) api.close(openId);
    openId = null;
    const was = state.screen;
    state = closedState();
    listeners.forEach((l) => l(state));
    if (was !== 'closed') deps.onChanged?.();
  };

  // ---------- All requests ----------

  const showList = async (): Promise<void> => {
    if (openId) api.close(openId);
    openId = null;
    lastLoad = showList;
    set({ screen: 'list', title: REQUESTS_TEXT.title, loading: true, failed: false, request: null, requestState: null, banner: null, pending: [] });
    const list = await api.list();
    if (state.screen !== 'list' || openId) return;
    if (!list) return set({ loading: false, failed: true });
    const seen = deps.seen();
    set({ loading: false, failed: false, list: ordered(list, seen), seen });
  };

  // ---------- One request ----------

  const draw = (r: RequestDetail, pending: PendingReply[]) => {
    const requestState = stateOf(r);
    deps.markSeen(r.id, seenAt(r, now()));
    set({
      loading: false,
      failed: false,
      request: r,
      requestState,
      banner: STATE_WORDS[requestState],
      pending,
      placeholder: requestState === 'solved' ? REQUESTS_TEXT.reopenPlaceholder : REQUESTS_TEXT.replyPlaceholder,
    });
  };

  const showRequest = async (id: string): Promise<void> => {
    if (deps.isCurrentChat(id)) {
      leave();
      deps.openChat();
      return;
    }
    openId = id;
    lastLoad = () => showRequest(id);
    set({ screen: 'request', title: REQUESTS_TEXT.one, loading: true, failed: false, request: null, requestState: null, banner: null, pending: [] });
    const r = await api.open(id);
    if (openId !== id || state.screen !== 'request') return;
    if (!r) return set({ loading: false, failed: true });
    draw(r, []);
  };

  const withPending = (entryId: string, patch: Partial<PendingReply> | null): PendingReply[] =>
    patch === null ? state.pending.filter((p) => p.entryId !== entryId) : state.pending.map((p) => (p.entryId === entryId ? { ...p, ...patch } : p));

  const sendText = async (id: string, entryId: string, text: string) => {
    set({ pending: withPending(entryId, { status: 'sending' }) });
    const out = await api.reply(id, text, entryId);
    if (openId !== id || state.screen !== 'request') return;
    if (out.ok && out.request) {
      delete drafts[id];
      draw(out.request, withPending(entryId, null));
      return;
    }
    set({ pending: withPending(entryId, { status: out.reason === 'locked' ? 'locked' : 'failed' }) });
  };

  // A team reply or "solved" while it is open: read it again, keeping
  // whatever they were typing and a reply that did not go out.
  const offUpdate = api.onUpdate(async (id) => {
    if (id !== openId || state.screen !== 'request') return;
    const r = await api.open(id);
    if (!r || openId !== id || state.screen !== 'request' || state.pending.some((p) => p.status === 'sending')) return;
    draw(r, state.pending);
  });

  return {
    getState: () => state,
    subscribe: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    isOpen: () => state.screen !== 'closed',
    openList: () => {
      fromList = false;
      return showList();
    },
    openRequest: (id) => {
      fromList = false;
      return showRequest(id);
    },
    pick: (id) => {
      fromList = true;
      return showRequest(id);
    },
    back: () => {
      if (state.screen === 'request' && fromList) {
        fromList = false;
        showList();
      } else leave();
    },
    close: leave,
    reload: () => {
      if (state.failed && lastLoad) lastLoad();
    },
    setDraft: (text) => {
      if (!openId || state.screen !== 'request') return;
      drafts[openId] = String(text ?? '');
      set({});
    },
    send: () => {
      const id = openId;
      if (!id || state.screen !== 'request' || !state.request) return;
      const text = (drafts[id] || '').trim();
      if (!text) return;
      drafts[id] = '';
      const entryId = replyEntryId(now(), deps.rand);
      set({ pending: [...state.pending, { entryId, text, at: new Date(now()).toISOString(), status: 'sending' }] });
      sendText(id, entryId, text);
    },
    retry: (entryId) => {
      const p = state.pending.find((x) => x.entryId === entryId);
      if (!p || p.status !== 'failed' || !openId) return;
      sendText(openId, entryId, p.text);
    },
    reset: () => {
      drafts = {};
    },
    destroy: () => {
      offUpdate();
      listeners.clear();
    },
  };
};
