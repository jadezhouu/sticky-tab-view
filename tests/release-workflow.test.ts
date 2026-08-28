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
});
