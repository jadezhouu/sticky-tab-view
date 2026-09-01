/**
 * V3-4-01：源码扫描测试（PR-2）。
 *
 * 依据 Phase 4 退出门禁：
 *   - `src/` / `example/` / `fixtures/` 无 react-native-worklets import；
 *   - 除适配层外，不得直接调用 `runOnJS`。适配层有两个允许位置：库内
 *     `src/scheduleOnReactNative.ts`，以及 example 的本地副本
 *     `example/src/utils/scheduleOnReactNative.ts`（P1-01 内聚后 example 不再
 *     通过包子路径导入，改为保留本地副本）。
 *
 * 红态：PR-1 已清除 worklets import（第一条已绿），但所有调用点仍直接使用
 * `runOnJS`（第二条按预期失败）；实现（V3-4-03/04）后全绿。
 * 只扫描工作区真实源码，不扫描 docs/test 描述里的政策字符串。
 */

import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const SCAN_DIRS = ['src', 'example/src', 'fixtures/rn-081'];
// runOnJS 唯一允许出现的文件：库内适配层 + example 的本地副本。
const ADAPTER_RELS = ['src/scheduleOnReactNative.ts', 'example/src/utils/scheduleOnReactNative.ts'];

function listTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listTsFiles(full));
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      out.push(full);
    }
  }
  return out.sort();
}

const WORKLETS_IMPORT_RE =
  /(?:from\s*["']react-native-worklets|import\s*["']react-native-worklets["']|require\s*\(\s*["']react-native-worklets)/;

describe('worklets usage scan (V3-4-01)', () => {
  const files = SCAN_DIRS.flatMap((dir) =>
    listTsFiles(path.join(ROOT, dir)).map((f) => path.relative(ROOT, f)),
  );

  test('no source file imports react-native-worklets', () => {
    const offenders = files.filter((f) =>
      WORKLETS_IMPORT_RE.test(fs.readFileSync(path.join(ROOT, f), 'utf-8')),
    );
    expect(offenders).toEqual([]);
  });

  test('runOnJS is only used inside the adapter layer', () => {
    const offenders = files
      .filter((f) => !ADAPTER_RELS.includes(f))
      .filter((f) => fs.readFileSync(path.join(ROOT, f), 'utf-8').includes('runOnJS'));
    expect(offenders).toEqual([]);
  });

  test('adapter layers exist and are the runOnJS owners', () => {
    // 两个适配层文件必须存在（V3-4-03 之后），且必须包含 runOnJS 实现。
    for (const rel of ADAPTER_RELS) {
      const adapterPath = path.join(ROOT, rel);
      expect(fs.existsSync(adapterPath)).toBe(true);
      const content = fs.readFileSync(adapterPath, 'utf-8');
      expect(content).toContain('runOnJS');
    }
  });
});
