import { describe, it, expect } from 'vitest';
import { getFilesForTier } from '../src/templates.js';

describe('getFilesForTier', () => {
  it('returns shared files for minimal tier', () => {
    const files = getFilesForTier('minimal');
    const dests = files.map((f) => f.dest);

    expect(dests).toContain('platform/config/services.yaml');
    expect(dests).toContain('platform/config/budgets.yaml');
    expect(dests).toContain('scripts/sync-config.ts');
    expect(dests).toContain('package.json');
    expect(dests).toContain('tsconfig.json');
    expect(dests).toContain('README.md');

    // Should have usage wrangler config
    expect(dests.some((d) => d.includes('usage.jsonc'))).toBe(true);

    // Should NOT have standard/full files
    expect(dests.some((d) => d.includes('error-collector'))).toBe(false);
    expect(dests.some((d) => d.includes('sentinel'))).toBe(false);
    expect(dests.some((d) => d.includes('pattern-discovery'))).toBe(false);
  });

  it('returns shared + standard files for standard tier', () => {
    const files = getFilesForTier('standard');
    const dests = files.map((f) => f.dest);

    // Shared files present
    expect(dests).toContain('platform/config/services.yaml');

    // Standard files present
    expect(dests.some((d) => d.includes('error-collector'))).toBe(true);
    expect(dests.some((d) => d.includes('sentinel'))).toBe(true);
    expect(dests.some((d) => d.includes('005_error_collection'))).toBe(true);

    // Full files NOT present
    expect(dests.some((d) => d.includes('pattern-discovery'))).toBe(false);
    expect(dests.some((d) => d.includes('alert-router'))).toBe(false);
  });

  it('returns all files for full tier', () => {
    const files = getFilesForTier('full');
    const dests = files.map((f) => f.dest);

    // Shared
    expect(dests).toContain('platform/config/services.yaml');
    // Standard
    expect(dests.some((d) => d.includes('error-collector'))).toBe(true);
    // Full
    expect(dests.some((d) => d.includes('pattern-discovery'))).toBe(true);
    expect(dests.some((d) => d.includes('alert-router'))).toBe(true);
    expect(dests.some((d) => d.includes('notifications'))).toBe(true);
    expect(dests.some((d) => d.includes('search'))).toBe(true);
    expect(dests.some((d) => d.includes('settings'))).toBe(true);
    expect(dests.some((d) => d.includes('006_pattern_discovery'))).toBe(true);
    expect(dests.some((d) => d.includes('007_notifications_search'))).toBe(true);
  });

  it('includes migrations for each tier', () => {
    const minimal = getFilesForTier('minimal');
    const standard = getFilesForTier('standard');
    const full = getFilesForTier('full');

    const minMigrations = minimal.filter((f) => f.dest.includes('migrations/')).length;
    const stdMigrations = standard.filter((f) => f.dest.includes('migrations/')).length;
    const fullMigrations = full.filter((f) => f.dest.includes('migrations/')).length;

    // Minimal: 4 core + seed = 5
    expect(minMigrations).toBe(5);
    // Standard: 4 core + seed + 1 error = 6
    expect(stdMigrations).toBe(6);
    // Full: 4 core + seed + 1 error + 2 full = 8
    expect(fullMigrations).toBe(8);
  });

  it('marks template files correctly', () => {
    const files = getFilesForTier('minimal');

    const hbsFiles = files.filter((f) => f.src.endsWith('.hbs'));
    expect(hbsFiles.every((f) => f.template)).toBe(true);

    const nonHbsFiles = files.filter((f) => !f.src.endsWith('.hbs'));
    expect(nonHbsFiles.every((f) => !f.template)).toBe(true);
  });
});
