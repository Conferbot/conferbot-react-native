/**
 * The app's AsyncStorage is used without being passed in config when the
 * package is installed; one passed in config wins.
 */
describe('deviceStorage', () => {
  beforeEach(() => jest.resetModules());

  it('uses the installed AsyncStorage', () => {
    const storage = { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() };
    jest.doMock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: storage }), { virtual: true });
    const { asyncStorageFor } = require('../../src/utils/deviceStorage');
    expect(asyncStorageFor({})).toBe(storage);
    expect(asyncStorageFor(undefined)).toBe(storage);
  });

  it('prefers the one passed in config', () => {
    const mine = { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() };
    jest.doMock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: { getItem: jest.fn(), setItem: jest.fn() } }), { virtual: true });
    const { asyncStorageFor } = require('../../src/utils/deviceStorage');
    expect(asyncStorageFor({ asyncStorage: mine })).toBe(mine);
  });

  it('keeps nothing when the package is not installed', () => {
    jest.doMock('@react-native-async-storage/async-storage', () => {
      throw new Error("Cannot find module '@react-native-async-storage/async-storage'");
    }, { virtual: true });
    const { asyncStorageFor } = require('../../src/utils/deviceStorage');
    expect(asyncStorageFor({})).toBeNull();
  });
});
