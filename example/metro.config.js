const { getDefaultConfig } = require('expo/metro-config');
const { wrapWithReanimatedMetroConfig } = require('react-native-reanimated/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');
const exampleNodeModules = path.resolve(projectRoot, 'node_modules');

/**
 * 库的 peer deps 在 example 侧各有一份“运行时版本”，而仓库根还装了库自测用的另一套：
 *   example（Expo 53）: react 19.0.0 / RN 0.79.6 / reanimated 3.17.4 / gesture-handler 2.24.0
 *   根（库 devDeps）:  react 19.1.0 / RN 0.81.5 / reanimated 3.19.5 / gesture-handler 2.28.0
 * 库源码位于仓库根，Metro 按“文件向上查找”会把库 import 的这些 peer 解析到根目录那一份，
 * 导致 bundle 里出现两份 React / RN / Reanimated —— 运行时 “Invalid hook call /
 * useMemo of null”。这里的 resolveRequest 把库的 peer 强制从 example 侧解析，保证整包只有一份。
 */
const PEER_DEP_NAMES = [
  'react',
  'react-native',
  'react-native-reanimated',
  'react-native-gesture-handler',
];

/** @type {import('expo/metro-config').MetroConfig} */
const baseConfig = getDefaultConfig(projectRoot);

// 1. 让 Metro watch 仓库根目录，否则修改 src/ 库源码不会触发热更新
baseConfig.watchFolders = [
  ...(baseConfig.watchFolders || []),
  workspaceRoot,
];

// 2. 让 resolver 搜索根 node_modules，同时保留 example/node_modules 的优先级
//    （库的非 peer 依赖，如 lodash，可能只装在根目录）
baseConfig.resolver.nodeModulesPaths = [
  exampleNodeModules,
  path.resolve(workspaceRoot, 'node_modules'),
];

// 3. 覆盖解析：库的 peer deps 一律从 example/node_modules 解析，避免双份 React/RN/Reanimated。
//    Metro 调用自定义 resolveRequest 时，会把“默认 resolver”放进 context.resolveRequest；
//    这里对 peer 关闭分层查找、并把 nodeModulesPaths 收窄到 example，再交回默认 resolver。
baseConfig.resolver.resolveRequest = (context, moduleName, platform) => {
  const isPeerDep = PEER_DEP_NAMES.some(
    (name) => moduleName === name || moduleName.startsWith(name + '/')
  );
  if (isPeerDep) {
    return context.resolveRequest(
      {
        ...context,
        disableHierarchicalLookup: true,
        nodeModulesPaths: [exampleNodeModules],
      },
      moduleName,
      platform
    );
  }
  return context.resolveRequest(context, moduleName, platform);
};

// 4. Reanimated 3 wrapper：获得可定位的 worklet 调用栈（R3-004）
module.exports = wrapWithReanimatedMetroConfig(baseConfig);
