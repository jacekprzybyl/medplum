// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import type { Meta } from '@storybook/react';
import type { JSX } from 'react';
import { useState } from 'react';
import type { ConfigSelection } from '../SchedulingConfigWorkspace.utils';
import { matchesFilter } from '../SchedulingConfigWorkspace.utils';
import type { ConfigPanelItem, ConfigSectionKey } from './ConfigPanel';
import { ConfigPanel } from './ConfigPanel';

export default {
  title: 'Medplum/SchedulingConfigWorkspace/ConfigPanel',
  component: ConfigPanel,
} as Meta;

type PanelItems = Record<ConfigSectionKey, Omit<ConfigPanelItem, 'selected'>[]>;

const items: PanelItems = {
  service: [
    { id: 'svc-1', label: 'Annual exam' },
    { id: 'svc-2', label: 'Blood draw', unconfigured: true },
    { id: 'svc-3', label: 'Consult', inactive: true },
  ],
  Practitioner: [
    { id: 'prov-1', label: 'Lisa Caddy' },
    { id: 'prov-2', label: 'Michelle Bryant', inactive: true },
  ],
  Device: [{ id: 'dev-1', label: 'Ultrasound Machine 1' }],
  Location: [
    { id: 'room-1', label: 'Exam Room A' },
    { id: 'room-2', label: 'Exam Room B' },
  ],
};

function Panel(props: { readonly skippedCalendars?: number }): JSX.Element {
  const [selection, setSelection] = useState<ConfigSelection>();
  const [filter, setFilter] = useState('');

  const shown = Object.fromEntries(
    Object.entries(items).map(([key, rows]) => [
      key,
      rows
        .filter((row) => matchesFilter(row.label, filter))
        .map((row) => ({
          ...row,
          selected: selection?.id === row.id && (selection.kind === 'service') === (key === 'service'),
        })),
    ])
  ) as Record<ConfigSectionKey, ConfigPanelItem[]>;

  return (
    <div style={{ width: 300 }}>
      <ConfigPanel
        items={shown}
        onSelect={setSelection}
        filter={filter}
        onFilterChange={setFilter}
        skippedCalendars={props.skippedCalendars}
      />
    </div>
  );
}

/**
 * Pick any row: one is current at a time, across every section. Type in the filter to narrow them all.
 *
 * @returns The story.
 */
export const Basic = (): JSX.Element => <Panel />;

/**
 * With calendars the panel cannot list, counted under the sections.
 *
 * @returns The story.
 */
export const WithSkippedCalendars = (): JSX.Element => <Panel skippedCalendars={2} />;

/**
 * While both lists load.
 *
 * @returns The story.
 */
export const Loading = (): JSX.Element => (
  <div style={{ width: 300 }}>
    <ConfigPanel
      items={{ service: [], Practitioner: [], Device: [], Location: [] }}
      onSelect={() => undefined}
      filter=""
      onFilterChange={() => undefined}
      servicesLoading
      calendarsLoading
    />
  </div>
);
