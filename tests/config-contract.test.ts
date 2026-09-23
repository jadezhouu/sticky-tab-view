/**
 * V3-2-02：Babel / Metro 分流配置契约测试（PR-1）。
 *
 * 依据 R3-004：
 *   - Expo SDK 53 由 babel-preset-expo 自动注入 react-native-reanimated/plugin；但本仓库的
 *     example 位于 pnpm monorepo 内，自动注入会把 plugin 解析到“仓库根”的 reanimated
 *     （库自测版），与 example 运行时副本版本不一致（3.17.5 vs 3.19.5 → “Mismatch between
 *     JavaScript code version and Reanimated Babel plugin version”）。故 example 显式以
 *     `reanimated: false` 关闭自动注入，再用 require.resolve 手动钉住 example 侧 plugin。
 *     契约据此收紧为：**有效配置里恰好一个 reanimated plugin，且与 example 运行时同源**；
 *   - RN CLI fixture 不使用 babel-preset-expo，必须显式添加 plugin 且放在最后；
 *   - 两个锚点的 Metro 都必须使用 Reanimated 3 的 wrapWithReanimatedMetroConfig；
 *   - Worklets plugin 在 v3 维护线中根本不允许出现。
 *
 * 红态（当前 2.0.0 / Expo 54）：example 仍显式使用 react-native-worklets/plugin，
 * metro 无 wrapper，fixtures/rn-081 不存在，故以下断言按预期失败。
 */

import fs from 'fs';
import path from 'path';
import { createRequire } from 'node:module';

const ROOT = path.resolve(__dirname, '..');
const EXAMPLE_DIR = path.join(ROOT, 'example');
const RN081_DIR = path.join(ROOT, 'fixtures', 'rn-081');

// pnpm 隔离布局：example 的依赖必须从 example 侧解析，不能借用仓库根的 hoist。
const EXAMPLE_REQUIRE = createRequire(path.join(EXAMPLE_DIR, 'package.json'));

// 模拟 Metro 调用 Babel 时的 caller；babel-preset-expo 依赖它决定注入哪些插件。
const EXPO_METRO_CALLER = {
  name: 'metro',
  platform: 'ios',
  engine: 'hermes',
  isDev: true,
  isNodeModule: false,
  supportsStaticESM: false,
  projectRoot: EXAMPLE_DIR,
};

type BabelConfigShape = { presets?: unknown[]; plugins?: unknown[] };

function loadExampleBabelConfig(): BabelConfigShape {
  const factory = EXAMPLE_REQUIRE('./babel.config.js') as (api: {
    cache: () => void;
  }) => BabelConfigShape;
  return factory({ cache: () => {} });
}

