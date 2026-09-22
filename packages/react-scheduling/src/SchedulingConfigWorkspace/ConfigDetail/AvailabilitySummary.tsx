// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import { Group, Stack, Text } from '@mantine/core';
import type { WithId } from '@medplum/core';
import { normalizeErrorString } from '@medplum/core';
import type { HealthcareService, Schedule } from '@medplum/fhirtypes';
import type { JSX } from 'react';
import { getEffectiveAvailability } from '../../availability';
import type { WeeklyAvailability } from '../../ScheduleAvailabilityEditor/ScheduleAvailabilityEditor.utils';
import {
  DAY_DISPLAY_ORDER,
  DAY_LABELS,
  formatMinutesOfDay,
  hasAnyAvailableDay,
  toWeeklyAvailability,
} from '../../ScheduleAvailabilityEditor/ScheduleAvailabilityEditor.utils';

export interface AvailabilitySummaryProps {
  readonly service: WithId<HealthcareService>;
  /** The calendar, when showing its hours for the visit type rather than the visit type's default. */
  readonly schedule?: Schedule;
}

type ReadHours = { readonly weekly: WeeklyAvailability | undefined } | { readonly error: string };

function readHours(service: WithId<HealthcareService>, schedule: Schedule | undefined): ReadHours {
  try {
    const availableTime = getEffectiveAvailability(service, schedule);
    return { weekly: availableTime && toWeeklyAvailability(availableTime) };
  } catch (err) {
    // A calendar can hold hours written through the API that cannot be read unambiguously.
    return { error: normalizeErrorString(err) };
  }
}

/**
 * The weekly hours in effect for a visit type, on its own or on one calendar.
 * @param props - The visit type, and optionally the calendar.
 * @returns The hours, one line per day.
 */
export function AvailabilitySummary(props: AvailabilitySummaryProps): JSX.Element {
  const hours = readHours(props.service, props.schedule);

  if ('error' in hours) {
    return (
      <Text size="sm" c="red">
        These hours cannot be read: {hours.error}
      </Text>
    );
  }

  const { weekly } = hours;
  if (!weekly) {
    return (
      <Text size="sm" c="dimmed">
        No hours are set, so scheduling treats every hour as open.
      </Text>
    );
  }

  if (!hasAnyAvailableDay(weekly)) {
    return (
      <Text size="sm" c="dimmed">
        No hours on any day, so nothing can be booked.
      </Text>
    );
  }

  return (
    <Stack gap={2}>
      {DAY_DISPLAY_ORDER.map((day) => {
        const { available, ranges } = weekly[day];
        const open = available && ranges.length > 0;
        return (
          <Group key={day} gap="md" wrap="nowrap">
            <Text size="sm" w={96}>
              {DAY_LABELS[day]}
            </Text>
            <Text size="sm" c={open ? undefined : 'dimmed'}>
              {open
                ? ranges
                    .map((range) => `${formatMinutesOfDay(range.start)} – ${formatMinutesOfDay(range.end)}`)
                    .join(', ')
                : 'Closed'}
            </Text>
          </Group>
        );
      })}
    </Stack>
  );
}
