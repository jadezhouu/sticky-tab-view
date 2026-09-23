// Expo SDK 53：babel-preset-expo 检测到 react-native-reanimated 后会自动注入
// Reanimated 的 Babel plugin（R3-004）。但在本 pnpm monorepo 里，该自动注入会把
// plugin resolve 到“仓库根”的 reanimated（库自测版 3.19.5），而 example 运行时是
// 3.17.5，导致 “Mismatch between JavaScript code version and Reanimated Babel
// plugin version (3.17.5 vs. 3.19.5)”。因此这里显式关闭自动注入，改用
// require.resolve 把 plugin 钉到 example 侧的 3.17.5（与运行时一致）。
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { reanimated: false }]],
    plugins: [require.resolve('react-native-reanimated/plugin')],
  };
};
