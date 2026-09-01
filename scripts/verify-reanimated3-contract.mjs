/**
 * V3-3-10：verify:reanimated3 —— Reanimated 3 维护线的独立契约校验。
 *
 * 只校验"实际产物/依赖树/发布文档"层面是否残留 react-native-worklets 与 2.x 线描述：
 *   1. package.json 的 dependencies/peerDependencies/optionalDependencies/devDependencies
 *   2. pnpm-lock.yaml 的解析结果
 *   3. dist/ 下编译产物的 import
 *   4. npm pack --dry-run 的 tarball 文件清单
 *   5. tarball 内随包发布的 README（README.md / README.zh-CN.md）不得出现 2.x 线/Worklets
 *      专属字样（P0-07）：`react-native-worklets/plugin`、`Expo SDK 54`、
 *      `react-native-reanimated >= 4`、以及"v3 尚未可用"类表述。
 *
 * 故意**不**扫描 workflow、test 描述里的政策字符串（它们允许保留该名称），
 * 也不对源码做全仓库字符串禁用。
 *
 * 退出码：任一检查命中即非零。
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');
const FIELD_NAMES = ['dependencies', 'peerDependencies', 'optionalDependencies', 'devDependencies'];

let blocked = false;
const fail = (msg) => {
  console.error(`::error::${msg}`);
  blocked = true;
};

// 1. package metadata
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'));
for (const field of FIELD_NAMES) {
  if (pkg[field] && pkg[field]['react-native-worklets']) {
    fail(`react-native-worklets found in package.json ${field}`);
  }
}
if (pkg.version && !/^1\./.test(pkg.version)) {
  fail(`Reanimated 3 line must be 1.x, got ${pkg.version}`);
}

// 2. lockfile 解析结果
const lock = fs.readFileSync(path.join(ROOT, 'pnpm-lock.yaml'), 'utf-8');
if (lock.includes('react-native-worklets')) {
  fail('react-native-worklets found in pnpm-lock.yaml');
}

// 3. dist 编译产物 import
if (!fs.existsSync(DIST)) {
  fail('dist/ does not exist — run pnpm build first');
} else {
  const js = collectFiles(DIST).filter((f) => f.endsWith('.js'));
  for (const f of js) {
    const content = fs.readFileSync(path.join(ROOT, f), 'utf-8');
    if (content.includes('react-native-worklets')) {
      fail(`${path.relative(ROOT, path.join(DIST, f))} imports react-native-worklets`);
    }
  }
}

// 4. tarball 文件清单
const packOut = execSync('npm pack --dry-run --json', { cwd: ROOT, encoding: 'utf-8' });
if (packOut.includes('react-native-worklets')) {
  fail('tarball (npm pack) references react-native-worklets');
}
if (packOut.includes('package/src/') || /"path":\s*"src\//.test(packOut)) {
  fail('tarball would publish src/ — files allowlist is wrong');
}

// 5. tarball 内随包发布的 README 契约（P0-07）
// npm 会自动把 basename 以 README 开头的文件打进 tarball（files allowlist 之外），
// 因此 README.md 与 README.zh-CN.md 都在发布面内。随包的 README 不得把消费者
// 引向 2.x（Reanimated 4 + Worklets）线：出现任一专属字样即失败。
const README_FILES = ['README.md', 'README.zh-CN.md'];
const README_BANNED = [
  { pattern: /react-native-worklets\/plugin/g, label: 'react-native-worklets/plugin（2.x 线 Babel 插件）' },
  { pattern: /Expo SDK 54/g, label: 'Expo SDK 54（2.x 线锚点）' },
  { pattern: /react-native-reanimated[\s\S]{0,40}>=4/g, label: 'react-native-reanimated >=4（2.x 线 peer）' },
  { pattern: /\bnot yet available\b/gi, label: '"not yet available"（暗示 v3 尚未可用）' },
  { pattern: /尚未可用/g, label: '"尚未可用"（暗示 v3 尚未可用）' },
];
for (const name of README_FILES) {
  const file = path.join(ROOT, name);
  if (!fs.existsSync(file)) {
    fail(`随包 README ${name} 不存在`);
    continue;
  }
  const content = fs.readFileSync(file, 'utf-8');
  for (const { pattern, label } of README_BANNED) {
    if (pattern.test(content)) {
      fail(`${name} 包含 ${label}`);
    }
  }
}

function collectFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectFiles(full));
    else out.push(path.relative(ROOT, full));
  }
  return out;
}

if (blocked) {
  console.error('verify:reanimated3 — FAILED: react-native-worklets / 2.x-line wording leaked into the release surface');
  process.exit(1);
}
console.log('verify:reanimated3 — OK: no react-native-worklets or 2.x-line wording in metadata, lockfile, dist, tarball or bundled READMEs');
