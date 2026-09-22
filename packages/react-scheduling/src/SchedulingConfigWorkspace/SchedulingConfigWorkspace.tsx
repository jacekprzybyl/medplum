// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import { Alert, Stack, Text } from '@mantine/core';
import type { WithId } from '@medplum/core';
import { normalizeErrorString } from '@medplum/core';
import type { HealthcareService } from '@medplum/fhirtypes';
import { useMedplum } from '@medplum/react-hooks';
import cx from 'clsx';
import type { JSX } from 'react';
import { useEffect, useState } from 'react';
import type { ScheduleCandidate } from '../AppointmentFinder/AppointmentFinder.schedules';
import { searchConfigurableCalendars, searchConfigurableServices } from '../configSearch';
import { CalendarSummary } from './ConfigDetail/CalendarSummary';
import { VisitTypeSummary } from './ConfigDetail/VisitTypeSummary';
import { ConfigPanel } from './ConfigPanel/ConfigPanel';
import classes from './SchedulingConfigWorkspace.module.css';
import type { ConfigSelection } from './SchedulingConfigWorkspace.utils';
import { buildPanelItems } from './SchedulingConfigWorkspace.utils';

export interface SchedulingConfigWorkspaceProps {
  readonly className?: string;
}

interface Loaded<T> {
  readonly items: readonly T[];
  readonly complete: boolean;
}

const NOTHING_LOADED = { items: [], complete: true } as const;

/**
 * Where scheduling is configured: every visit type and every calendar, listed so one can be picked and its
 * configuration shown. The configuration counterpart to `SchedulingWorkspace`, which books.
 *
 * It fetches its own resources, and lists what booking hides: visit types that are deactivated or have no
 * scheduling parameters, and calendars that are deactivated or belong to a deactivated provider, room or
 * device.
 * @param props - Component props.
 * @returns The workspace.
 */
export function SchedulingConfigWorkspace(props: SchedulingConfigWorkspaceProps): JSX.Element {
  const medplum = useMedplum();

  // Held as state rather than derived from a search, so a saved resource can be swapped in where it sits.
  const [services, setServices] = useState<Loaded<WithId<HealthcareService>>>(NOTHING_LOADED);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [servicesError, setServicesError] = useState<unknown>();

  const [candidates, setCandidates] = useState<Loaded<ScheduleCandidate>>(NOTHING_LOADED);
  const [skippedCalendars, setSkippedCalendars] = useState(0);
  const [calendarsLoading, setCalendarsLoading] = useState(true);
  const [calendarsError, setCalendarsError] = useState<unknown>();

  const [selection, setSelection] = useState<ConfigSelection>();
  const [filter, setFilter] = useState('');

  // The two lists load independently, so visit types can render while calendars are still arriving, and one
  // failing does not blank the other.
  useEffect(() => {
    const controller = new AbortController();
    searchConfigurableServices(medplum, { signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) {
          setServices({ items: result.services, complete: result.complete });
          setServicesError(undefined);
        }
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) {
          setServicesError(err);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setServicesLoading(false);
        }
      });
    return () => controller.abort();
  }, [medplum]);

  useEffect(() => {
    const controller = new AbortController();
    searchConfigurableCalendars(medplum, { signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) {
          setCandidates({ items: result.candidates, complete: result.complete });
          setSkippedCalendars(result.skipped);
          setCalendarsError(undefined);
        }
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) {
          setCalendarsError(err);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setCalendarsLoading(false);
        }
      });
    return () => controller.abort();
  }, [medplum]);

  // Looked up each render rather than cleared when it goes missing, so a refetch in flight does not flicker it.
  const selectedService =
    selection?.kind === 'service' ? services.items.find((service) => service.id === selection.id) : undefined;
  const selectedCandidate =
    selection?.kind === 'schedule'
      ? candidates.items.find((candidate) => candidate.schedule.id === selection.id)
      : undefined;

  let detail: JSX.Element;
  if (selectedService) {
    detail = <VisitTypeSummary key={selectedService.id} service={selectedService} candidates={candidates.items} />;
  } else if (selectedCandidate) {
    detail = (
      <CalendarSummary key={selectedCandidate.schedule.id} candidate={selectedCandidate} services={services.items} />
    );
  } else if (selection) {
    detail = <Text c="dimmed">This is no longer in the list. It may have been deleted.</Text>;
  } else {
    detail = <Text c="dimmed">Select a visit type or calendar to see how it is configured.</Text>;
  }

  return (
    <div className={cx(classes.root, props.className)}>
      <nav className={classes.sidebar} aria-label="Visit types and calendars">
        <ConfigPanel
          items={buildPanelItems(services.items, candidates.items, selection, filter)}
          onSelect={setSelection}
          servicesLoading={servicesLoading}
          calendarsLoading={calendarsLoading}
          servicesIncomplete={!services.complete}
          calendarsIncomplete={!candidates.complete}
          skippedCalendars={skippedCalendars}
          filter={filter}
          onFilterChange={setFilter}
        />
      </nav>

      <section className={classes.detail} aria-label="Configuration details">
        <Stack gap="md">
          {!!servicesError && (
            <Alert color="red">Visit types could not be loaded: {normalizeErrorString(servicesError)}</Alert>
          )}
          {!!calendarsError && (
            <Alert color="red">Calendars could not be loaded: {normalizeErrorString(calendarsError)}</Alert>
          )}
          {detail}
        </Stack>
      </section>
    </div>
  );
}
