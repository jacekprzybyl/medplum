// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import { OperationOutcomeError } from '@medplum/core';
import type { Repository } from '../repo';
import {
  inferExplainResourceTypes,
  isUndefinedFunctionError,
  normalizeExplainSql,
  parseHypotheticalIndexStatements,
  withHypotheticalIndexes,
} from './explain';

describe('parseHypotheticalIndexStatements', () => {
  test('Parses multiple CREATE INDEX statements', () => {
    expect(
      parseHypotheticalIndexStatements(
        'CREATE INDEX ON "Appointment" ("projectId", "status"); CREATE UNIQUE INDEX ON "Patient" ("id")'
      )
    ).toStrictEqual([
      'CREATE INDEX ON "Appointment" ("projectId", "status")',
      'CREATE UNIQUE INDEX ON "Patient" ("id")',
    ]);
  });

  test('Ignores empty input', () => {
    expect(parseHypotheticalIndexStatements(undefined)).toStrictEqual([]);
    expect(parseHypotheticalIndexStatements('')).toStrictEqual([]);
    expect(parseHypotheticalIndexStatements(['', '  ;  '])).toStrictEqual([]);
  });

  test('Rejects statements that are not CREATE INDEX', () => {
    expect(() => parseHypotheticalIndexStatements('DROP INDEX "Patient_id_idx"')).toThrow(OperationOutcomeError);
  });

  test('Rejects CONCURRENTLY', () => {
    expect(() => parseHypotheticalIndexStatements('CREATE INDEX CONCURRENTLY ON "Patient" ("active")')).toThrow(
      OperationOutcomeError
    );
  });
});

describe('normalizeExplainSql', () => {
  test('Accepts SELECT and WITH and strips a trailing semicolon', () => {
    expect(normalizeExplainSql('  SELECT 1;  ')).toBe('SELECT 1');
    expect(normalizeExplainSql('WITH x AS (SELECT 1) SELECT * FROM x')).toBe('WITH x AS (SELECT 1) SELECT * FROM x');
  });

  test('Rejects empty, multi-statement, and non-SELECT SQL', () => {
    expect(() => normalizeExplainSql('   ')).toThrow(OperationOutcomeError);
    expect(() => normalizeExplainSql('SELECT 1; SELECT 2')).toThrow(OperationOutcomeError);
    expect(() => normalizeExplainSql('DELETE FROM "Patient"')).toThrow(OperationOutcomeError);
  });
});

describe('inferExplainResourceTypes', () => {
  test('Infers resource types from quoted identifiers', () => {
    expect(inferExplainResourceTypes('SELECT * FROM "Patient" JOIN "Appointment" ON true')).toStrictEqual([
      'Patient',
      'Appointment',
    ]);
    expect(inferExplainResourceTypes('SELECT * FROM "Patient_History"')).toStrictEqual(['Patient']);
  });

  test('Falls back to Project when no resource tables are quoted', () => {
    expect(inferExplainResourceTypes('SELECT 1')).toStrictEqual(['Project']);
  });
});

describe('isUndefinedFunctionError', () => {
  test('Detects missing PostgreSQL functions', () => {
    expect(isUndefinedFunctionError({ code: '42883' })).toBe(true);
    expect(isUndefinedFunctionError({ code: '42P01' })).toBe(false);
    expect(isUndefinedFunctionError('nope')).toBe(false);
    expect(isUndefinedFunctionError(null)).toBe(false);
  });
});

describe('withHypotheticalIndexes', () => {
  test('creates indexes and explains in one transaction, then rolls back and resets', async () => {
    const calls: string[] = [];
    const repo = {
      executeRawSql: vi.fn(async (sql: string) => {
        calls.push(sql);
        if (sql.includes('hypopg_create_index')) {
          return [];
        }
        if (sql.includes('hypopg_list_indexes')) {
          return [
            {
              indexrelid: '13607',
              index_name: '<13607>btree_Patient_active',
              schema_name: 'public',
              table_name: 'Patient',
              am_name: 'btree',
              definition: 'CREATE INDEX ON public."Patient" USING btree ("active")',
            },
          ];
        }
        return [];
      }),
      withTransaction: vi.fn(async (callback: (txRepo: Repository) => Promise<unknown>) => callback(repo)),
    } as unknown as Repository;

    const result = await withHypotheticalIndexes(
      repo,
      ['Patient'],
      ['CREATE INDEX ON "Patient" ("active")'],
      async (txRepo) => {
        calls.push('EXPLAIN');
        expect(txRepo).toBe(repo);
        return { result: ['plan'] };
      }
    );

    expect(result).toStrictEqual({
      result: ['plan'],
      hypotheticalIndexes: [
        {
          indexrelid: '13607',
          indexName: '<13607>btree_Patient_active',
          schemaName: 'public',
          tableName: 'Patient',
          accessMethod: 'btree',
          definition: 'CREATE INDEX ON public."Patient" USING btree ("active")',
        },
      ],
    });
    expect(calls).toStrictEqual([
      'SELECT hypopg_reset()',
      'SELECT hypopg_create_index($1)',
      'EXPLAIN',
      expect.stringContaining('hypopg_list_indexes'),
      'SELECT hypopg_reset()',
    ]);
    expect(repo.withTransaction).toHaveBeenCalledOnce();
  });

  test('rolls back and resets when EXPLAIN fails', async () => {
    const calls: string[] = [];
    const repo = {
      executeRawSql: vi.fn(async (sql: string) => {
        calls.push(sql);
        return [];
      }),
      withTransaction: vi.fn(async (callback: (txRepo: Repository) => Promise<unknown>) => callback(repo)),
    } as unknown as Repository;

    await expect(
      withHypotheticalIndexes(repo, ['Patient'], ['CREATE INDEX ON "Patient" ("active")'], async () => {
        calls.push('EXPLAIN');
        throw new Error('explain failed');
      })
    ).rejects.toThrow('explain failed');

    expect(calls).toStrictEqual([
      'SELECT hypopg_reset()',
      'SELECT hypopg_create_index($1)',
      'EXPLAIN',
      'SELECT hypopg_reset()',
    ]);
  });
});
