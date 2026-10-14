import { StorageService } from '../../src/services/StorageService';

const memoryStorage = () => {
  const m = new Map<string, string>();
  return {
    getItem: async (k: string) => (m.has(k) ? (m.get(k) as string) : null),
    setItem: async (k: string, v: string) => {
      // A few microtask turns: concurrent saves interleave as on a device.
      for (let i = 0; i < 3; i++) await Promise.resolve();
      m.set(k, v);
    },
    removeItem: async (k: string) => {
      m.delete(k);
    },
    getAllKeys: async () => Array.from(m.keys()),
    multiRemove: async (keys: string[]) => keys.forEach((k) => m.delete(k)),
  };
};

describe('StorageService sessions', () => {
  it('keeps the session id when other session fields are saved at the same time', async () => {
    const s = new StorageService('bot1');
    await s.initialize(memoryStorage() as any);
    await Promise.all([
      s.saveSession({ chatSessionId: 'abc', isActive: true }),
      s.saveSession({ currentNodeId: 'n1', visitedNodes: ['n1'] }),
      s.saveSession({ isFlowComplete: false }),
    ]);
    const session = await s.loadSession();
    expect(session?.chatSessionId).toBe('abc');
    expect(session?.currentNodeId).toBe('n1');
  });
});
