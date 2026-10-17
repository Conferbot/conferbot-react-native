/**
 * The optional peer `react-native-image-picker`, or null when the app does not have it.
 *
 * Every optional peer is required from its own module, and this require is
 * the module's only dependency. Metro 0.80 (React Native 0.73 to 0.75) leaves
 * a missing optional require out of a module's dependency map and moves every
 * later entry down by one; with inline requires a module's own imports come
 * after it, so they resolved to the wrong module or to none (#85).
 *
 * It is required while this module loads, not later: in a release build a
 * require of a missing module made from a function at run time (an effect, a
 * handler) is reported as a fatal error before any catch sees it.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let loaded: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  loaded = require('react-native-image-picker');
} catch {
  loaded = null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function loadImagePicker(): any {
  return loaded;
}
