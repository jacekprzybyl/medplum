// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import type { WithId } from '@medplum/core';
import type { Bundle, HealthcareService, Practitioner, Resource, Schedule } from '@medplum/fhirtypes';
import { MockClient } from '@medplum/mock';
import { searchConfigurableCalendars, searchConfigurableServices } from './configSearch';

const configured: WithId<HealthcareService> = {
  resourceType: 'HealthcareService',
  id: 'configured',
  name: 'Annual exam',
  extension: [
    {
      url: 'https://medplum.com/fhir/StructureDefinition/SchedulingParameters',
      extension: [{ url: 'duration', valueDuration: { value: 30, unit: 'min' } }],
    },
  ],
};
const unconfigured: WithId<HealthcareService> = {
  resourceType: 'HealthcareService',
  id: 'unconfigured',
  name: 'Blood draw',
};
const deactivated: WithId<HealthcareService> = {
  resourceType: 'HealthcareService',
  id: 'deactivated',
  name: 'Consult',
  active: false,
};

const drAdams: WithId<Practitioner> = {
  resourceType: 'Practitioner',
  id: 'dr-adams',
  name: [{ prefix: ['Dr.'], given: ['Ada'], family: 'Adams' }],
};
const drBaker: WithId<Practitioner> = {
  resourceType: 'Practitioner',
  id: 'dr-baker',
  name: [{ prefix: ['Dr.'], given: ['Ben'], family: 'Baker' }],
  active: false,
};

function calendar(id: string, actors: string[], active?: boolean): WithId<Schedule> {
  return {
    resourceType: 'Schedule',
    id,
    ...(active !== undefined && { active }),
    actor: actors.map((reference) => ({ reference })),
  };
}

async function setupClient(resources: readonly Resource[]): Promise<MockClient> {
  // Unseeded, so the default Dr. Alice Smith calendar does not join every result.
  const medplum = new MockClient({ seedDefaultData: false });
  for (const resource of resources) {
    await medplum.createResource(resource);
  }
  vi.spyOn(medplum, 'search');
  return medplum;
}

// `searchResourcePages` hands `search` a URLSearchParams rather than the record it was given.
function querySentTo(medplum: MockClient, index = 0): Record<string, string> {
  return Object.fromEntries(vi.mocked(medplum.search).mock.calls[index][1] as URLSearchParams);
}

function searchset<T extends WithId<Resource>>(resources: T[], next?: string): Bundle<T> {
  return {
    resourceType: 'Bundle',
    type: 'searchset',
    entry: resources.map((resource) => ({ resource })),
    ...(next && { link: [{ relation: 'next', url: next }] }),
  };
}

describe('searchConfigurableServices', () => {
  test('returns deactivated and unconfigured visit types, which booking leaves out', async () => {
    const medplum = await setupClient([configured, unconfigured, deactivated]);

    const { services, complete } = await searchConfigurableServices(medplum);

    expect(services.map((service) => service.id).sort()).toEqual(['configured', 'deactivated', 'unconfigured']);
    expect(complete).toBe(true);
  });

  test('sorts by name and filters on nothing', async () => {
    const medplum = await setupClient([configured]);

    await searchConfigurableServices(medplum);

    expect(querySentTo(medplum)).toEqual({ _sort: 'name', _count: '200' });
  });

  test('reading exactly the limit, with nothing left over, is complete', async () => {
    const medplum = await setupClient([configured, unconfigured]);

    const { services, complete } = await searchConfigurableServices(medplum, { limit: 2 });

    expect(services).toHaveLength(2);
    expect(complete).toBe(true);
  });

  test('stops at the limit and reports the rest missing', async () => {
    const medplum = await setupClient([configured, unconfigured, deactivated]);

    const { services, complete } = await searchConfigurableServices(medplum, { limit: 2 });

    expect(services).toHaveLength(2);
    expect(complete).toBe(false);
  });

  // MockClient's bundles never carry a `next` link, so it only ever serves one page. Stubbing `search` still
  // runs the real paging loop, which is what calls it.
  test('reads every page', async () => {
    const medplum = await setupClient([]);
    vi.mocked(medplum.search)
      .mockResolvedValueOnce(
        searchset([configured, unconfigured], 'https://example.com/fhir/R4/HealthcareService?_offset=2')
      )
      .mockResolvedValueOnce(searchset([deactivated]));

    const { services, complete } = await searchConfigurableServices(medplum, { pageSize: 2 });

    expect(services.map((service) => service.id)).toEqual(['configured', 'unconfigured', 'deactivated']);
    expect(complete).toBe(true);
    expect(querySentTo(medplum, 1)._offset).toBe('2');
  });

  test('a limit reached on a page with a next link is incomplete', async () => {
    const medplum = await setupClient([]);
    vi.mocked(medplum.search).mockResolvedValueOnce(
      searchset([configured, unconfigured], 'https://example.com/fhir/R4/HealthcareService?_offset=2')
    );

    const { services, complete } = await searchConfigurableServices(medplum, { pageSize: 2, limit: 2 });

    expect(services).toHaveLength(2);
    expect(complete).toBe(false);
    expect(medplum.search).toHaveBeenCalledTimes(1);
  });

  test('rejects once aborted', async () => {
    const medplum = await setupClient([configured]);
    const controller = new AbortController();
    controller.abort();

    await expect(searchConfigurableServices(medplum, { signal: controller.signal })).rejects.toThrow();
  });
});

