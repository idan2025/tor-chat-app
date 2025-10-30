/**
 * Metro configuration for React Native
 * https://github.com/facebook/react-native
 *
 * @format
 */

const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('path');

// Get the default Metro config
const defaultConfig = getDefaultConfig(__dirname);

// Custom configuration for monorepo setup
const config = {
  projectRoot: __dirname,

  // Watch the parent directories for monorepo support
  watchFolders: [
    __dirname,
    path.resolve(__dirname, '../..'), // Root of the monorepo
  ],

  resolver: {
    // Add node_modules paths for hoisted dependencies
    nodeModulesPaths: [
      path.resolve(__dirname, 'node_modules'),
      path.resolve(__dirname, '../../node_modules'),
    ],

    // Asset extensions
    assetExts: [
      ...defaultConfig.resolver.assetExts,
      'db',
      'sqlite',
    ],

    // Source extensions
    sourceExts: [
      ...defaultConfig.resolver.sourceExts,
      'jsx',
      'js',
      'ts',
      'tsx',
      'json',
    ],

    // Block list for files/directories to ignore
    blockList: [
      /node_modules\/.*\/node_modules\/react-native\/.*/,
    ],
  },

  transformer: {
    // Enable experimental import support
    unstable_allowRequireContext: true,

    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
  },

  // Server configuration
  server: {
    port: 8081,
  },

  // Caching configuration
  cacheStores: [
    new (require('metro-cache')).FileStore({
      root: path.join(__dirname, '.metro-cache'),
    }),
  ],
};

module.exports = mergeConfig(defaultConfig, config);
