/**
 * V3-2-04：锚点依赖解析契约测试（PR-1）。
 *
 * 两个已核实的兼容锚点（R3-00x）：
 *   1. Expo SDK 53 workspace（example）：React 19.0 / RN 0.79 / RNGH 2.24 / Reanimated 3.17
 *   2. RN CLI fixture（fixtures/rn-081）：React 19.1 / RN 0.81 / RNGH 2.28 / Reanimated 3.19
 *
 * 使用 workspace-local require.resolve 读取各 workspace 自己的 node_modules 解析结果，
 * 不读根目录 hoisted 值，避免根目录 hoist 假阳性（根仓库仍可能残留 4.x 依赖树）。
 */

import fs from 'fs';
import path from 'path';
import { createRequire } from 'node:module';

const ROOT = path.resolve(__dirname, '..');

interface Versioned {
  name: string;
  version: string;
}

function resolveVersion(workspaceDir: string, pkg: string): string {
  const req = createRequire(path.join(workspaceDir, 'package.json'));
  const pkgJsonPath = req.resolve(`${pkg}/package.json`);
  const meta: Versioned = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
  return meta.version;
}

/** 提取 major.minor，锚点断言只关注主/次版本。 */
function majorMinor(version: string): string {
  const m = /^(\d+)\.(\d+)/.exec(version);
  if (!m) throw new Error(`unparseable version: ${version}`);
  return `${m[1]}.${m[2]}`;
}

function workletsNotInstalled(workspaceDir: string): void {
  // 用文件系统 symlink 判断，不用 require.resolve —— worklets 可能通过 exports 掩码
  // 使 resolve('./package.json') 抛错而误判为"未安装"。
  const direct = path.join(workspaceDir, 'node_modules', 'react-native-worklets');
  expect(fs.existsSync(direct)).toBe(false);
  // 同时断言 workspace 自身不得在任何依赖字段声明 worklets。
  const pkg = JSON.parse(
    fs.readFileSync(path.join(workspaceDir, 'package.json'), 'utf-8'),
  );
  for (const field of ['dependencies', 'devDependencies', 'peerDependencies']) {
    expect(Object.keys(pkg[field] || {})).not.toContain('react-native-worklets');
  }
}

describe('anchor dependency resolution (V3-2-04)', () => {
  describe('Expo SDK 53 anchor (example workspace)', () => {
    const dir = path.join(ROOT, 'example');
    test('react resolves to 19.0', () => {
      expect(majorMinor(resolveVersion(dir, 'react'))).toBe('19.0');
    });
    test('react-native resolves to 0.79', () => {
      expect(majorMinor(resolveVersion(dir, 'react-native'))).toBe('0.79');
    });
    test('react-native-gesture-handler resolves to 2.24', () => {
      expect(majorMinor(resolveVersion(dir, 'react-native-gesture-handler'))).toBe('2.24');
    });
    test('react-native-reanimated resolves to 3.17', () => {
      expect(majorMinor(resolveVersion(dir, 'react-native-reanimated'))).toBe('3.17');
    });
    test('react-native-worklets is not installed in the Expo workspace', () => {
      workletsNotInstalled(dir);
    });
  });

  describe('RN CLI 0.81 anchor (fixtures/rn-081 workspace)', () => {
    const dir = path.join(ROOT, 'fixtures', 'rn-081');
    test('fixture workspace exists', () => {
      expect(fs.existsSync(path.join(dir, 'package.json'))).toBe(true);
    });
    test('react resolves to 19.1', () => {
      expect(majorMinor(resolveVersion(dir, 'react'))).toBe('19.1');
    });
    test('react-native resolves to 0.81', () => {
      expect(majorMinor(resolveVersion(dir, 'react-native'))).toBe('0.81');
    });
    test('react-native-gesture-handler resolves to 2.28', () => {
      expect(majorMinor(resolveVersion(dir, 'react-native-gesture-handler'))).toBe('2.28');
    });
    test('react-native-reanimated resolves to 3.19', () => {
      expect(majorMinor(resolveVersion(dir, 'react-native-reanimated'))).toBe('3.19');
    });
    test('react-native-worklets is not installed in the CLI fixture', () => {
      workletsNotInstalled(dir);
    });
  });
});
