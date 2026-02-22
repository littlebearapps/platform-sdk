/**
 * Template manifest — maps tiers to files that should be scaffolded.
 *
 * Files ending in .hbs are rendered through Handlebars.
 * All other files are copied verbatim.
 */

import type { Tier } from './prompts.js';

export interface TemplateFile {
  /** Path relative to the templates/ directory */
  src: string;
  /** Path relative to the output directory */
  dest: string;
  /** Whether this file uses Handlebars templating */
  template: boolean;
}

const SHARED_FILES: TemplateFile[] = [
  // Config
  { src: 'shared/config/services.yaml.hbs', dest: 'platform/config/services.yaml', template: true },
  { src: 'shared/config/budgets.yaml.hbs', dest: 'platform/config/budgets.yaml', template: true },

  // Scripts
  { src: 'shared/scripts/sync-config.ts', dest: 'scripts/sync-config.ts', template: false },

  // Migrations (minimal tier)
  { src: 'shared/migrations/001_core_tables.sql', dest: 'storage/d1/migrations/001_core_tables.sql', template: false },
  { src: 'shared/migrations/002_usage_warehouse.sql', dest: 'storage/d1/migrations/002_usage_warehouse.sql', template: false },
  { src: 'shared/migrations/003_feature_tracking.sql', dest: 'storage/d1/migrations/003_feature_tracking.sql', template: false },
  { src: 'shared/migrations/004_settings_alerts.sql', dest: 'storage/d1/migrations/004_settings_alerts.sql', template: false },
  { src: 'shared/migrations/seed.sql.hbs', dest: 'storage/d1/migrations/seed.sql', template: true },

  // Wrangler config (minimal)
  { src: 'shared/wrangler.usage.jsonc.hbs', dest: 'wrangler.{{projectSlug}}-usage.jsonc', template: true },

  // Project files
  { src: 'shared/package.json.hbs', dest: 'package.json', template: true },
  { src: 'shared/tsconfig.json', dest: 'tsconfig.json', template: false },
  { src: 'shared/README.md.hbs', dest: 'README.md', template: true },
];

const STANDARD_FILES: TemplateFile[] = [
  // Additional migrations
  { src: 'standard/migrations/005_error_collection.sql', dest: 'storage/d1/migrations/005_error_collection.sql', template: false },

  // Wrangler configs
  { src: 'standard/wrangler.error-collector.jsonc.hbs', dest: 'wrangler.{{projectSlug}}-error-collector.jsonc', template: true },
  { src: 'standard/wrangler.sentinel.jsonc.hbs', dest: 'wrangler.{{projectSlug}}-sentinel.jsonc', template: true },
];

const FULL_FILES: TemplateFile[] = [
  // Additional migrations
  { src: 'full/migrations/006_pattern_discovery.sql', dest: 'storage/d1/migrations/006_pattern_discovery.sql', template: false },
  { src: 'full/migrations/007_notifications_search.sql', dest: 'storage/d1/migrations/007_notifications_search.sql', template: false },

  // Wrangler configs
  { src: 'full/wrangler.pattern-discovery.jsonc.hbs', dest: 'wrangler.{{projectSlug}}-pattern-discovery.jsonc', template: true },
  { src: 'full/wrangler.alert-router.jsonc.hbs', dest: 'wrangler.{{projectSlug}}-alert-router.jsonc', template: true },
  { src: 'full/wrangler.notifications.jsonc.hbs', dest: 'wrangler.{{projectSlug}}-notifications.jsonc', template: true },
  { src: 'full/wrangler.search.jsonc.hbs', dest: 'wrangler.{{projectSlug}}-search.jsonc', template: true },
  { src: 'full/wrangler.settings.jsonc.hbs', dest: 'wrangler.{{projectSlug}}-settings.jsonc', template: true },
];

export function getFilesForTier(tier: Tier): TemplateFile[] {
  const files = [...SHARED_FILES];

  if (tier === 'standard' || tier === 'full') {
    files.push(...STANDARD_FILES);
  }

  if (tier === 'full') {
    files.push(...FULL_FILES);
  }

  return files;
}
