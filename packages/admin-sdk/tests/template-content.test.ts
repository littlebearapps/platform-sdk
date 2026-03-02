import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = resolve(__dirname, '../templates');

/**
 * Template content validation tests.
 *
 * These tests validate that template SQL/TS content is internally consistent.
 * For example, INSERT columns must match CREATE TABLE columns, and TypeScript
 * references must exist in the schema.
 *
 * This would have caught P0-1 (seed.sql.hbs referencing non-existent columns).
 */

describe('template content validation', () => {
  describe('seed.sql.hbs vs 001_core_tables.sql', () => {
    const coreSql = readFileSync(
      resolve(TEMPLATES_DIR, 'shared/migrations/001_core_tables.sql'),
      'utf-8'
    );
    const seedSql = readFileSync(
      resolve(TEMPLATES_DIR, 'shared/migrations/seed.sql.hbs'),
      'utf-8'
    );

    it('seed INSERT columns all exist in project_registry table', () => {
      // Extract column names from CREATE TABLE project_registry
      const tableMatch = coreSql.match(
        /CREATE TABLE IF NOT EXISTS project_registry \(([\s\S]+?)\);/
      );
      expect(tableMatch).not.toBeNull();

      const tableColumns = tableMatch![1]
        .split('\n')
        .map((l) => l.trim().split(/\s+/)[0])
        .filter(
          (c) =>
            c &&
            !c.startsWith('--') &&
            !c.startsWith('PRIMARY') &&
            !c.startsWith('FOREIGN') &&
            !c.startsWith('UNIQUE') &&
            !c.startsWith(')')
        )
        .map((c) => c.replace(',', ''));

      // Extract columns from INSERT INTO project_registry (col1, col2, ...)
      const insertMatch = seedSql.match(
        /INSERT INTO project_registry \(([^)]+)\)/
      );
      expect(insertMatch).not.toBeNull();

      const insertColumns = insertMatch![1].split(',').map((c) => c.trim());

      for (const col of insertColumns) {
        expect(tableColumns).toContain(col);
      }
    });

    it('seed VALUES count matches column count', () => {
      const insertMatch = seedSql.match(
        /INSERT INTO project_registry \(([^)]+)\)/
      );
      const valuesMatch = seedSql.match(/VALUES \(([^)]+)\)/);
      expect(insertMatch).not.toBeNull();
      expect(valuesMatch).not.toBeNull();

      const colCount = insertMatch![1].split(',').length;
      const valCount = valuesMatch![1].split(',').length;
      expect(colCount).toBe(valCount);
    });
  });

  describe('budget-enforcement.ts vs 002_usage_warehouse.sql', () => {
    const warehouseSql = readFileSync(
      resolve(TEMPLATES_DIR, 'shared/migrations/002_usage_warehouse.sql'),
      'utf-8'
    );
    const budgetTs = readFileSync(
      resolve(
        TEMPLATES_DIR,
        'shared/workers/lib/usage/queue/budget-enforcement.ts'
      ),
      'utf-8'
    );

    it('MONTHLY_METRIC_TO_COLUMN values exist in daily_usage_rollups', () => {
      // Extract MONTHLY_METRIC_TO_COLUMN mapping
      const mapMatch = budgetTs.match(
        /MONTHLY_METRIC_TO_COLUMN[\s\S]*?=\s*\{([\s\S]*?)\};/
      );
      expect(mapMatch).not.toBeNull();

      // Extract column names from the mapping values (right side of colon)
      const columnRefs = mapMatch![1]
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.includes(':'))
        .map((l) => {
          const match = l.match(/:\s*'([^']+)'/);
          return match ? match[1] : null;
        })
        .filter(Boolean) as string[];

      expect(columnRefs.length).toBeGreaterThan(0);

      // Extract CREATE TABLE daily_usage_rollups columns
      const tableMatch = warehouseSql.match(
        /CREATE TABLE IF NOT EXISTS daily_usage_rollups \(([\s\S]+?)\);/
      );
      expect(tableMatch).not.toBeNull();

      const tableColumns = tableMatch![1]
        .split('\n')
        .map((l) => l.trim().split(/\s+/)[0])
        .filter(
          (c) =>
            c &&
            !c.startsWith('--') &&
            !c.startsWith('PRIMARY') &&
            !c.startsWith('FOREIGN') &&
            !c.startsWith('UNIQUE') &&
            !c.startsWith(')')
        )
        .map((c) => c.replace(',', ''));

      for (const col of columnRefs) {
        expect(tableColumns).toContain(col);
      }
    });
  });
});
