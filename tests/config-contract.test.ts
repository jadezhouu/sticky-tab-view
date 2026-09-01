/**
 * V3-2-02：Babel / Metro 分流配置契约测试（PR-1）。
 *
 * 依据 R3-004：
 *   - Expo SDK 53 的 babel-preset-expo 检测到 react-native-reanimated 后自动注入
 *     react-native-reanimated/plugin，Expo 配置不得手动重复添加；
 *   - RN CLI fixture 不使用 babel-preset-expo，必须显式添加 plugin 且放在最后；
 *   - 两个锚点的 Metro 都必须使用 Reanimated 3 的 wrapWithReanimatedMetroConfig。
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

describe('Babel/Metro split config contract (V3-2-02)', () => {
  describe('Expo SDK 53 anchor (example workspace)', () => {
    test('babel.config.js uses only babel-preset-expo with no manual plugin', () => {
      const cfg = fs.readFileSync(path.join(EXAMPLE_DIR, 'babel.config.js'), 'utf-8');
      expect(cfg).toContain('babel-preset-expo');
      // babel-preset-expo 自动注入 reanimated plugin；不得手动重复添加。
      expect(cfg).not.toContain('react-native-reanimated/plugin');
      // Worklets plugin 在 v3 维护线中根本不允许出现。
      expect(cfg).not.toContain('react-native-worklets/plugin');
    });

    test('metro.config.js wraps the Expo config with wrapWithReanimatedMetroConfig', () => {
      const cfg = fs.readFileSync(path.join(EXAMPLE_DIR, 'metro.config.js'), 'utf-8');
      expect(cfg).toContain('wrapWithReanimatedMetroConfig');
    });

    test('babel-preset-expo expands to exactly one reanimated plugin', () => {
      // 需要 example 以 devDependency 声明 babel-preset-expo（pnpm 不 hoist 传递依赖），
      // 否则这里的解析失败属于红态，由 V3-3-04 修复。
      const req = createRequire(path.join(EXAMPLE_DIR, 'package.json'));
      let presetFn;
      try {
        presetFn = req('babel-preset-expo');
      } catch {
        throw new Error(
          'example must declare babel-preset-expo as devDependency for preset-expansion check',
        );
      }

      // loadPartialConfig 不会展开 preset 里的 plugins，所以直接以 babel 的 API 形态
      // 调用 babel-preset-expo 函数（模拟 Metro 的 caller），断言展开后恰好一个 Reanimated plugin。
      const presetPath = req.resolve('babel-preset-expo');
      const presetRequire = createRequire(presetPath);
      const reanimatedPlugin = presetRequire('react-native-reanimated/plugin');

      const CALLER = {
        name: 'metro',
        platform: 'ios',
        engine: 'hermes',
        isDev: true,
        isNodeModule: false,
        supportsStaticESM: false,
        projectRoot: EXAMPLE_DIR,
      };
      const api = { caller: (fn: (c: unknown) => unknown) => fn(CALLER) };
      const result = presetFn(api, {}) as { plugins?: unknown[] };
      const plugins = result.plugins ?? [];
      expect(plugins.length).toBeGreaterThan(0);

      const matches = plugins.filter((p) => {
        const fn = Array.isArray(p) ? (p as unknown[])[0] : p;
        return fn === reanimatedPlugin;
      });
      // 恰好一个：0 个说明没检测到 reanimated，≥2 说明与手动配置重复。
      expect(matches).toHaveLength(1);
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
