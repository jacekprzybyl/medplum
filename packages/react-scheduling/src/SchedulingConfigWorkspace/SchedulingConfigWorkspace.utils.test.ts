// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import type { WithId } from '@medplum/core';
import type { Device, HealthcareService, Location, Practitioner } from '@medplum/fhirtypes';
import { describe, expect, test } from 'vitest';
import type { ScheduleCandidate } from '../AppointmentFinder/AppointmentFinder.schedules';
import { setHealthcareServiceSchedulingParameterValues } from '../parameterValues';
import {
  buildPanelItems,
  groupCandidatesByActorType,
  isCandidateInactive,
  isServiceUnconfigured,
  matchesFilter,
} from './SchedulingConfigWorkspace.utils';

function candidate(
  id: string,
  actorResource: WithId<Practitioner> | WithId<Location> | WithId<Device>
): ScheduleCandidate {
  return {
    schedule: {
      resourceType: 'Schedule',
      id,
      actor: [{ reference: `${actorResource.resourceType}/${actorResource.id}` }],
    },
    actorResource,
  };
}

const provider = candidate('p', { resourceType: 'Practitioner', id: 'dr', name: [{ family: 'Adams' }] });
const room = candidate('r', { resourceType: 'Location', id: 'room', name: 'Exam Room A' });
const device = candidate('d', {
  resourceType: 'Device',
  id: 'us',
  deviceName: [{ name: 'Ultrasound', type: 'user-friendly-name' }],
});

const configured = setHealthcareServiceSchedulingParameterValues(
  { resourceType: 'HealthcareService', id: 'exam', name: 'Annual exam' } satisfies WithId<HealthcareService>,
  { duration: 30 }
);
const unconfigured: WithId<HealthcareService> = { resourceType: 'HealthcareService', id: 'draw', name: 'Blood draw' };

describe('groupCandidatesByActorType', () => {
  test('sorts calendars into the section of their actor type', () => {
    expect(groupCandidatesByActorType([room, provider, device])).toEqual({
      Practitioner: [provider],
      Location: [room],
      Device: [device],
    });
  });
});

describe('isCandidateInactive', () => {
  test('an active calendar on an active actor is in use', () => {
    expect(isCandidateInactive(provider)).toBe(false);
  });

  test('a deactivated calendar is out of use', () => {
    expect(isCandidateInactive({ ...provider, schedule: { ...provider.schedule, active: false } })).toBe(true);
  });

  test("a live calendar on a deactivated actor is out of use, whatever the actor's type", () => {
    expect(isCandidateInactive(candidate('p', { resourceType: 'Practitioner', id: 'dr', active: false }))).toBe(true);
    expect(isCandidateInactive(candidate('r', { resourceType: 'Location', id: 'room', status: 'inactive' }))).toBe(
      true
    );
    expect(isCandidateInactive(candidate('d', { resourceType: 'Device', id: 'us', status: 'inactive' }))).toBe(true);
  });
});

describe('isServiceUnconfigured', () => {
  test('is true only without a duration in effect', () => {
    expect(isServiceUnconfigured(configured)).toBe(false);
    expect(isServiceUnconfigured(unconfigured)).toBe(true);
  });
});

describe('matchesFilter', () => {
  test('matches a substring regardless of case, and everything when blank', () => {
    expect(matchesFilter('Exam Room A', 'room')).toBe(true);
    expect(matchesFilter('Exam Room A', '  ')).toBe(true);
    expect(matchesFilter('Exam Room A', 'lab')).toBe(false);
  });
});

describe('buildPanelItems', () => {
  test('marks the selection, and badges unconfigured and inactive rows', () => {
    const items = buildPanelItems([configured, unconfigured], [provider, room], { kind: 'service', id: 'exam' }, '');

    expect(items.service).toEqual([
      { id: 'exam', label: 'Annual exam', selected: true, inactive: false, unconfigured: false },
      { id: 'draw', label: 'Blood draw', selected: false, inactive: false, unconfigured: true },
    ]);
    expect(items.Location).toEqual([{ id: 'r', label: 'Exam Room A', selected: false, inactive: false }]);
    expect(items.Device).toEqual([]);
  });

  test('a calendar selection never selects a visit type sharing its id', () => {
    const shared = candidate('exam', { resourceType: 'Location', id: 'room', name: 'Exam Room A' });

    const items = buildPanelItems([configured], [shared], { kind: 'schedule', id: 'exam' }, '');

    expect(items.service[0].selected).toBe(false);
    expect(items.Location[0].selected).toBe(true);
  });

  test('the filter narrows every section', () => {
    const items = buildPanelItems([configured, unconfigured], [provider, room], undefined, 'a');

    expect(items.service.map((item) => item.label)).toEqual(['Annual exam', 'Blood draw']);
    expect(items.Practitioner.map((item) => item.label)).toEqual(['Adams']);

    const narrowed = buildPanelItems([configured, unconfigured], [provider, room], undefined, 'blood');
    expect(narrowed.service.map((item) => item.label)).toEqual(['Blood draw']);
    expect(narrowed.Practitioner).toEqual([]);
    expect(narrowed.Location).toEqual([]);
  });
});
