/**
 * Jest Setup File
 * Configures mocks and global test utilities
 */

// Mock React Native modules
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');

  return {
    ...RN,
    Platform: {
      OS: 'ios',
      select: jest.fn((obj) => obj.ios),
    },
    Dimensions: {
      get: jest.fn().mockReturnValue({ width: 375, height: 812 }),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    },
    StyleSheet: {
      ...RN.StyleSheet,
      create: jest.fn((styles) => styles),
      flatten: jest.fn((style) => {
        if (Array.isArray(style)) {
          return Object.assign({}, ...style);
        }
        return style || {};
      }),
      hairlineWidth: 1,
    },
    Linking: {
      openURL: jest.fn().mockResolvedValue(true),
      canOpenURL: jest.fn().mockResolvedValue(true),
      getInitialURL: jest.fn().mockResolvedValue(null),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    },
    Alert: {
      alert: jest.fn(),
    },
    Modal: 'Modal',
    View: 'View',
    Text: 'Text',
    TextInput: 'TextInput',
    TouchableOpacity: 'TouchableOpacity',
    Image: 'Image',
    ActivityIndicator: 'ActivityIndicator',
    KeyboardAvoidingView: 'KeyboardAvoidingView',
    FlatList: 'FlatList',
    ScrollView: 'ScrollView',
  };
});

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
  multiGet: jest.fn(() => Promise.resolve([])),
  multiSet: jest.fn(() => Promise.resolve()),
  multiRemove: jest.fn(() => Promise.resolve()),
  getAllKeys: jest.fn(() => Promise.resolve([])),
  clear: jest.fn(() => Promise.resolve()),
}));

// Mock socket.io-client
jest.mock('socket.io-client', () => {
  const mockSocket = {
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
    connected: false,
    id: 'mock-socket-id',
  };

  return {
    io: jest.fn(() => mockSocket),
    Socket: jest.fn(() => mockSocket),
  };
});

// Mock axios
jest.mock('axios', () => ({
  create: jest.fn(() => ({
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    interceptors: {
      request: { use: jest.fn(), eject: jest.fn() },
      response: { use: jest.fn(), eject: jest.fn() },
    },
  })),
  get: jest.fn(),
  post: jest.fn(),
}));

// Global test utilities
global.console = {
  ...console,
  // Suppress console.log in tests unless needed
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock timers
jest.useFakeTimers();

// Global beforeEach/afterEach hooks
beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  jest.clearAllTimers();
});

// Custom matchers
expect.extend({
  toBeValidEmail(received) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const pass = emailRegex.test(received);
    return {
      message: () =>
        `expected ${received} ${pass ? 'not ' : ''}to be a valid email`,
      pass,
    };
  },
  toBeValidPhone(received) {
    const phoneRegex = /^\+?[\d\s\-()]{7,20}$/;
    const pass = phoneRegex.test(received);
    return {
      message: () =>
        `expected ${received} ${pass ? 'not ' : ''}to be a valid phone number`,
      pass,
    };
  },
});
