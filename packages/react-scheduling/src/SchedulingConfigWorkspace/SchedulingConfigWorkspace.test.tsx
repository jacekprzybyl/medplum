// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import type { Resource } from '@medplum/fhirtypes';
import { MockClient } from '@medplum/mock';
import { describe, expect, test, vi } from 'vitest';
import { ConfigFixtures } from '../stories/scheduling';
import { renderWithMedplum, screen, userEvent, waitFor, within } from '../test-utils/render';
import { SchedulingConfigWorkspace } from './SchedulingConfigWorkspace';

async function setup(resources: readonly Resource[] = ConfigFixtures): Promise<MockClient> {
  const medplum = new MockClient();
  for (const resource of resources) {
    await medplum.createResource(resource);
  }
  renderWithMedplum(<SchedulingConfigWorkspace />, medplum);
  await waitFor(() => expect(within(sidebar()).getByText('Dr. Maya Rivera')).toBeInTheDocument());
  await waitFor(() => expect(within(sidebar()).getByText('Ultrasound Imaging')).toBeInTheDocument());
  return medplum;
}

function sidebar(): HTMLElement {
  return screen.getByRole('navigation', { name: 'Visit types and calendars' });
}

function row(label: string): HTMLElement {
  return within(sidebar()).getByText(label).closest('button') as HTMLElement;
}

function details(): HTMLElement {
  return screen.getByRole('region', { name: 'Configuration details' });
}

describe('SchedulingConfigWorkspace', () => {
  test('lists what booking hides: unconfigured and deactivated visit types, and calendars out of use', async () => {
    await setup();

    expect(row('Unconfigured Visit')).toHaveTextContent('Not configured');
    expect(row('Discontinued Consult')).toHaveTextContent('Inactive');
    expect(row('Dr. Hana Lee')).toHaveTextContent('Inactive');
    expect(row('Ultrasound 3 (Retired)')).toHaveTextContent('Inactive');
    expect(screen.getByTestId('skipped-calendars')).toHaveTextContent(
      '1 calendar is not shown because scheduling cannot book it:'
    );
  });

  test('nothing is selected until something is picked', async () => {
    await setup();

    expect(within(details()).getByText(/Select a visit type or calendar/)).toBeInTheDocument();
    expect(screen.queryAllByRole('button').filter((button) => button.hasAttribute('aria-current'))).toHaveLength(0);
  });

  test('selecting a visit type shows its configuration and the calendars offering it', async () => {
    await setup();

    await userEvent.click(row('Telehealth Consult'));

    expect(row('Telehealth Consult')).toHaveAttribute('aria-current', 'true');
    expect(within(details()).getByRole('heading', { name: 'Telehealth Consult' })).toBeInTheDocument();
    expect(within(details()).getByTestId('parameter-duration')).toHaveTextContent('20 min');
    expect(within(details()).getByText('Dr. Linh Nguyen')).toBeInTheDocument();
  });

  test('a visit type marks the calendars offering it that are out of use', async () => {
    await setup();

    await userEvent.click(row('Ultrasound Imaging'));

    const offered = within(details()).getByText('Dr. Hana Lee').closest('li') as HTMLElement;
    expect(offered).toHaveTextContent('Inactive');
    expect(within(details()).getByText('Dr. Maya Rivera').closest('li')).not.toHaveTextContent('Inactive');
  });

  test('a visit type no calendar offers says nobody can book it', async () => {
    await setup();

    await userEvent.click(row('Unconfigured Visit'));

    expect(within(details()).getByText(/No calendar offers this visit type/)).toBeInTheDocument();
    expect(within(details()).getByTestId('warning-no-duration')).toBeInTheDocument();
  });

  test('selecting a calendar replaces the visit type, which is no longer current', async () => {
    await setup();
    await userEvent.click(row('Telehealth Consult'));

    await userEvent.click(row('Dr. Linh Nguyen'));

    expect(row('Dr. Linh Nguyen')).toHaveAttribute('aria-current', 'true');
    expect(row('Telehealth Consult')).not.toHaveAttribute('aria-current');
    expect(within(details()).getByRole('heading', { name: 'Dr. Linh Nguyen' })).toBeInTheDocument();
    expect(within(details()).queryByRole('heading', { name: 'Telehealth Consult' })).not.toBeInTheDocument();
  });

  test("a calendar lists each visit type it offers, with that visit type's configuration on this calendar", async () => {
    await setup();
    await userEvent.click(row('Dr. Linh Nguyen'));

    const ultrasound = within(details()).getByRole('button', { name: /Ultrasound Imaging/ });
    const telehealth = within(details()).getByRole('button', { name: /Telehealth Consult/ });
    expect(ultrasound).toHaveAttribute('aria-expanded', 'true');
    expect(telehealth).toHaveAttribute('aria-expanded', 'false');
    expect(telehealth).toHaveTextContent('1 override');

    await userEvent.click(telehealth);

    expect(telehealth).toHaveAttribute('aria-expanded', 'true');
    expect(ultrasound).toHaveAttribute('aria-expanded', 'false');
    const overridden = within(details())
      .getAllByTestId('parameter-bufferAfter')
      .find((parameter) => parameter.getAttribute('data-source') === 'calendar');
    expect(overridden).toHaveTextContent('10 min');
  });

  test('a calendar that offers nothing says so', async () => {
    await setup();

    await userEvent.click(row('Exam Room C'));

    expect(within(details()).getByText(/This calendar offers no visit types/)).toBeInTheDocument();
  });

  test('the filter narrows the rows but keeps the selection', async () => {
    await setup();
    await userEvent.click(row('Dr. Linh Nguyen'));

    await userEvent.type(screen.getByLabelText('Filter visit types and calendars'), 'exam room');

    expect(within(sidebar()).getByText('Exam Room A')).toBeInTheDocument();
    expect(within(sidebar()).queryByText('Telehealth Consult')).not.toBeInTheDocument();
    expect(within(sidebar()).queryByText('Dr. Linh Nguyen')).not.toBeInTheDocument();
    expect(within(details()).getByRole('heading', { name: 'Dr. Linh Nguyen' })).toBeInTheDocument();
  });

  test('one list failing to load leaves the other', async () => {
    const medplum = new MockClient();
    for (const resource of ConfigFixtures) {
      await medplum.createResource(resource);
    }
    const search = medplum.search.bind(medplum);
    vi.spyOn(medplum, 'search').mockImplementation((resourceType, query, options) =>
      resourceType === 'HealthcareService'
        ? (Promise.reject(new Error('Visit types unavailable')) as never)
        : search(resourceType, query, options)
    );

    renderWithMedplum(<SchedulingConfigWorkspace />, medplum);

    expect(await screen.findByText(/Visit types could not be loaded: Visit types unavailable/)).toBeInTheDocument();
    await waitFor(() => expect(within(sidebar()).getByText('Dr. Maya Rivera')).toBeInTheDocument());
    expect(screen.queryByText(/Calendars could not be loaded/)).not.toBeInTheDocument();
  });
});
