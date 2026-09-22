// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import type { WithId } from '@medplum/core';
import { TimezoneExtensionURI } from '@medplum/core';
import type { HealthcareService, Practitioner, Schedule } from '@medplum/fhirtypes';
import { describe, expect, test } from 'vitest';
import {
  setHealthcareServiceSchedulingParameterValues,
  setScheduleSchedulingParameterValues,
} from '../../parameterValues';
import type { ParameterRow } from './parameterRows';
import { getParameterRows } from './parameterRows';

const service = setHealthcareServiceSchedulingParameterValues(
  { resourceType: 'HealthcareService', id: 'visit', name: 'Annual exam' } satisfies WithId<HealthcareService>,
  { duration: 30, bufferAfter: 10 }
);
const calendar: Schedule = { resourceType: 'Schedule', id: 'calendar', actor: [{ reference: 'Practitioner/dr' }] };
const practitioner: WithId<Practitioner> = {
  resourceType: 'Practitioner',
  id: 'dr',
  extension: [{ url: TimezoneExtensionURI, valueCode: 'America/Denver' }],
};

function rowFor(rows: ParameterRow[], parameter: ParameterRow['parameter']): ParameterRow | undefined {
  return rows.find((row) => row.parameter === parameter);
}

describe('getParameterRows', () => {
  test('a visit type on its own: what it sets, then defaults, then nothing', () => {
    const rows = getParameterRows(service);

    expect(rowFor(rows, 'duration')).toMatchObject({ display: '30 min', source: 'visit type' });
    expect(rowFor(rows, 'bufferBefore')).toMatchObject({ display: '0 min', source: 'default' });
    expect(rowFor(rows, 'slotCapacity')).toMatchObject({ display: '1', source: 'default' });
    expect(rowFor(rows, 'alignmentTimezone')).toMatchObject({ display: 'Etc/UTC', source: 'default' });
    expect(rowFor(rows, 'timezone')).toMatchObject({ display: 'Not set', source: 'not set' });
  });

  test('a calendar override wins over the visit type', () => {
    const overriding = setScheduleSchedulingParameterValues(calendar, service, { bufferAfter: 20 });

    const rows = getParameterRows(service, overriding);

    expect(rowFor(rows, 'bufferAfter')).toMatchObject({
      display: '20 min',
      source: 'calendar',
      sourceLabel: 'This calendar',
    });
    expect(rowFor(rows, 'duration')).toMatchObject({ display: '30 min', source: 'visit type' });
  });

  test("a calendar's time zone falls back to its actor when neither level sets one", () => {
    const rows = getParameterRows(service, calendar, practitioner);

    expect(rowFor(rows, 'timezone')).toMatchObject({
      display: 'America/Denver',
      source: 'actor',
      sourceLabel: 'Provider',
    });
  });

  test('a visit type that sets no duration has none in effect', () => {
    const unconfigured: WithId<HealthcareService> = { resourceType: 'HealthcareService', id: 'bare' };

    expect(rowFor(getParameterRows(unconfigured), 'duration')).toMatchObject({
      display: 'Not set',
      source: 'not set',
    });
  });

  test('lists every parameter once', () => {
    expect(getParameterRows(service).map((row) => row.parameter)).toHaveLength(8);
  });
});
