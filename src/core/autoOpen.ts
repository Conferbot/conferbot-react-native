/**
 * Auto-open: the owner's botAutoOpen / botAutoOpenDelay (seconds) open the
 * chat on its own, for a first visit only. Ported from conferbot-widget
 * src/index.ts (the live_chat / popup_chat auto-open, ~2003-2070) and
 * src/core/customizations.ts (autoOpen, autoOpenDelay):
 *
 *   - only while the visitor has not started a chat (a conversation they
 *     already have is theirs to reopen: web `!chatStarted`);
 *   - not when they closed the chat in the last 2 minutes (the web's
 *     isChatOpen=false cookie lasts 120 s);
 *   - once per launch of the widget (the web: once per page load);
 *   - when the delay is up and the chat is already open, nothing.
 *
 * Pure.
 */

/** A close blocks auto-open this long (web: the isChatOpen cookie's 2 minutes). */
export const CLOSED_BLOCKS_MS = 120_000;

/** The owner's delay in milliseconds (unset, junk or negative: at once). */
export const autoOpenDelayOf = (c: any): number => {
  const s = Number(c?.botAutoOpenDelay);
  return Number.isFinite(s) && s > 0 ? Math.round(s * 1000) : 0;
};

/**
 * In how many ms to open the chat, or null for not at all.
 */
export const autoOpenPlan = (
  c: any,
  o: { chatStarted: boolean; isOpen: boolean; alreadyAutoOpened: boolean; closedAt?: number | null; now?: number }
): number | null => {
  if (!c?.botAutoOpen || o.chatStarted || o.isOpen || o.alreadyAutoOpened) return null;
  const now = o.now ?? Date.now();
  if (o.closedAt && now - o.closedAt < CLOSED_BLOCKS_MS) return null;
  return autoOpenDelayOf(c);
};
