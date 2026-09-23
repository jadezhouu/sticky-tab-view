// Expo SDK 53 Paper/Fabric 构建变体（V3-6-01/02）。
//
// Expo 53 默认启用新架构（Fabric）。本文件让同一份 example 可以生成
// Paper（newArchEnabled=false）与 Fabric（newArchEnabled=true）两套独立
// native 项目，供两锚点 × iOS/Android × Paper/Fabric 八组合矩阵使用。
//
//   ARCH=fabric  npx expo prebuild --clean --platform android   # 默认，新架构
//   ARCH=paper   npx expo prebuild --clean --platform android   # 旧架构 Paper
//
// Paper 与 Fabric 之间切换时，必须 `--clean` 重新 prebuild，并清理
// Pods / gradle / Metro cache / node_modules（见 docs/reanimated3-native-builds.md），
// 不允许复用未清理的 native 产物。

const arch = (process.env.ARCH || 'fabric').toLowerCase();

if (arch !== 'paper' && arch !== 'fabric') {
  throw new Error(`ARCH 必须是 paper 或 fabric，收到：${arch}`);
}

/** @type {import('expo/config').ExpoConfig} */
module.exports = {
  // app.json 的配置包在 `expo` 键下，Expo 加载器会解包；这里 require 到的是原始 JSON，
  // 因此必须展开 `.expo` 才能得到扁平配置。
  ...require('./app.json').expo,
  // SDK 53 顶部字段，prebuild 时同时驱动 android gradle.properties 与 iOS Podfile。
  newArchEnabled: arch === 'fabric',
  // 追加本地 config plugin：每次 prebuild 后向 iOS Podfile 注入 fmt C++17 覆盖，
  // 修复 Xcode 26 / Clang 21 下 RN 0.79 fmt 11.0.2 的 consteval 回归（CI/Xcode16 无害）。
  plugins: [...(require('./app.json').expo.plugins || []), './plugins/with-fmt-cpp17'],
};
