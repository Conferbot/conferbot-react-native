const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');
const path = require('path');
const exclusionList = require('metro-config/src/defaults/exclusionList');

const sdkRoot = path.resolve(__dirname, '..');
const exampleNodeModules = path.resolve(__dirname, 'node_modules');

const config = {
  watchFolders: [sdkRoot],
  resolver: {
    // Block the parent's react-native — use only example's version
    blockList: exclusionList([
      new RegExp(path.resolve(sdkRoot, 'node_modules', 'react-native') + '/.*'),
      new RegExp(path.resolve(sdkRoot, 'node_modules', 'react') + '/.*'),
      new RegExp(path.resolve(sdkRoot, 'node_modules', '@react-native') + '/.*'),
      new RegExp(path.resolve(sdkRoot, 'node_modules', '@react-native-community') + '/.*'),
    ]),
    // Resolve SDK source directly (skip lib/ for live development)
    sourceExts: ['tsx', 'ts', 'jsx', 'js', 'json'],
    extraNodeModules: {
      '@conferbot/react-native': sdkRoot,
      'react': path.resolve(exampleNodeModules, 'react'),
      'react-native': path.resolve(exampleNodeModules, 'react-native'),
    },
    nodeModulesPaths: [exampleNodeModules],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
