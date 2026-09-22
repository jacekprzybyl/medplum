// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import type { WithId } from '@medplum/core';
import { getDisplayString } from '@medplum/core';
import type { HealthcareService } from '@medplum/fhirtypes';
import type { BookableActorType } from '../actors';
import { BOOKABLE_ACTOR_TYPES, getActorType, isBookableActorType } from '../actors';
import type { ScheduleCandidate } from '../AppointmentFinder/AppointmentFinder.schedules';
import { getCandidateActor, getCandidateDisplay } from '../AppointmentFinder/AppointmentFinder.schedules';
import { getEffectiveSchedulingParameterValues } from '../parameterValues';
import type { ConfigPanelItem, ConfigSectionKey } from './ConfigPanel/ConfigPanel';

/**
 * What is being configured: one visit type, or one calendar. The kind names the resource rather than the
 * panel section it was clicked in, so rearranging the sidebar never changes it.
 *
 * Keyed by id so it survives the resource being replaced in the list, by a refetch or a save. A draft being
 * created has no id and is not in the list, so it lives in state of its own until it is saved.
 */
export type ConfigSelection =
  { readonly kind: 'service'; readonly id: string } | { readonly kind: 'schedule'; readonly id: string };

/**
 * Sorts calendars into the sidebar's actor sections.
 * @param candidates - Calendars, each with the single bookable actor it belongs to.
 * @returns The calendars of each actor type, in the order given.
 */
export function groupCandidatesByActorType(
  candidates: readonly ScheduleCandidate[]
): Record<BookableActorType, ScheduleCandidate[]> {
  const groups: Record<BookableActorType, ScheduleCandidate[]> = { Practitioner: [], Location: [], Device: [] };
  for (const candidate of candidates) {
    const actorType = getActorType(getCandidateActor(candidate));
    if (isBookableActorType(actorType)) {
      groups[actorType].push(candidate);
    }
  }
  return groups;
}

/**
 * Whether a calendar is out of use: turned off itself, or held on an actor that is.
 * @param candidate - The calendar and its actor.
 * @returns True when either is deactivated.
 */
export function isCandidateInactive(candidate: ScheduleCandidate): boolean {
  if (candidate.schedule.active === false) {
    return true;
  }
  const actor = candidate.actorResource;
  switch (actor?.resourceType) {
    case 'Practitioner':
      return actor.active === false;
    case 'Location':
    case 'Device':
      return actor.status === 'inactive';
    default:
      return false;
  }
}

/**
 * Whether a visit type has no duration in effect. Scheduling then books it only on calendars that set their
 * own, which is rarely what anyone intended.
 * @param service - The visit type.
 * @returns True when nothing gives it a duration.
 */
export function isServiceUnconfigured(service: WithId<HealthcareService>): boolean {
  return getEffectiveSchedulingParameterValues(service).duration === undefined;
}

/**
 * Whether a row's label matches what was typed into the panel's filter, ignoring case.
 * @param label - The row's label.
 * @param filter - What was typed. Blank matches everything.
 * @returns True when the row should stay.
 */
export function matchesFilter(label: string, filter: string): boolean {
  const needle = filter.trim().toLowerCase();
  return !needle || label.toLowerCase().includes(needle);
}

/**
 * Builds the rows of every panel section, narrowed by the filter.
 * @param services - Every visit type loaded.
 * @param candidates - Every calendar loaded.
 * @param selection - What is selected, if anything.
 * @param filter - What was typed into the panel's filter.
 * @returns The rows for each section.
 */
export function buildPanelItems(
  services: readonly WithId<HealthcareService>[],
  candidates: readonly ScheduleCandidate[],
  selection: ConfigSelection | undefined,
  filter: string
): Record<ConfigSectionKey, ConfigPanelItem[]> {
  const serviceItems = services
    .map((service): ConfigPanelItem => ({
      id: service.id,
      label: getDisplayString(service),
      selected: selection?.kind === 'service' && selection.id === service.id,
      inactive: service.active === false,
      unconfigured: isServiceUnconfigured(service),
    }))
    .filter((item) => matchesFilter(item.label, filter));

  const groups = groupCandidatesByActorType(candidates);
  const items = { service: serviceItems } as Record<ConfigSectionKey, ConfigPanelItem[]>;
  for (const actorType of BOOKABLE_ACTOR_TYPES) {
    items[actorType] = groups[actorType]
      .map((candidate): ConfigPanelItem => ({
        id: candidate.schedule.id,
        label: getCandidateDisplay(candidate),
        selected: selection?.kind === 'schedule' && selection.id === candidate.schedule.id,
        inactive: isCandidateInactive(candidate),
      }))
      .filter((item) => matchesFilter(item.label, filter));
  }
  return items;
}
