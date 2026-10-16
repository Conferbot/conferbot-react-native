/**
 * "Your requests" for an app's own screens (web conferbot-widget
 * src/ts/home/requests/): the visitor's conversations with the team, the
 * unread count for a badge, and the portal's screens with their actions.
 * Inside a ConferBotProvider.
 *
 *   const { requests, unread, open } = useRequests();
 *   <Button title={`Your requests${unread ? ` (${unread})` : ''}`} onPress={() => open()} />
 *   <RequestsPortal />   // draws the screens while they are open
 */
import { useContext, useEffect, useState } from 'react';
import ConferBotContext from '../context/ConferBotContext';
import type { RequestsPortalState } from '../core/requestsPortal';
import type { RequestSummary } from '../core/requests';
import type { ExtendedConferBotContext } from '../context/types';

export interface UseRequestsReturn {
  /** The visitor's requests, newest replies first; null until read. */
  requests: RequestSummary[] | null;
  /** Requests with a team reply not read on this device. */
  unread: number;
  /** The portal's screen state (closed while nothing is open). */
  state: RequestsPortalState | null;
  isOpen: boolean;
  /** Open the list, or one request by its id. */
  open: (requestId?: string) => void;
  close: () => void;
  back: () => void;
  /** From the list: Back comes back to it. */
  pick: (requestId: string) => void;
  reload: () => void;
  setDraft: (text: string) => void;
  send: () => void;
  retry: (entryId: string) => void;
  /** Read the list again (at most every 15s unless forced). */
  refresh: (force?: boolean) => Promise<void>;
}

const noop = () => {};

/** The same, from a context value that may be missing (the portal view, outside a provider: nothing). */
export const useRequestsOf = (ctx: ExtendedConferBotContext | null | undefined): UseRequestsReturn => {
  const portal = ctx?.requestsPortal || null;
  const [state, setState] = useState<RequestsPortalState | null>(portal ? portal.getState() : null);
  useEffect(() => {
    if (!portal) return setState(null);
    setState(portal.getState());
    return portal.subscribe(setState);
  }, [portal]);

  return {
    requests: ctx?.requests ?? null,
    unread: ctx?.requestsUnread ?? 0,
    state,
    isOpen: !!state && state.screen !== 'closed',
    open: ctx?.openRequests || noop,
    close: ctx?.closeRequests || noop,
    back: portal ? portal.back : noop,
    pick: (id: string) => {
      portal?.pick(id);
    },
    reload: portal ? portal.reload : noop,
    setDraft: portal ? portal.setDraft : noop,
    send: portal ? portal.send : noop,
    retry: portal ? portal.retry : noop,
    refresh: ctx?.refreshRequests || (async () => {}),
  };
};

export const useRequests = (): UseRequestsReturn => {
  const ctx = useContext(ConferBotContext);
  if (!ctx) throw new Error('useRequests must be used within a ConferBotProvider');
  return useRequestsOf(ctx);
};

export default useRequests;