describe('searchConfigurableCalendars', () => {
  test('returns deactivated calendars and calendars whose actor is deactivated', async () => {
    const medplum = await setupClient([
      drAdams,
      drBaker,
      calendar('adams', ['Practitioner/dr-adams'], false),
      calendar('baker', ['Practitioner/dr-baker']),
    ]);

    const { candidates, complete, skipped } = await searchConfigurableCalendars(medplum);

    expect(candidates.map((candidate) => candidate.schedule.id)).toEqual(['adams', 'baker']);
    expect(candidates[1].actorResource).toMatchObject({ id: 'dr-baker', active: false });
    expect(complete).toBe(true);
    expect(skipped).toBe(0);
  });

  test('pairs each calendar with its actor and sorts by its name', async () => {
    const medplum = await setupClient([
      drAdams,
      drBaker,
      calendar('b', ['Practitioner/dr-baker']),
      calendar('a', ['Practitioner/dr-adams']),
    ]);

    const { candidates } = await searchConfigurableCalendars(medplum);

    expect(candidates.map((candidate) => candidate.actorResource?.id)).toEqual(['dr-adams', 'dr-baker']);
    expect(querySentTo(medplum)).toEqual({ _count: '200', _include: 'Schedule:actor' });
  });

  test('counts calendars it cannot show instead of dropping them silently', async () => {
    const medplum = await setupClient([
      drAdams,
      calendar('shared', ['Practitioner/dr-adams', 'Location/room-1']),
      calendar('role', ['PractitionerRole/role-1']),
      calendar('fine', ['Practitioner/dr-adams']),
    ]);

    const { candidates, skipped } = await searchConfigurableCalendars(medplum);

    expect(candidates.map((candidate) => candidate.schedule.id)).toEqual(['fine']);
    expect(skipped).toBe(2);
  });

  test('included actors do not count toward the limit', async () => {
    const medplum = await setupClient([
      drAdams,
      drBaker,
      calendar('a', ['Practitioner/dr-adams']),
      calendar('b', ['Practitioner/dr-baker']),
    ]);

    const { candidates, complete } = await searchConfigurableCalendars(medplum, { limit: 2 });

    expect(candidates).toHaveLength(2);
    expect(complete).toBe(true);
  });

  test('stops at the limit and reports the rest missing', async () => {
    const medplum = await setupClient([
      drAdams,
      drBaker,
      calendar('a', ['Practitioner/dr-adams']),
      calendar('b', ['Practitioner/dr-baker']),
    ]);

    const { candidates, complete } = await searchConfigurableCalendars(medplum, { limit: 1 });

    expect(candidates).toHaveLength(1);
    expect(complete).toBe(false);
  });

  test('reads every page, keeping the actors each page includes', async () => {
    const medplum = await setupClient([]);
    vi.mocked(medplum.search)
      .mockResolvedValueOnce(
        searchset<WithId<Resource>>(
          [calendar('a', ['Practitioner/dr-adams']), drAdams],
          'https://example.com/fhir/R4/Schedule?_offset=1'
        )
      )
      .mockResolvedValueOnce(searchset<WithId<Resource>>([calendar('b', ['Practitioner/dr-baker']), drBaker]));

    const { candidates, complete } = await searchConfigurableCalendars(medplum, { pageSize: 1 });

    expect(candidates.map((candidate) => candidate.actorResource?.id)).toEqual(['dr-adams', 'dr-baker']);
    expect(complete).toBe(true);
  });
});
