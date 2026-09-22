// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import { Table, Text } from '@mantine/core';
import type { JSX } from 'react';
import type { ParameterRow } from './parameterRows';

export interface SchedulingParameterTableProps {
  readonly rows: readonly ParameterRow[];
}

/**
 * The scheduling parameters in effect, each with where its value comes from.
 * @param props - The rows to show.
 * @returns The table.
 */
export function SchedulingParameterTable(props: SchedulingParameterTableProps): JSX.Element {
  return (
    <Table withRowBorders={false} verticalSpacing={4}>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Parameter</Table.Th>
          <Table.Th>In effect</Table.Th>
          <Table.Th>Set on</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {props.rows.map((row) => (
          <Table.Tr key={row.parameter} data-testid={`parameter-${row.parameter}`} data-source={row.source}>
            <Table.Td>{row.label}</Table.Td>
            <Table.Td>
              <Text
                size="sm"
                c={row.source === 'not set' ? 'dimmed' : undefined}
                fw={row.source === 'calendar' ? 600 : undefined}
              >
                {row.display}
              </Text>
            </Table.Td>
            <Table.Td>
              <Text size="sm" c="dimmed">
                {row.sourceLabel}
              </Text>
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}
