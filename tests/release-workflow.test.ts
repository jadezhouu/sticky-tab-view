import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const workflow = readFileSync(resolve(process.cwd(), '.github/workflows/release.yml'), 'utf8');

describe('release workflow recovery contract', () => {
  test('allows an explicit release tag to recover a missed published event', () => {
    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).toMatch(/workflow_dispatch:\s*\n\s*inputs:\s*\n\s*tag:/);
    expect(workflow).toContain('RELEASE_TAG:');
    expect(workflow).toContain('ref: ${{ env.RELEASE_TAG }}');
    expect(workflow).toContain('REF_TAG="${RELEASE_TAG#v}"');
    expect(workflow).toContain('Verify manual release target');
    expect(workflow).toContain("if: github.event_name == 'workflow_dispatch'");
    expect(workflow).toContain('gh release view "${RELEASE_TAG}" --json tagName,isDraft');
  });

  test('routes Reanimated 4 and Reanimated 3 releases to mutually exclusive jobs', () => {
    expect(workflow).toContain('publish-reanimated4:');
    expect(workflow).toContain("if: ${{ startsWith(github.event.release.tag_name || inputs.tag, 'v2.') }}");
    expect(workflow).toContain('publish-reanimated3:');
    expect(workflow).toContain("if: ${{ startsWith(github.event.release.tag_name || inputs.tag, 'v1.') }}");
    expect(workflow).not.toContain('if: startsWith(env.RELEASE_TAG');
  });

  test('publishes the Reanimated 3 line only to its dedicated dist-tags', () => {
    expect(workflow).toContain('Reanimated 3 release line must be 1.x');
    expect(workflow).toContain('tag=reanimated3-next');
    expect(workflow).toContain('tag=reanimated3');
  });

  test('accepts Reanimated 3 releases only from the maintenance branch history', () => {
    expect(workflow).toContain('Verify Reanimated 3 maintenance branch');
    expect(workflow).toContain('maintenance/reanimated-3:refs/remotes/origin/maintenance/reanimated-3');
    expect(workflow).toContain('git merge-base --is-ancestor HEAD origin/maintenance/reanimated-3');
  });
});

describe('Reanimated 3 release line rejects Worklets (control plane gate)', () => {
  // 只针对 publish-reanimated3 job 断言，避免与 publish-reanimated4 的字符串混淆。
  const v3Section = workflow.slice(workflow.indexOf('publish-reanimated3:'));

  test('v3 job blocks react-native-worklets across all four dependency fields', () => {
    expect(v3Section).toContain('react-native-worklets');
    expect(v3Section).toContain('"dependencies"');
    expect(v3Section).toContain('"peerDependencies"');
    expect(v3Section).toContain('"optionalDependencies"');
    expect(v3Section).toContain('"devDependencies"');
  });

  test('v3 job also blocks Worklets that only exist in the lockfile', () => {
    expect(v3Section).toContain('pnpm-lock.yaml');
    expect(v3Section).toContain('react-native-worklets');
  });

  test('Worklets block step runs before any npm publish step in the v3 job', () => {
    const blockIndex = v3Section.indexOf('Block react-native-worklets in Reanimated 3 package');
    const publishIndex = v3Section.indexOf('- name: Publish to npm');
    expect(blockIndex).toBeGreaterThan(-1);
    expect(publishIndex).toBeGreaterThan(-1);
    expect(blockIndex).toBeLessThan(publishIndex);
  });

  test('a Worklets hit fails the v3 publish job (exit 1) instead of warning', () => {
    // 检查 step 必须真正中断发布，而不是只打印告警继续发布。
    const blockStepStart = v3Section.indexOf('Block react-native-worklets in Reanimated 3 package');
    const blockStep = v3Section.slice(blockStepStart, blockStepStart + 2200);
    expect(blockStep).toContain('exit 1');
    expect(blockStep).toContain('::error::');
  });
});
