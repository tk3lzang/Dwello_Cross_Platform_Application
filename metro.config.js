// metro.config.js
// Fixes Metro resolution error for react-native-gesture-handler@3.3.0
// Ensures all imports to react-native-gesture-handler (and its submodules like ReanimatedSwipeable)
// resolve exclusively to the compiled lib/module/ output, preventing duplicate registration of
// RNGestureHandlerDetector from both src/ and lib/module/.

const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

const originalResolveRequest = config.resolver.resolveRequest;

const GESTURE_HANDLER_ROOT = path.resolve(__dirname, 'node_modules/react-native-gesture-handler');

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Normalize Windows backslashes in module names
  const normalizedModule = moduleName ? moduleName.replace(/\\/g, '/') : '';

  if (normalizedModule === 'react-native-gesture-handler') {
    return {
      filePath: path.join(GESTURE_HANDLER_ROOT, 'lib/module/index.js'),
      type: 'sourceFile',
    };
  }

  if (normalizedModule === 'react-native-gesture-handler/ReanimatedSwipeable') {
    return {
      filePath: path.join(GESTURE_HANDLER_ROOT, 'lib/module/components/ReanimatedSwipeable/index.js'),
      type: 'sourceFile',
    };
  }

  if (normalizedModule === 'react-native-gesture-handler/ReanimatedDrawerLayout') {
    return {
      filePath: path.join(GESTURE_HANDLER_ROOT, 'lib/module/components/ReanimatedDrawerLayout.js'),
      type: 'sourceFile',
    };
  }

  if (normalizedModule === 'react-native-gesture-handler/jest-utils') {
    return {
      filePath: path.join(GESTURE_HANDLER_ROOT, 'lib/module/jestUtils/index.js'),
      type: 'sourceFile',
    };
  }

  // Fall through to the original resolver (or Metro's default)
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
