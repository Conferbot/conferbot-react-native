/** Auto-open (web src/index.ts live_chat auto-open, core/customizations.ts autoOpen / autoOpenDelay). */
import { CLOSED_BLOCKS_MS, autoOpenDelayOf, autoOpenPlan } from '../../src/core/autoOpen';

const fresh = { chatStarted: false, isOpen: false, alreadyAutoOpened: false };

describe('auto-open', () => {
  it('opens after the owner\'s delay, in seconds', () => {
    expect(autoOpenPlan({ botAutoOpen: true, botAutoOpenDelay: 5 }, fresh)).toBe(5000);
    expect(autoOpenPlan({ botAutoOpen: true }, fresh)).toBe(0);
    expect(autoOpenDelayOf({ botAutoOpenDelay: '2.5' })).toBe(2500);
    expect(autoOpenDelayOf({ botAutoOpenDelay: -3 })).toBe(0);
    expect(autoOpenDelayOf({ botAutoOpenDelay: 'soon' })).toBe(0);
  });

  it('does nothing when off, for a chat already started, already open, or already done once', () => {
    expect(autoOpenPlan({}, fresh)).toBeNull();
    expect(autoOpenPlan({ botAutoOpen: false }, fresh)).toBeNull();
    expect(autoOpenPlan({ botAutoOpen: true }, { ...fresh, chatStarted: true })).toBeNull();
    expect(autoOpenPlan({ botAutoOpen: true }, { ...fresh, isOpen: true })).toBeNull();
    expect(autoOpenPlan({ botAutoOpen: true }, { ...fresh, alreadyAutoOpened: true })).toBeNull();
  });

  it('waits 2 minutes after the visitor closed it', () => {
    const c = { botAutoOpen: true };
    expect(autoOpenPlan(c, { ...fresh, closedAt: 1000, now: 1000 + CLOSED_BLOCKS_MS - 1 })).toBeNull();
    expect(autoOpenPlan(c, { ...fresh, closedAt: 1000, now: 1000 + CLOSED_BLOCKS_MS })).toBe(0);
  });
});
