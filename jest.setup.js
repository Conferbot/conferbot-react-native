/**
 * Jest Setup File
 * Configures mocks and global test utilities
 */

// Mock React Native modules - complete mock without requireActual
jest.mock('react-native', () => {
  return {
    Platform: {
      OS: 'ios',
      select: jest.fn((obj) => obj.ios || obj.default),
      Version: 14,
    },
    Dimensions: {
      get: jest.fn().mockReturnValue({ width: 375, height: 812 }),
      addEventListener: jest.fn(() => ({ remove: jest.fn() })),
      removeEventListener: jest.fn(),
    },
    StyleSheet: {
      create: jest.fn((styles) => styles),
      flatten: jest.fn((style) => {
        if (Array.isArray(style)) {
          return Object.assign({}, ...style);
        }
        return style || {};
      }),
      hairlineWidth: 1,
      absoluteFill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
      absoluteFillObject: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
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
    Animated: {
      View: 'AnimatedView',
      Text: 'AnimatedText',
      Image: 'AnimatedImage',
      Value: jest.fn(() => ({
        setValue: jest.fn(),
        interpolate: jest.fn(() => ({ __getValue: jest.fn() })),
        __getValue: jest.fn(() => 0),
      })),
      timing: jest.fn(() => ({ start: jest.fn((cb) => cb && cb()) })),
      spring: jest.fn(() => ({ start: jest.fn((cb) => cb && cb()) })),
      sequence: jest.fn(() => ({ start: jest.fn((cb) => cb && cb()) })),
      parallel: jest.fn(() => ({ start: jest.fn((cb) => cb && cb()) })),
      loop: jest.fn(() => ({ start: jest.fn(), stop: jest.fn() })),
      event: jest.fn(),
    },
    Keyboard: {
      addListener: jest.fn(() => ({ remove: jest.fn() })),
      dismiss: jest.fn(),
    },
    AppState: {
      currentState: 'active',
      addEventListener: jest.fn(() => ({ remove: jest.fn() })),
      removeEventListener: jest.fn(),
    },
    NetInfo: {
      addEventListener: jest.fn(() => ({ remove: jest.fn() })),
      fetch: jest.fn().mockResolvedValue({ isConnected: true }),
    },
    Modal: 'Modal',
    View: 'View',
    Text: 'Text',
    TextInput: 'TextInput',
    TouchableOpacity: 'TouchableOpacity',
    TouchableHighlight: 'TouchableHighlight',
    TouchableWithoutFeedback: 'TouchableWithoutFeedback',
    Pressable: 'Pressable',
    Image: 'Image',
    ActivityIndicator: 'ActivityIndicator',
    KeyboardAvoidingView: 'KeyboardAvoidingView',
    FlatList: 'FlatList',
    ScrollView: 'ScrollView',
    SafeAreaView: 'SafeAreaView',
    StatusBar: 'StatusBar',
    Vibration: { vibrate: jest.fn() },
    NativeModules: {},
    useWindowDimensions: jest.fn(() => ({ width: 375, height: 812 })),
    useColorScheme: jest.fn(() => 'light'),
    PixelRatio: {
      get: jest.fn(() => 2),
      getFontScale: jest.fn(() => 1),
      getPixelSizeForLayoutSize: jest.fn((size) => size * 2),
      roundToNearestPixel: jest.fn((size) => size),
    },
    I18nManager: {
      isRTL: false,
      allowRTL: jest.fn(),
      forceRTL: jest.fn(),
    },
  };
});

// Mock AsyncStorage - use virtual mock as it's an optional peer dependency
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
  multiGet: jest.fn(() => Promise.resolve([])),
  multiSet: jest.fn(() => Promise.resolve()),
  multiRemove: jest.fn(() => Promise.resolve()),
  getAllKeys: jest.fn(() => Promise.resolve([])),
  clear: jest.fn(() => Promise.resolve()),
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
    multiGet: jest.fn(() => Promise.resolve([])),
    multiSet: jest.fn(() => Promise.resolve()),
    multiRemove: jest.fn(() => Promise.resolve()),
    getAllKeys: jest.fn(() => Promise.resolve([])),
    clear: jest.fn(() => Promise.resolve()),
  },
}), { virtual: true });

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