describe('Babel/Metro split config contract (V3-2-02)', () => {
  describe('Expo SDK 53 anchor (example workspace)', () => {
    test('babel.config.js disables preset auto-injection and pins one reanimated plugin', () => {
      const cfg = loadExampleBabelConfig();
      const raw = fs.readFileSync(path.join(EXAMPLE_DIR, 'babel.config.js'), 'utf-8');

      // 必须使用 babel-preset-expo，并显式关闭其 reanimated 自动注入（见文件头 R3-004）。
      const expoPreset = (cfg.presets ?? []).find(
        (preset) => String(Array.isArray(preset) ? preset[0] : preset) === 'babel-preset-expo',
      );
      expect(expoPreset).toBeDefined();
      const expoOptions = (Array.isArray(expoPreset) ? expoPreset[1] : undefined) as
        { reanimated?: unknown } | undefined;
      expect(expoOptions?.reanimated).toBe(false);

      // 关掉自动注入后必须手动补上恰好一个 plugin，且由 example 侧 require.resolve 解析。
      expect(cfg.plugins).toEqual([EXAMPLE_REQUIRE.resolve('react-native-reanimated/plugin')]);

      // Worklets plugin 在 v3 维护线中根本不允许出现。
      expect(raw).not.toContain('react-native-worklets/plugin');
    });

    test('the pinned plugin is the same reanimated copy the example runs', () => {
      const pluginEntry = String((loadExampleBabelConfig().plugins ?? [])[0]);
      const runtimePkgDir = path.dirname(
        EXAMPLE_REQUIRE.resolve('react-native-reanimated/package.json'),
      );
      // plugin 落在运行时所用 reanimated 包目录内 = 同源，杜绝 3.17.5 vs 3.19.5 错配。
      expect(pluginEntry.startsWith(runtimePkgDir + path.sep)).toBe(true);
    });

    test('effective Babel config resolves to exactly one reanimated plugin', () => {
      const babel = EXAMPLE_REQUIRE('@babel/core');
      const result = babel.transformSync('export default 1;\n', {
        filename: path.join(EXAMPLE_DIR, 'src', 'babel-contract-probe.ts'),
        cwd: EXAMPLE_DIR,
        root: EXAMPLE_DIR,
        configFile: path.join(EXAMPLE_DIR, 'babel.config.js'),
        babelrc: false,
        ast: false,
        caller: EXPO_METRO_CALLER,
      });
      const keys: string[] = (result.options.plugins ?? []).map(
        (plugin: { key?: string }) => plugin.key ?? '',
      );
      // 恰好一个：0 = 关掉自动注入却忘了手动添加；≥2 = 自动注入与手动配置叠加。
      expect(keys.filter((key) => key.includes('reanimated'))).toHaveLength(1);
      expect(keys.filter((key) => key.includes('worklets'))).toHaveLength(0);
    });

    test('babel-preset-expo injects one plugin unless reanimated:false disables it', () => {
      const presetFn = EXAMPLE_REQUIRE('babel-preset-expo') as (
        api: { caller: (fn: (caller: unknown) => unknown) => unknown },
        options: Record<string, unknown>,
      ) => { plugins?: unknown[] };
      const reanimatedPlugin = createRequire(EXAMPLE_REQUIRE.resolve('babel-preset-expo'))(
        'react-native-reanimated/plugin',
      );
      const api = { caller: (fn: (caller: unknown) => unknown) => fn(EXPO_METRO_CALLER) };

      const injected = (options: Record<string, unknown>) =>
        (presetFn(api, options).plugins ?? []).filter((plugin) => {
          const fn = Array.isArray(plugin) ? plugin[0] : plugin;
          return fn === reanimatedPlugin;
        }).length;

      // 这正是 example/babel.config.js 关闭自动注入的依据：默认注入一个，关掉后为 0。
      expect(injected({})).toBe(1);
      expect(injected({ reanimated: false })).toBe(0);
    });

    test('metro.config.js wraps the Expo config with wrapWithReanimatedMetroConfig', () => {
      const cfg = fs.readFileSync(path.join(EXAMPLE_DIR, 'metro.config.js'), 'utf-8');
      expect(cfg).toContain('wrapWithReanimatedMetroConfig');
    });
  });

  describe('RN CLI 0.81 anchor (fixtures/rn-081)', () => {
    test('fixture workspace exists with babel.config.js', () => {
      expect(fs.existsSync(RN081_DIR)).toBe(true);
      expect(fs.existsSync(path.join(RN081_DIR, 'package.json'))).toBe(true);
      expect(fs.existsSync(path.join(RN081_DIR, 'babel.config.js'))).toBe(true);
    });

    test('babel.config.js lists react-native-reanimated/plugin as the last plugin', () => {
      const cfg = fs.readFileSync(path.join(RN081_DIR, 'babel.config.js'), 'utf-8');
      expect(cfg).toContain('module:@react-native/babel-preset');
      expect(cfg).toContain('react-native-reanimated/plugin');
      expect(cfg).not.toContain('react-native-worklets/plugin');

      const m = cfg.match(/plugins:\s*\[([^\]]*)\]/s);
      expect(m).not.toBeNull();
      const entries = m![1]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      expect(entries.length).toBeGreaterThan(0);
      expect(entries[entries.length - 1]).toContain('react-native-reanimated/plugin');
    });

    test('metro.config.js wraps with wrapWithReanimatedMetroConfig', () => {
      const cfg = fs.readFileSync(path.join(RN081_DIR, 'metro.config.js'), 'utf-8');
      expect(cfg).toContain('wrapWithReanimatedMetroConfig');
    });
  });
});
