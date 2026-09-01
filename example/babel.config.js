// Expo SDK 53：babel-preset-expo 检测到 react-native-reanimated 后会自动注入
// Reanimated 的 Babel plugin，因此这里不得手动重复添加（R3-004）。
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
