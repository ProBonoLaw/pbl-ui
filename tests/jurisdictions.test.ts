import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf-8');
}

test('jurisdiction reference data accepts the Azure Table fields used by the admission stepper', async () => {
  const { JurisdictionsResponseSchema } = await import('../lib/types.ts');

  const parsed = JurisdictionsResponseSchema.parse({
    states: [
      {
        jurisdictionCode: 'OK',
        countryCode: 'US',
        name: 'Oklahoma',
        type: 'State',
      },
    ],
    federal: [
      {
        jurisdictionCode: 'OKND',
        countryCode: 'US',
        courtType: 'DistrictCourt',
        jurisdictionType: 'Federal',
        name: 'U.S. District Court for the Northern District of Oklahoma',
        stateCode: 'OK',
        circuitCode: '10',
        parentDistrictCodes: 'OKED,OKWD',
        nationwide: false,
      },
    ],
    tribal: [
      {
        jurisdictionCode: 'CHEROKEE-NATION',
        countryCode: 'US',
        federallyRecognized: true,
        jurisdictionType: 'Tribal',
        name: 'Cherokee Nation',
        sourceAuthority: 'Federal Register',
        sourceNotice: 'Recognition notice',
        sourcePublicationDate: '2026-01-01',
      },
    ],
  });

  assert.equal(parsed.states[0].jurisdictionCode, 'OK');
  assert.equal(parsed.federal[0].courtType, 'DistrictCourt');
  assert.equal(parsed.tribal[0].federallyRecognized, true);
});

test('jurisdiction API reads each configured Azure Table and the profile uses the stepper', () => {
  const route = read('app/api/jurisdictions/route.ts');
  const editor = read('components/profile/BarAdmissionsEditor.tsx');
  const stepper = read('components/profile/BarAdmissionStepper.tsx');

  assert.match(route, /DEFAULT_STATE_TABLE_NAME = 'statejurisdictions'/);
  assert.match(route, /DEFAULT_FEDERAL_TABLE_NAME = 'federaljurisdictions'/);
  assert.match(route, /DEFAULT_TRIBAL_TABLE_NAME = 'tribaljurisdictions'/);
  assert.match(route, /new TableClient\(/);
  assert.match(route, /new DefaultAzureCredential\(\)/);
  assert.match(route, /const jurisdictionCode = stringValue\(entity, 'rowKey'\);/);
  assert.match(editor, /BarAdmissionStepper/);
  assert.match(stepper, /jurisdiction\.name/);
});
