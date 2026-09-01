/**
 * V3-3-10：verify:reanimated3 —— Reanimated 3 维护线的独立契约校验。
 *
 * 只校验"实际产物/依赖树"层面是否残留 react-native-worklets：
 *   1. package.json 的 dependencies/peerDependencies/optionalDependencies/devDependencies
 *   2. pnpm-lock.yaml 的解析结果
 *   3. dist/ 下编译产物的 import
 *   4. npm pack --dry-run 的 tarball 文件清单
 *
 * 故意**不**扫描 workflow、test 描述或 README 里的政策字符串（它们允许保留该名称），
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
  console.error('verify:reanimated3 — FAILED: react-native-worklets leaked into the release surface');
  process.exit(1);
}
console.log('verify:reanimated3 — OK: no react-native-worklets in metadata, lockfile, dist or tarball');
