import assert from 'node:assert/strict';
import test from 'node:test';

import { parseStaffModel } from '../lib/types.ts';

test('public staff records exclude contact details and storage metadata', () => {
  const profile = {
    staffId: 'morgan-counsel',
    displayName: 'Morgan Counsel',
    role: 'Staff Attorney',
    focus: 'Family law',
    isCurrent: true,
  };

  assert.deepEqual(parseStaffModel({
    ...profile,
    email: 'morgan@example.test',
    phoneNumber: '+1-555-0100',
    partitionKey: 'staff',
    rowKey: profile.staffId,
    privateNotes: 'Internal staff information',
  }), profile);
  assert.deepEqual(parseStaffModel(profile), profile);
});
