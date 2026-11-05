import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const NOTICE =
  'AI-generated. May be inaccurate. Verify before relying on outputs.';

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8');
}

test('AI output notice uses the required exact text without overlay positioning', () => {
  const source = read('components/AiOutputNotice.tsx');

  assert.match(source, /role="note"/);
  assert.match(source, /aria-label="AI output warning"/);
  assert.doesNotMatch(source, /className="[^"]*sticky[^"]*"/);
  assert.ok(source.includes(NOTICE));
});

test('AI output notice covers every required builder and viewer surface', () => {
  const directSurfaces = [
    'app/cases/[case]/qa/page.tsx',
    'app/cases/[case]/argument-builder/page.tsx',
    'app/cases/[case]/argument-builder/request/page.tsx',
    'app/cases/[case]/argument-builder/[requestId]/page.tsx',
    'app/cases/[case]/declarations/page.tsx',
    'app/cases/[case]/declarations/request/page.tsx',
    'app/cases/[case]/declarations/[requestId]/page.tsx',
  ];

  for (const surface of directSurfaces) {
    const source = read(surface);
    assert.ok(source.includes("@/components/AiOutputNotice"), surface);
    assert.ok(source.includes('actionNotice={<AiOutputNotice />}'), surface);
  }

  const timelineLayout = read('app/cases/[case]/timeline/layout.tsx');
  const timelineShell = read('components/timeline/TimelineShell.tsx');
  assert.ok(timelineLayout.includes('TimelineShell'));
  assert.ok(timelineShell.includes("@/components/AiOutputNotice"));
  assert.ok(timelineShell.includes('actionNotice={<AiOutputNotice />}'));

  const casePageTemplate = read('components/cases/CasePageTemplate.tsx');
  assert.ok(casePageTemplate.includes('actionNotice?: React.ReactNode'));
  assert.ok(casePageTemplate.includes('data-slot="case-page-actions"'));
  assert.ok(casePageTemplate.includes('{actionNotice}'));
  assert.ok(casePageTemplate.includes('{actionSection}'));
});
