// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import { Badge, Group, List, Stack, Text, Title } from '@mantine/core';
import type { WithId } from '@medplum/core';
import { formatCodeableConcept, getDisplayString, serviceTypeIncludesService } from '@medplum/core';
import type { HealthcareService } from '@medplum/fhirtypes';
import type { JSX } from 'react';
import type { ScheduleCandidate } from '../../AppointmentFinder/AppointmentFinder.schedules';
import { getCandidateDisplay } from '../../AppointmentFinder/AppointmentFinder.schedules';
import { getHealthcareServiceSchedulingParameterValues } from '../../parameterValues';
import { getSchedulingParameterWarnings } from '../../SchedulingParametersEditor/SchedulingParametersEditor.utils';
import { isCandidateInactive } from '../SchedulingConfigWorkspace.utils';
import { AvailabilitySummary } from './AvailabilitySummary';
import { getParameterRows } from './parameterRows';
import { ParameterWarnings } from './ParameterWarnings';
import { SchedulingParameterTable } from './SchedulingParameterTable';

export interface VisitTypeSummaryProps {
  readonly service: WithId<HealthcareService>;
  /** Every calendar loaded, from which the ones offering this visit type are picked out. */
  readonly candidates: readonly ScheduleCandidate[];
}

/**
 * How a visit type is configured on its own: its parameters, its default hours, and which calendars offer it.
 * @param props - The visit type, and the calendars to look for it on.
 * @returns The summary.
 */
export function VisitTypeSummary(props: VisitTypeSummaryProps): JSX.Element {
  const { service, candidates } = props;
  const values = getHealthcareServiceSchedulingParameterValues(service);
  const offering = candidates.filter((candidate) =>
    serviceTypeIncludesService(candidate.schedule.serviceType, service)
  );
  const categories = (service.type ?? []).map((concept) => formatCodeableConcept(concept)).filter(Boolean);

  return (
    <Stack gap="lg">
      <Stack gap={4}>
        <Group gap="sm">
          <Title order={3}>{getDisplayString(service)}</Title>
          {service.active === false && (
            <Badge variant="light" color="gray">
              Inactive
            </Badge>
          )}
        </Group>
        {categories.length > 0 && <Text c="dimmed">{categories.join(', ')}</Text>}
      </Stack>

      {/* Stored and loaded are the same values, so nothing reads as changed. */}
      <ParameterWarnings warnings={getSchedulingParameterWarnings(values, values)} />

      <Stack gap="xs">
        <Title order={5}>Scheduling parameters</Title>
        <SchedulingParameterTable rows={getParameterRows(service)} />
      </Stack>

      <Stack gap="xs">
        <Title order={5}>Default hours</Title>
        <AvailabilitySummary service={service} />
      </Stack>

      <Stack gap="xs">
        <Title order={5}>Offered on</Title>
        {offering.length === 0 ? (
          <Text size="sm" c="dimmed">
            No calendar offers this visit type, so nobody can book it.
          </Text>
        ) : (
          <List size="sm">
            {offering.map((candidate) => {
              const inactive = isCandidateInactive(candidate);
              return (
                <List.Item key={candidate.schedule.id}>
                  <Group gap="xs">
                    <Text size="sm" c={inactive ? 'dimmed' : undefined}>
                      {getCandidateDisplay(candidate)}
                    </Text>
                    {inactive && (
                      <Badge size="xs" variant="light" color="gray">
                        Inactive
                      </Badge>
                    )}
                  </Group>
                </List.Item>
              );
            })}
          </List>
        )}
      </Stack>
    </Stack>
  );
}
