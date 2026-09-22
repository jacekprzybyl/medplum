// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import { Accordion, Badge, Group, Stack, Text, Title } from '@mantine/core';
import type { WithId } from '@medplum/core';
import { extractServiceTypeReferences, getDisplayString, getScheduleSchedulingParameters } from '@medplum/core';
import type { HealthcareService, Reference } from '@medplum/fhirtypes';
import type { JSX } from 'react';
import { getActorType, getActorTypeLabel } from '../../actors';
import type { ScheduleCandidate } from '../../AppointmentFinder/AppointmentFinder.schedules';
import { getCandidateActor, getCandidateDisplay } from '../../AppointmentFinder/AppointmentFinder.schedules';
import {
  getEffectiveSchedulingParameterValues,
  getHealthcareServiceSchedulingParameterValues,
  getScheduleSchedulingParameterValues,
} from '../../parameterValues';
import { getSchedulingParameterWarnings } from '../../SchedulingParametersEditor/SchedulingParametersEditor.utils';
import { isCandidateInactive } from '../SchedulingConfigWorkspace.utils';
import { AvailabilitySummary } from './AvailabilitySummary';
import { getParameterRows } from './parameterRows';
import { ParameterWarnings } from './ParameterWarnings';
import { SchedulingParameterTable } from './SchedulingParameterTable';

export interface CalendarSummaryProps {
  readonly candidate: ScheduleCandidate;
  /** Every visit type loaded, which the calendar's `serviceType` references are resolved against. */
  readonly services: readonly WithId<HealthcareService>[];
}

/**
 * How a calendar is configured. A calendar's configuration is per visit type — its overrides and hours are
 * held once for each service it offers — so this lists those services, one expanded at a time.
 * @param props - The calendar with its actor, and the visit types to resolve its services against.
 * @returns The summary.
 */
export function CalendarSummary(props: CalendarSummaryProps): JSX.Element {
  const { candidate, services } = props;
  const { schedule } = candidate;
  // A service listed twice is still one visit type offered.
  const references = [
    ...new Map(extractServiceTypeReferences(schedule.serviceType).map((ref) => [ref.reference, ref])).values(),
  ];
  const byReference = new Map(services.map((service) => [`HealthcareService/${service.id}`, service]));

  return (
    <Stack gap="lg">
      <Stack gap={4}>
        <Group gap="sm">
          <Title order={3}>{getCandidateDisplay(candidate)}</Title>
          {isCandidateInactive(candidate) && (
            <Badge variant="light" color="gray">
              Inactive
            </Badge>
          )}
        </Group>
        <Text c="dimmed">{getActorTypeLabel(getActorType(getCandidateActor(candidate)))}</Text>
      </Stack>

      {references.length === 0 ? (
        <Text size="sm" c="dimmed">
          This calendar offers no visit types, so nothing can be booked on it.
        </Text>
      ) : (
        <Stack gap="xs">
          <Title order={5}>Visit types offered</Title>
          <Accordion variant="separated" defaultValue={references[0].reference}>
            {references.map((reference) => (
              <OfferedVisitType
                key={reference.reference}
                reference={reference}
                service={reference.reference ? byReference.get(reference.reference) : undefined}
                candidate={candidate}
              />
            ))}
          </Accordion>
        </Stack>
      )}
    </Stack>
  );
}

interface OfferedVisitTypeProps {
  readonly reference: Reference<HealthcareService>;
  readonly service: WithId<HealthcareService> | undefined;
  readonly candidate: ScheduleCandidate;
}

function OfferedVisitType(props: OfferedVisitTypeProps): JSX.Element {
  const { reference, service, candidate } = props;
  const value = reference.reference ?? '';

  if (!service) {
    return (
      <Accordion.Item value={value}>
        <Accordion.Control>
          <Text size="sm">{reference.display ?? value}</Text>
        </Accordion.Control>
        <Accordion.Panel>
          <Text size="sm" c="dimmed">
            This visit type is not among the ones loaded, so its configuration cannot be shown.
          </Text>
        </Accordion.Panel>
      </Accordion.Item>
    );
  }

  const { schedule } = candidate;
  const overrides = getScheduleSchedulingParameterValues(schedule, service);
  const overrideCount = Object.values(overrides).filter((override) => override !== undefined).length;
  const customHours = getScheduleSchedulingParameters(schedule, service, 'availability').length > 0;
  const duration = getEffectiveSchedulingParameterValues(service, schedule).duration;

  return (
    <Accordion.Item value={value}>
      <Accordion.Control>
        <Group gap="sm" wrap="nowrap">
          <Text size="sm" fw={600}>
            {getDisplayString(service)}
          </Text>
          <Text size="sm" c="dimmed">
            {duration === undefined ? 'No duration' : `${duration} min`}
          </Text>
          <Badge size="sm" variant="light" color={customHours ? 'blue' : 'gray'}>
            {customHours ? 'Custom hours' : 'Service default'}
          </Badge>
          {overrideCount > 0 && (
            <Badge size="sm" variant="light" color="blue">
              {overrideCount === 1 ? '1 override' : `${overrideCount} overrides`}
            </Badge>
          )}
        </Group>
      </Accordion.Control>
      <Accordion.Panel>
        <Stack gap="md">
          <ParameterWarnings
            warnings={getSchedulingParameterWarnings(
              overrides,
              overrides,
              getHealthcareServiceSchedulingParameterValues(service)
            )}
          />
          <SchedulingParameterTable rows={getParameterRows(service, schedule, candidate.actorResource)} />
          <Stack gap="xs">
            <Title order={6}>Hours</Title>
            <AvailabilitySummary service={service} schedule={schedule} />
          </Stack>
        </Stack>
      </Accordion.Panel>
    </Accordion.Item>
  );
}
