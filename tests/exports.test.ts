/**
 * 库发布质量测试。
 *
 * 验证构建产物完整性、导出对齐度、package.json 合规性和 tarball 内容。
 * 不直接 require 含原生模块的 JS 文件 —— 那是 Metro/设备验证的职责。
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'node:child_process';

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

// ── helpers ──────────────────────────────────────────────

/** 从源码/产物文本中提取 export 声明的目标模块名（去掉 ./ 前缀） */
function getExportModuleTargets(content: string): string[] {
  const modules: string[] = [];
  // export * from "./X.js"  或  export { A } from "./X.js"  或  export type { A } from "./X.js"
  // 引号接受单/双两种：项目 prettier 配置为 singleQuote（dist 编译产物随 src 用单引号）。
  const re = /^\s*export(?:\s+type)?\s*(?:\*|\{[^}]*\})\s*from\s*['"]\.\/([^"']+)['"]/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    modules.push(m[1]);
  }
  return modules;
}

/** 读取 src/index.ts 中 export 引用的目标模块名 */
function getSourceExports(): string[] {
  const src = fs.readFileSync(path.join(ROOT, 'src', 'index.ts'), 'utf-8');
  return getExportModuleTargets(src);
}

/**
 * 读取 dist/index.d.ts 中 export 引用的目标模块名。
 * 注意：编译出的 dist/index.js 会剔除 type-only 导出，因此用保留类型的 .d.ts 做对齐。
 */
function getDistExports(): string[] {
  const dist = fs.readFileSync(path.join(DIST, 'index.d.ts'), 'utf-8');
  return getExportModuleTargets(dist);
}

/** 从 dist/index.d.ts 入口提取显式导出的名字集合（严格快照的事实来源） */
function getEntryExports(): string[] {
  const entry = fs.readFileSync(path.join(DIST, 'index.d.ts'), 'utf-8');
  const names = new Set<string>();
  // export { A, B } from ...  /  export type { A, B } from ...
  const re = /export(?:\s+type)?\s*\{([^}]*)\}\s*from/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(entry)) !== null) {
    for (const name of m[1].match(/[A-Za-z_$][A-Za-z0-9_$]*/g) ?? []) {
      names.add(name);
    }
  }
  return [...names].sort();
}

/** 递归列出目录下所有文件（相对路径） */
function listFiles(dir: string): string[] {
  const result: string[] = [];
  function walk(d: string) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else {
        result.push(path.relative(dir, full));
      }
    }
  }
  walk(dir);
  return result.sort();
}

// ── 1. package.json 合规性 ──────────────────────────────

