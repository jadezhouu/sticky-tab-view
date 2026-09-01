// RN CLI anchor Metro：用 Reanimated 3 的 wrapWithReanimatedMetroConfig 包装，
// 以获得可定位的 worklet 调用栈（R3-004）。
const path = require('path');
const { getDefaultConfig } = require('@react-native/metro-config');
const { wrapWithReanimatedMetroConfig } = require('react-native-reanimated/metro-config');

const defaultConfig = getDefaultConfig(__dirname);

// pnpm 隔离 node_modules：fixture 的直接依赖是指向仓库根
// node_modules/.pnpm/... 的符号链接，其真实文件在 watch roots 之外。
// Metro 的 TreeFS 只索引 config.watchFolders（默认只有 projectRoot），
// 因此必须把仓库根加入 watchFolders，pnpm store 的真实文件才会进入
// 解析索引（P0-06 修复的下一层问题）。
defaultConfig.watchFolders = [path.resolve(__dirname, '..', '..')];

// Metro 的 package exports 默认开启（metro-config >= 0.82），但它的
// resolveConditionalExport 无法归约 @babel/runtime >= 7.26 的数组形式
// exports target（[{node, import, default}, './helpers/X.js']），会把子路径
// 归约为 null、只能靠 legacy 目录解析兜底（每次都产生一条 warning）。
// RN CLI 锚点直接关闭 package exports，走标准的目录解析——与
// @babel/runtime 的实际文件布局一致，也避免 warning 噪声掩盖真实解析错误。
defaultConfig.resolver.unstable_enablePackageExports = false;

module.exports = wrapWithReanimatedMetroConfig(defaultConfig);
