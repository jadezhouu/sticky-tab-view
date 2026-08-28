const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

// 1. 让 Metro watch 仓库根目录，否则修改 src/ 库源码不会触发热更新
config.watchFolders = [
  ...(config.watchFolders || []),
  workspaceRoot,
];

// 2. 让 resolver 搜索根 node_modules（peer deps 的实际安装位置），
//    同时保留 example/node_modules 的优先级
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

module.exports = config;
