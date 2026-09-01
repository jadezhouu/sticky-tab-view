// RN CLI anchor (RN 0.81.5 / Reanimated 3.19.5)。
// 不使用 babel-preset-expo，必须显式添加 react-native-reanimated/plugin，且位于最后。
module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: ['react-native-reanimated/plugin'],
};