describe('package.json compliance', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'));

  test('name and version are set', () => {
    expect(pkg.name).toBe('@jadezhou/sticky-tab-view');
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  test('main points to built JS', () => {
    expect(pkg.main).toBe('./dist/index.js');
  });

  test('types point to built declarations', () => {
    expect(pkg.types).toBe('./dist/index.d.ts');
  });

  test('exports map is correct for publish', () => {
    expect(pkg.exports['.'].types).toBe('./dist/index.d.ts');
    expect(pkg.exports['.']['react-native']).toBe('./dist/index.js');
    expect(pkg.exports['.'].import).toBe('./dist/index.js');
    expect(pkg.exports['.'].default).toBe('./dist/index.js');
    expect(pkg.exports['./package.json']).toBe('./package.json');
  });

  test('exports map is frozen to "." and "./package.json" only (P1-01)', () => {
    // 内部适配层 scheduleOnReactNative 已内聚：不得通过任何子路径 export 暴露，
    // 也不得把未来内部实现泄漏到发布面。新增子路径必须显式修改此冻结清单。
    expect(Object.keys(pkg.exports).sort()).toEqual(['.', './package.json']);
  });

  test('scheduleOnReactNative is internal-only: not in entry source or entry dist (P1-01)', () => {
    const srcEntry = fs.readFileSync(path.join(ROOT, 'src', 'index.ts'), 'utf-8');
    const distEntry = fs.readFileSync(path.join(DIST, 'index.d.ts'), 'utf-8');
    expect(srcEntry).not.toContain('scheduleOnReactNative');
    expect(distEntry).not.toContain('scheduleOnReactNative');
  });

  test('package is ESM-only (type: module)', () => {
    expect(pkg.type).toBe('module');
    // main/types retained only as legacy-tool fallbacks
    expect(pkg.main).toBe('./dist/index.js');
    expect(pkg.types).toBe('./dist/index.d.ts');
  });

  test('files only contain dist, README, LICENSE (no src)', () => {
    expect(pkg.files).toContain('dist');
    expect(pkg.files).toContain('README.md');
    expect(pkg.files).toContain('LICENSE');
    expect(pkg.files).not.toContain('src');
    expect(pkg.files).not.toContain('example');
    expect(pkg.files).not.toContain('app');
    expect(pkg.files).not.toContain('node_modules');
  });

  test('peer dependencies match the verified compatibility matrix', () => {
    expect(pkg.peerDependencies).toEqual({
      react: '>=19.0.0 <20.0.0',
      'react-native': '>=0.79.0 <0.82.0',
      'react-native-gesture-handler': '>=2.24.0 <2.29.0',
      'react-native-reanimated': '>=3.17.4 <3.20.0',
    });
  });

  test('no Expo packages in dependencies', () => {
    const depNames = Object.keys(pkg.dependencies || {});
    const expoDeps = depNames.filter((d: string) => d.startsWith('expo'));
    expect(expoDeps).toEqual([]);
  });

  test('lodash is the only runtime dependency', () => {
    const depNames = Object.keys(pkg.dependencies || {});
    expect(depNames).toEqual(['lodash']);
  });
});

// ── 2. 构建产物完整性 ───────────────────────────────────

describe('dist/ build output integrity', () => {
  test('dist directory exists', () => {
    expect(fs.existsSync(DIST)).toBe(true);
  });

  test('dist/index.js and dist/index.d.ts exist', () => {
    expect(fs.existsSync(path.join(DIST, 'index.js'))).toBe(true);
    expect(fs.existsSync(path.join(DIST, 'index.d.ts'))).toBe(true);
  });

  test('every .ts/.tsx source has matching .js and .d.ts in dist', () => {
    const srcFiles = listFiles(path.join(ROOT, 'src')).filter(
      (f) => (f.endsWith('.ts') || f.endsWith('.tsx')) && !f.endsWith('.d.ts'),
    );
    const distFiles = new Set(listFiles(DIST));

    for (const srcFile of srcFiles) {
      const jsFile = srcFile.replace(/\.tsx?$/, '.js');
      const dtsFile = srcFile.replace(/\.tsx?$/, '.d.ts');

      expect(distFiles.has(jsFile)).toBe(true);
      expect(distFiles.has(dtsFile)).toBe(true);
    }
  });

  test('no stale artifacts: every .js/.d.ts in dist maps back to a source file', () => {
    const srcFiles = new Set(
      listFiles(path.join(ROOT, 'src')).filter(
        (f) => (f.endsWith('.ts') || f.endsWith('.tsx')) && !f.endsWith('.d.ts'),
      ),
    );
    const distFiles = listFiles(DIST).filter((f) => f.endsWith('.js') || f.endsWith('.d.ts'));

    for (const distFile of distFiles) {
      const srcTsFile = distFile.replace(/\.js$/, '.ts').replace(/\.d\.ts$/, '.ts');
      const srcTsxFile = distFile.replace(/\.js$/, '.tsx').replace(/\.d\.ts$/, '.tsx');
      expect(srcFiles.has(srcTsFile) || srcFiles.has(srcTsxFile)).toBe(true);
    }
  });

  test('no .ts or .tsx files in dist (only .js and .d.ts)', () => {
    const distFiles = listFiles(DIST);
    const tsFiles = distFiles.filter(
      (f) => (f.endsWith('.ts') || f.endsWith('.tsx')) && !f.endsWith('.d.ts'),
    );
    expect(tsFiles).toEqual([]);
  });

  test('dist directory mirrors src directory structure', () => {
    const srcDirs = new Set(
      listFiles(path.join(ROOT, 'src'))
        .map((f) => path.dirname(f))
        .filter(Boolean),
    );
    const distDirs = new Set(
      listFiles(DIST)
        .map((f) => path.dirname(f))
        .filter(Boolean),
    );
    for (const d of srcDirs) {
      expect(distDirs.has(d)).toBe(true);
    }
  });
});

// ── 3. 导出对齐度 ───────────────────────────────────────

describe('export alignment: src/index.ts ↔ dist/index.d.ts', () => {
  test('same number of re-exported modules', () => {
    const srcExports = getSourceExports();
    const distExports = getDistExports();
    expect(distExports.length).toBe(srcExports.length);
  });

  test('same re-export targets in src and dist', () => {
    const srcExports = getSourceExports().sort();
    const distExports = getDistExports().sort();
    expect(distExports).toEqual(srcExports);
  });
});

// ── 4. 类型声明覆盖 ─────────────────────────────────────

describe('type declaration coverage', () => {
  test('every .d.ts file is non-empty', () => {
    const distFiles = listFiles(DIST).filter((f) => f.endsWith('.d.ts'));
    for (const f of distFiles) {
      const content = fs.readFileSync(path.join(DIST, f), 'utf-8');
      expect(content.length).toBeGreaterThan(0);
    }
  });

  test('dist/index.d.ts re-exports from all submodules', () => {
    const dts = fs.readFileSync(path.join(DIST, 'index.d.ts'), 'utf-8');
    const srcExports = getSourceExports();
    for (const mod of srcExports) {
      const escaped = mod.replace(/\//g, '\\/');
      expect(dts).toMatch(new RegExp(`from ["']\\.\\/${escaped}`));
    }
  });

  test('public types are declared in dist/types.d.ts', () => {
    const typesDts = fs.readFileSync(path.join(DIST, 'types.d.ts'), 'utf-8');
    // 公共类型必须存在
    const publicTypes = [
      'TStickyTabViewProps',
      'TElasticScrollViewProps',
      'TFetchContext',
      'TMasonryListProps',
      'TFetchRes',
      'TSectionData',
      'TOnRefreshParam',
      'TDirection',
      'TItemBase',
      'TMasonryErrorInfo',
      'TMasonryRequestPhase',
      'TPanHandler',
    ];
    for (const typeName of publicTypes) {
      expect(typesDts).toContain(typeName);
    }
  });

  test('dist declarations do not publish internal implementation types', () => {
    const entryDts = fs.readFileSync(path.join(DIST, 'index.d.ts'), 'utf-8');
    const internalTypes = [
      'TElasticScrollViewCoreProps',
      'TScrollHandlers',
      'TScrollSizes',
      'TThumb',
      'TMasonryCellProps',
    ];

    for (const typeName of internalTypes) {
      expect(entryDts).not.toContain(` ${typeName}`);
    }
  });
});

// ── 5. 发布内容快照 ─────────────────────────────────────

describe('publish tarball snapshot', () => {
  test('no source directories in published files (verified via files field)', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'));
    const published = new Set(pkg.files);
    // files field explicit — npm won't include anything else
    expect(published.has('src')).toBe(false);
    expect(published.has('example')).toBe(false);
    expect(published.has('docs')).toBe(false);
    expect(published.has('tests')).toBe(false);
  });
});

// ── 6. 公共 API 精确名称快照 ─────────────────────────────

/**
 * 首次公开 API 冻结清单。
 *
 * 这份清单是可审阅的公共 API 快照：首发后删除或重命名其中任意一项，
 * 都属于 breaking change，必须进入 major 版本。
 */
const PUBLIC_VALUE_EXPORTS = [
  'StickyTabView',
  'ElasticScrollView',
  'ElasticPullRefreshHeader',
  'MasonryList',
] as const;

const PUBLIC_TYPE_EXPORTS = [
  'StickyTabViewHandle',
  'ElasticScrollViewHandle',
  'TDirection',
  'TElasticScrollViewProps',
  'TFetchContext',
  'TFetchRes',
  'TItemBase',
  'TMasonryErrorInfo',
  'TMasonryListProps',
  'TMasonryRequestPhase',
  'TOnRefreshParam',
  'TPanHandler',
  'TSectionData',
  'TStickyTabViewProps',
] as const;

/** 拼接 dist/ 下所有 .d.ts 内容，用于检查导出声明是否存在。 */
function readAllDeclarations(): string {
  return listFiles(DIST)
    .filter((f) => f.endsWith('.d.ts'))
    .map((f) => fs.readFileSync(path.join(DIST, f), 'utf-8'))
    .join('\n');
}

describe('public API snapshot', () => {
  const decls = readAllDeclarations();

  test('entry point exports EXACTLY the frozen public API (no extras, no missing)', () => {
    const actual = getEntryExports();
    const expected = [...PUBLIC_VALUE_EXPORTS, ...PUBLIC_TYPE_EXPORTS].sort();
    expect(actual).toEqual(expected);
  });

  test('every public value export is declared in dist', () => {
    for (const name of PUBLIC_VALUE_EXPORTS) {
      const re = new RegExp(`export declare const ${name}\\b|export const ${name}\\b`);
      expect(decls).toMatch(re);
    }
  });

  test('every public type export is declared in dist', () => {
    for (const name of PUBLIC_TYPE_EXPORTS) {
      const re = new RegExp(`export (declare )?(interface|type) ${name}\\b`);
      expect(decls).toMatch(re);
    }
  });

  test('index.d.ts explicitly re-exports exactly the 12 types.ts types', () => {
    const entry = fs.readFileSync(path.join(DIST, 'index.d.ts'), 'utf-8');
    // 引号接受单/双两种：项目 prettier 配置为 singleQuote。
    const m = entry.match(/export type \{([^}]+)\} from ['"]\.\/types\.js['"]/);
    expect(m).not.toBeNull();

    const exported = (m![1].match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? [])
      .filter((n) => !['export', 'type'].includes(n))
      .sort();

    const expected = [
      'TDirection',
      'TElasticScrollViewProps',
      'TFetchContext',
      'TFetchRes',
      'TItemBase',
      'TMasonryErrorInfo',
      'TMasonryListProps',
      'TMasonryRequestPhase',
      'TOnRefreshParam',
      'TPanHandler',
      'TSectionData',
      'TStickyTabViewProps',
    ].sort();

    expect(exported).toEqual(expected);
  });

  test('internal types are not re-exported from the entry point', () => {
    const entry = fs.readFileSync(path.join(DIST, 'index.d.ts'), 'utf-8');
    const internalTypes = [
      'TElasticScrollViewCoreProps',
      'TScrollHandlers',
      'TScrollSizes',
      'TThumb',
      'TMasonryCellProps',
      'TFetchCtx',
      'TPos',
      'TFrame',
    ];
    for (const name of internalTypes) {
      expect(entry).not.toContain(name);
    }
  });
});

// ── 7. Reanimated 3 维护线契约（PR-1）───────────────────

/**
 * 以下测试定义「v3 已完成」的最小技术事实。当前（2.0.0 / Reanimated 4）状态下
 * 按预期失败；PR-1 迁移后必须全部转绿。拒绝策略、测试与文档中出现
 * react-native-worklets 字样不算失败。
 */
describe('Reanimated 3 line contract (PR-1)', () => {
  const v3pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'));

  test('version major is 1', () => {
    expect(v3pkg.version).toMatch(/^1\./);
  });

  test('peerDependencies use the overall compatibility boundary without Worklets', () => {
    expect(v3pkg.peerDependencies).toEqual({
      react: '>=19.0.0 <20.0.0',
      'react-native': '>=0.79.0 <0.82.0',
      'react-native-gesture-handler': '>=2.24.0 <2.29.0',
      'react-native-reanimated': '>=3.17.4 <3.20.0',
    });
  });

  test('no react-native-worklets in any package dependency field', () => {
    for (const field of [
      'dependencies',
      'peerDependencies',
      'optionalDependencies',
      'devDependencies',
    ]) {
      const deps = v3pkg[field] || {};
      expect(Object.keys(deps)).not.toContain('react-native-worklets');
    }
  });

  test('compiled dist output does not import react-native-worklets', () => {
    const jsFiles = listFiles(DIST).filter((f) => f.endsWith('.js'));
    expect(jsFiles.length).toBeGreaterThan(0);
    // 只匹配真实 import/require 语句，忽略源码注释里对包名的普通提及。
    const importRe =
      /(?:from\s*["']react-native-worklets|import\s*["']react-native-worklets["']|require\s*\(\s*["']react-native-worklets)/;
    const offenders = jsFiles.filter((f) => {
      const content = fs.readFileSync(path.join(DIST, f), 'utf-8');
      return importRe.test(content);
    });
    expect(offenders).toEqual([]);
  });

  test('tarball content (npm pack dry-run) has no worklets and no src/', () => {
    const out = execSync('npm pack --dry-run --json', {
      cwd: ROOT,
      encoding: 'utf-8',
    });
    // 确认确实打包了 dist 入口，而不是空打包（npm pack --json 的 path 相对包根）。
    expect(out).toContain('dist/index.js');
    // tarball 内容（文件清单）不得出现 worklets；也绝不允许打包 src/。
    expect(out).not.toContain('react-native-worklets');
    expect(out).not.toContain('src/');
  });
});
