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
