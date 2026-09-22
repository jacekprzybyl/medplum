// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import { describe, expect, test, vi } from 'vitest';
import { render, screen, userEvent } from '../../test-utils/render';
import type { ConfigPanelProps } from './ConfigPanel';
import { ConfigPanel } from './ConfigPanel';

function setup(overrides?: Partial<ConfigPanelProps>): ConfigPanelProps {
  const props: ConfigPanelProps = {
    items: {
      service: [
        { id: 'svc-1', label: 'Annual exam', selected: false },
        { id: 'svc-2', label: 'Blood draw', selected: false, unconfigured: true },
        { id: 'svc-3', label: 'Consult', selected: false, inactive: true },
      ],
      Practitioner: [{ id: 'sched-prov', label: 'Dr. Ada Adams', selected: true }],
      Device: [{ id: 'sched-dev', label: 'Ultrasound 1', selected: false }],
      Location: [{ id: 'sched-room', label: 'Exam Room A', selected: false }],
    },
    onSelect: vi.fn(),
    filter: '',
    onFilterChange: vi.fn(),
    ...overrides,
  };
  render(<ConfigPanel {...props} />);
  return props;
}

function row(label: string): HTMLElement {
  return screen.getByText(label).closest('button') as HTMLElement;
}

describe('ConfigPanel', () => {
  test('lists visit types above the three calendar sections', () => {
    setup();

    expect(screen.getByText('Visit types')).toBeInTheDocument();
    expect(screen.getByText('Providers & Staff')).toBeInTheDocument();
    expect(screen.getByText('Devices')).toBeInTheDocument();
    expect(screen.getByText('Rooms')).toBeInTheDocument();
  });

  test('selecting a visit type reports a service selection', async () => {
    const { onSelect } = setup();

    await userEvent.click(row('Annual exam'));

    expect(onSelect).toHaveBeenCalledWith({ kind: 'service', id: 'svc-1' });
  });

  test('selecting a calendar in any section reports a schedule selection', async () => {
    const { onSelect } = setup();

    await userEvent.click(row('Exam Room A'));
    await userEvent.click(row('Ultrasound 1'));

    expect(onSelect).toHaveBeenNthCalledWith(1, { kind: 'schedule', id: 'sched-room' });
    expect(onSelect).toHaveBeenNthCalledWith(2, { kind: 'schedule', id: 'sched-dev' });
  });

  test('marks only the selected row current, and none as pressed', () => {
    setup();

    expect(row('Dr. Ada Adams')).toHaveAttribute('aria-current', 'true');
    for (const label of ['Annual exam', 'Blood draw', 'Consult', 'Ultrasound 1', 'Exam Room A']) {
      expect(row(label)).not.toHaveAttribute('aria-current');
    }
    // These rows pick what the pane shows; they are not the booking sidebar's visibility toggles.
    for (const button of screen.getAllByRole('button')) {
      expect(button).not.toHaveAttribute('aria-pressed');
    }
  });

  test('a row passed as not selected is not current', () => {
    setup({
      items: {
        service: [{ id: 'svc-1', label: 'Annual exam', selected: false }],
        Practitioner: [],
        Device: [],
        Location: [],
      },
    });

    expect(row('Annual exam')).not.toHaveAttribute('aria-current');
  });

  test('badges deactivated and unconfigured rows', () => {
    setup();

    expect(row('Consult')).toHaveTextContent('Inactive');
    expect(row('Blood draw')).toHaveTextContent('Not configured');
    expect(row('Annual exam')).not.toHaveTextContent(/Inactive|Not configured/);
  });

  test('says how many calendars it cannot show', () => {
    setup({ skippedCalendars: 2 });

    expect(screen.getByTestId('skipped-calendars')).toHaveTextContent('2 calendars are not shown');
  });

  test('says it, not them, of one skipped calendar', () => {
    setup({ skippedCalendars: 1 });

    expect(screen.getByTestId('skipped-calendars')).toHaveTextContent(
      '1 calendar is not shown because scheduling cannot book it: it has'
    );
  });

  test('says nothing about skipped calendars when there are none', () => {
    setup({ skippedCalendars: 0 });

    expect(screen.queryByTestId('skipped-calendars')).not.toBeInTheDocument();
  });

  test('says when a list stopped short', () => {
    setup({ servicesIncomplete: true, calendarsIncomplete: true });

    expect(screen.getByText(/Not every visit type is listed/)).toBeInTheDocument();
    expect(screen.getByText(/Not every calendar is listed/)).toBeInTheDocument();
  });

  test('reports what is typed into the filter', async () => {
    const { onFilterChange } = setup();

    await userEvent.type(screen.getByLabelText('Filter visit types and calendars'), 'a');

    expect(onFilterChange).toHaveBeenCalledWith('a');
  });

  test('an empty section says nothing matched while filtering, and nothing was found otherwise', () => {
    const empty = { service: [], Practitioner: [], Device: [], Location: [] };
    const { unmount } = render(<ConfigPanel items={empty} onSelect={vi.fn()} filter="" onFilterChange={vi.fn()} />);
    expect(screen.getByText('No visit types found')).toBeInTheDocument();
    unmount();

    render(<ConfigPanel items={empty} onSelect={vi.fn()} filter="zzz" onFilterChange={vi.fn()} />);
    expect(screen.getByText('No matching visit types')).toBeInTheDocument();
  });

  test('shows loading in place of the empty message, per list', () => {
    setup({
      items: { service: [], Practitioner: [], Device: [], Location: [] },
      servicesLoading: true,
    });

    expect(screen.getByLabelText('Loading visit types')).toBeInTheDocument();
    expect(screen.queryByText('No visit types found')).not.toBeInTheDocument();
    expect(screen.getByText('No rooms found')).toBeInTheDocument();
  });
});
