const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');
const path = require('path');

/**
 * Metro configuration
 * https://facebook.github.io/metro/docs/configuration
 *
 * This config allows the example app to use the SDK from the parent directory
 */

const config = {
  watchFolders: [
    path.resolve(__dirname, '..'),
  ],
  resolver: {
    extraNodeModules: {
      '@conferbot/react-native': path.resolve(__dirname, '..'),
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
