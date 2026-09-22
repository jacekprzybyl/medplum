// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import { Divider, Stack, Text, TextInput } from '@mantine/core';
import { IconCalendarEvent, IconMapPinFilled, IconSearch } from '@tabler/icons-react';
import type { JSX, ReactNode } from 'react';
import type { BookableActorType } from '../../actors';
// Shared with the booking workspace's sidebar rather than moved, while that sidebar has changes in flight.
import { SectionHeader } from '../../SchedulingWorkspace/CalendarsPanel/SectionHeader';
import type { ConfigSelection } from '../SchedulingConfigWorkspace.utils';
import { ConfigRow } from './ConfigRow';

/** A sidebar section: the visit types, or the calendars of one actor type. */
export type ConfigSectionKey = 'service' | BookableActorType;

export interface ConfigPanelItem {
  readonly id: string;
  readonly label: string;
  /** Required, unlike `CalendarsPanelItem.selected`, which defaults to true: here nothing starts selected. */
  readonly selected: boolean;
  /** The resource is deactivated, or its actor is. */
  readonly inactive?: boolean;
  /** No duration in effect, so nothing can be booked against it. */
  readonly unconfigured?: boolean;
  readonly imageUrl?: string;
}

export interface ConfigPanelProps {
  readonly items: Readonly<Record<ConfigSectionKey, readonly ConfigPanelItem[]>>;
  readonly onSelect: (selection: ConfigSelection) => void;
  readonly servicesLoading?: boolean;
  readonly calendarsLoading?: boolean;
  /** The visit type read stopped at its limit, so the list is not everything the project holds. */
  readonly servicesIncomplete?: boolean;
  /** The calendar read stopped at its limit. */
  readonly calendarsIncomplete?: boolean;
  /** How many calendars were read but cannot be listed, because scheduling cannot book them. */
  readonly skippedCalendars?: number;
  /** The text narrowing the rows. The host applies it; the panel only renders the field. */
  readonly filter: string;
  readonly onFilterChange: (filter: string) => void;
  readonly className?: string;
}

interface ConfigPanelSection {
  readonly key: ConfigSectionKey;
  readonly kind: ConfigSelection['kind'];
  readonly title: string;
  readonly emptyLabel: string;
  readonly icon?: ReactNode;
}

const SECTIONS: readonly ConfigPanelSection[] = [
  {
    key: 'service',
    kind: 'service',
    title: 'Visit types',
    emptyLabel: 'visit types',
    icon: <IconCalendarEvent size={12} />,
  },
  { key: 'Practitioner', kind: 'schedule', title: 'Providers & Staff', emptyLabel: 'providers or staff' },
  { key: 'Device', kind: 'schedule', title: 'Devices', emptyLabel: 'devices' },
  { key: 'Location', kind: 'schedule', title: 'Rooms', emptyLabel: 'rooms', icon: <IconMapPinFilled size={12} /> },
];

/**
 * The configuration sidebar: every visit type, then every calendar grouped by what it belongs to, with one
 * selected at a time.
 *
 * Presentational, like `CalendarsPanel`: it renders what it is given and searches nothing, which is why the
 * filter is controlled and applied by the host.
 * @param props - The rows of each section, the selection handler, and the filter.
 * @returns The sidebar.
 */
export function ConfigPanel(props: ConfigPanelProps): JSX.Element {
  const { items, onSelect, filter, onFilterChange, skippedCalendars, className } = props;

  return (
    <Stack gap="xs" className={className}>
      <TextInput
        aria-label="Filter visit types and calendars"
        placeholder="Filter"
        leftSection={<IconSearch size={16} />}
        value={filter}
        onChange={(event) => onFilterChange(event.currentTarget.value)}
      />
      <Divider />

      {SECTIONS.map((section) => {
        const sectionItems = items[section.key];
        const loading = section.kind === 'service' ? props.servicesLoading : props.calendarsLoading;
        return (
          <Stack key={section.key} gap="xs">
            <SectionHeader title={section.title} loading={loading}>
              {sectionItems.length === 0 ? (
                !loading && (
                  <Text c="dimmed" size="sm" pl="xs">
                    {filter.trim() ? `No matching ${section.emptyLabel}` : `No ${section.emptyLabel} found`}
                  </Text>
                )
              ) : (
                <Stack gap={2}>
                  {sectionItems.map((item) => (
                    <ConfigRow
                      key={item.id}
                      item={item}
                      icon={section.icon}
                      onSelect={(id) => onSelect({ kind: section.kind, id })}
                    />
                  ))}
                </Stack>
              )}
              {section.kind === 'service' && props.servicesIncomplete && (
                <Text c="dimmed" size="xs" pl="xs" mt="xs">
                  Not every visit type is listed: there were more than could be loaded.
                </Text>
              )}
            </SectionHeader>
            <Divider />
          </Stack>
        );
      })}

      {props.calendarsIncomplete && (
        <Text c="dimmed" size="xs">
          Not every calendar is listed: there were more than could be loaded.
        </Text>
      )}
      {!!skippedCalendars && (
        <Text c="dimmed" size="xs" data-testid="skipped-calendars">
          {skippedCalendars === 1
            ? '1 calendar is not shown because scheduling cannot book it: it has more than one owner, or an owner ' +
              'that is not a provider, room or device.'
            : `${skippedCalendars} calendars are not shown because scheduling cannot book them: each has more than ` +
              'one owner, or an owner that is not a provider, room or device.'}
        </Text>
      )}
    </Stack>
  );
}
