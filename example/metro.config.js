const { getDefaultConfig } = require('expo/metro-config');
const { wrapWithReanimatedMetroConfig } = require('react-native-reanimated/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

/** @type {import('expo/metro-config').MetroConfig} */
const baseConfig = getDefaultConfig(projectRoot);

// 1. 让 Metro watch 仓库根目录，否则修改 src/ 库源码不会触发热更新
baseConfig.watchFolders = [
  ...(baseConfig.watchFolders || []),
  workspaceRoot,
];

// 2. 让 resolver 搜索根 node_modules（peer deps 的实际安装位置），
//    同时保留 example/node_modules 的优先级
baseConfig.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// 3. Reanimated 3 wrapper：获得可定位的 worklet 调用栈（R3-004）
module.exports = wrapWithReanimatedMetroConfig(baseConfig);
