// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import type { Meta } from '@storybook/react';
import type { JSX } from 'react';
import { withFixtures } from '../stories/decorators';
import { ConfigFixtures } from '../stories/scheduling';
import { SchedulingConfigWorkspace } from './SchedulingConfigWorkspace';

export default {
  title: 'Medplum/SchedulingConfigWorkspace',
  component: SchedulingConfigWorkspace,
  parameters: {
    // Default seeding brings Dr. Alice Smith and her calendar, which only clutter the lists here.
    skipDefaultSeeding: true,
  },
} as Meta;

function Workspace(): JSX.Element {
  // The workspace fills whatever it is given, so the story hands it the rest of the viewport.
  return (
    <div style={{ height: 'calc(100vh - 72px)', padding: '1em', boxSizing: 'border-box' }}>
      <SchedulingConfigWorkspace />
    </div>
  );
}

/**
 * The clinic as an administrator sees it, including what booking hides.
 *
 * Under **Visit types**, Unconfigured Visit and Walk-in Clinic are marked **Not configured**: nothing gives
 * them a duration, so booking never offers them. Discontinued Consult is **Inactive**. Pick any of them to see
 * why, and which calendars offer it.
 *
 * Under the calendars, Dr. Hana Lee has left the practice but her calendar was never switched off, and
 * Ultrasound 3 is retired; both are **Inactive**. Exam Room C offers no visit types yet. The note at the bottom
 * counts a calendar shared by a provider and a room, which scheduling cannot book.
 *
 * Pick **Dr. Linh Nguyen** for a calendar offering two visit types. Each is listed with its duration and
 * whether the hours are the visit type's or the calendar's own; Telehealth Consult shows **1 override**.
 * Expand it: Buffer after is 10 minutes, set on this calendar, where the visit type leaves it at the default.
 *
 * The filter narrows every section and leaves the selection alone.
 *
 * @returns The story.
 */
export const Basic = (): JSX.Element => <Workspace />;
Basic.decorators = [withFixtures(ConfigFixtures)];
