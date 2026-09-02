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

describe('v3 dispatcher ↔ tag-validation integration contract (P0-01/P1-01/P2-02)', () => {
  const dispatcher = readFileSync(
    resolve(process.cwd(), '.github/workflows/v3-native-dispatcher.yml'),
    'utf8',
  );

  test('attestation records triggered_by (triggering_actor), never claims an approver', () => {
    // P1-01：github.triggering_actor 是触发 workflow 的账号，不是批准
    // v3-candidate-attestation environment 的 reviewer；真实审批人由 deployment review
    // 与设备证据单独保存。字段名必须保持 triggered_by，避免错误的审计含义。
    expect(dispatcher).toContain('"triggered_by": "$TRIGGERED_BY"');
    expect(dispatcher).toContain('TRIGGERED_BY: ${{ github.triggering_actor }}');
    expect(dispatcher).not.toContain('"approver"');
  });

  test('pins head_sha to the resolved candidate, not the run head (P0-01 semantics)', () => {
    // GitHub Actions 的 run head_sha 是默认分支 main 触发时的 SHA，与 job 内 checkout 的
    // candidate 无关。attestation 的 head_sha 必须显式取自 v3-resolve-candidate 输出，
    // 且 tag-validation 依赖的正是这个语义（不按 head_sha 定位 run）。
    expect(dispatcher).toContain('"head_sha": "$CANDIDATE_SHA"');
    expect(dispatcher).toContain(
      'CANDIDATE_SHA: ${{ needs.v3-resolve-candidate.outputs.candidate_sha }}',
    );
    expect(dispatcher).toMatch(
      /ref: \${{ needs\.v3-resolve-candidate\.outputs\.candidate_sha }}/,
    );
    // 生产端注释明确固定该语义，防止未来改回 head_sha == candidate 的错误假设。
    expect(dispatcher).toContain('head_sha 是默认分支 main 在触发时的 SHA');
  });

  test('artifact name uses resolved candidate short-sha (12) + run id (P0-01 length contract)', () => {
    // 消费端（maintenance/reanimated-3:tag-validation.yml）按同样的 :0:12 前缀反查 artifact。
    expect(dispatcher).toContain('short_sha=${SHA:0:12}');
    expect(dispatcher).toContain(
      'name: v3-candidate-attestation-${{ needs.v3-resolve-candidate.outputs.short_sha }}-${{ github.run_id }}',
    );
  });

  test('Metro bundle gate follows the matrix platform, not hardcoded android (P2-02)', () => {
    const bundle = dispatcher.slice(dispatcher.indexOf('Metro bundle gate'));
    expect(bundle).toContain('--platform ${{ matrix.platform }}');
    expect(bundle).not.toContain('--platform android');
  });
});
