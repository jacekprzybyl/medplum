// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import type { WithId } from '@medplum/core';
import { getSchedulingTimezone } from '@medplum/core';
import type { HealthcareService, Schedule } from '@medplum/fhirtypes';
import type { SchedulingActorResource } from '../../actors';
import { getActorTypeLabel } from '../../actors';
import type { SchedulingParameterValues } from '../../parameterValues';
import {
  FLAT_PARAMETERS,
  getEffectiveSchedulingParameterValues,
  getHealthcareServiceSchedulingParameterValues,
  getScheduleSchedulingParameterValues,
  SCHEDULING_PARAMETER_LABELS,
} from '../../parameterValues';

/** Where the value in effect comes from. */
export type ParameterSource = 'calendar' | 'visit type' | 'actor' | 'default' | 'not set';

export interface ParameterRow {
  readonly parameter: keyof SchedulingParameterValues;
  readonly label: string;
  /** The value in effect, formatted: minutes as `30 min`, a count as `1`, a time zone as itself. */
  readonly display: string;
  readonly source: ParameterSource;
  /** Names the source for a reader, for example `This calendar`, or `Provider` for an actor's time zone. */
  readonly sourceLabel: string;
}

/**
 * Lists every scheduling parameter with the value in effect and where it comes from, for a visit type on its
 * own or on one calendar.
 * @param service - The visit type.
 * @param schedule - The calendar, when reading its override of the visit type.
 * @param actor - The calendar's actor, whose time zone applies when neither level sets one.
 * @returns One row per parameter, in the editor's order.
 */
export function getParameterRows(
  service: WithId<HealthcareService>,
  schedule?: Schedule,
  actor?: SchedulingActorResource
): ParameterRow[] {
  const serviceValues = getHealthcareServiceSchedulingParameterValues(service);
  const scheduleValues = schedule ? getScheduleSchedulingParameterValues(schedule, service) : {};
  const effective = getEffectiveSchedulingParameterValues(service, schedule);

  return FLAT_PARAMETERS.map((parameter): ParameterRow => {
    const value = effective[parameter];
    const row = (source: ParameterSource, sourceLabel: string, display = format(parameter, value)): ParameterRow => ({
      parameter,
      label: SCHEDULING_PARAMETER_LABELS[parameter],
      display,
      source,
      sourceLabel,
    });

    if (scheduleValues[parameter] !== undefined) {
      return row('calendar', 'This calendar');
    }
    if (serviceValues[parameter] !== undefined) {
      return row('visit type', 'Visit type');
    }
    if (value !== undefined) {
      return row('default', 'Default');
    }
    if (parameter === 'timezone' && actor) {
      const actorTimezone = getSchedulingTimezone(service, schedule, actor);
      if (actorTimezone) {
        return row('actor', getActorTypeLabel(actor.resourceType), actorTimezone);
      }
    }
    return row('not set', '');
  });
}

function format(parameter: keyof SchedulingParameterValues, value: number | string | undefined): string {
  if (value === undefined) {
    return 'Not set';
  }
  if (typeof value === 'string' || parameter === 'slotCapacity') {
    return value.toString();
  }
  return `${value} min`;
}
