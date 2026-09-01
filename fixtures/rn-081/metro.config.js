// RN CLI anchor Metro：用 Reanimated 3 的 wrapWithReanimatedMetroConfig 包装，
// 以获得可定位的 worklet 调用栈（R3-004）。
const { getDefaultConfig } = require('@react-native/metro-config');
const { wrapWithReanimatedMetroConfig } = require('react-native-reanimated/metro-config');

const defaultConfig = getDefaultConfig(__dirname);
module.exports = wrapWithReanimatedMetroConfig(defaultConfig);
