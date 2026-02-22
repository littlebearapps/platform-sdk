/**
 * Interactive CLI prompts for project scaffolding configuration.
 *
 * Falls back to sensible defaults when running non-interactively.
 */

import * as readline from 'node:readline';

export type Tier = 'minimal' | 'standard' | 'full';

export interface ScaffoldOptions {
  projectName: string;
  projectSlug: string;
  githubOrg: string;
  tier: Tier;
  gatusUrl: string;
  defaultAssignee: string;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function prompt(question: string, defaultValue: string): Promise<string> {
  // Non-interactive: use defaults
  if (!process.stdin.isTTY) {
    return defaultValue;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise<string>((resolve) => {
    const display = defaultValue ? `${question} (${defaultValue}): ` : `${question}: `;
    rl.question(`  ${display}`, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue);
    });
  });
}

async function promptSelect(question: string, options: string[], defaultIndex = 0): Promise<string> {
  if (!process.stdin.isTTY) {
    return options[defaultIndex];
  }

  console.log(`  ${question}`);
  options.forEach((opt, i) => {
    const marker = i === defaultIndex ? '>' : ' ';
    console.log(`    ${marker} ${i + 1}. ${opt}`);
  });

  const answer = await prompt('Choose', String(defaultIndex + 1));
  const idx = parseInt(answer, 10) - 1;
  return options[idx] ?? options[defaultIndex];
}

export async function collectOptions(projectNameArg?: string): Promise<ScaffoldOptions> {
  const projectName = projectNameArg || await prompt('Project name', 'my-platform');
  const projectSlug = await prompt('Project slug (for resource names)', slugify(projectName));
  const githubOrg = await prompt('GitHub org (for error issue creation)', '');
  const tier = await promptSelect('Setup tier:', ['minimal', 'standard', 'full'], 1) as Tier;
  const gatusUrl = await prompt('Gatus status page URL (optional)', '');
  const defaultAssignee = await prompt('Default GitHub assignee (optional)', '');

  return {
    projectName,
    projectSlug,
    githubOrg,
    tier,
    gatusUrl,
    defaultAssignee,
  };
}
