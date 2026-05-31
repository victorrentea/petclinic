#!/usr/bin/env ts-node
/**
 * OpenAPI sync guardrail — CLI.
 *
 * Regenerates the committed `openapi.yaml` and runs the drift check described in
 * GUARDRAILS.md.
 *
 *   npm run guardrail:openapi:generate   # (re)write the committed openapi.yaml
 *   npm run guardrail:openapi            # diff live document vs committed; exit 1 on drift
 *
 * The document is built offline (no Postgres) — see openapi-document.ts.
 */
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { generateOpenApiYaml } from './openapi-document';

const COMMITTED = join(__dirname, '..', '..', 'openapi.yaml');

async function generate(): Promise<void> {
  const yamlText = await generateOpenApiYaml();
  writeFileSync(COMMITTED, yamlText, 'utf8');
  // eslint-disable-next-line no-console
  console.log(`Wrote ${COMMITTED} (${yamlText.length} bytes)`);
}

async function diff(): Promise<void> {
  if (!existsSync(COMMITTED)) {
    // eslint-disable-next-line no-console
    console.error(
      `Committed openapi.yaml not found at ${COMMITTED}. ` +
        `Run "npm run guardrail:openapi:generate" first.`,
    );
    process.exit(1);
  }
  const live = await generateOpenApiYaml();
  const committed = readFileSync(COMMITTED, 'utf8');
  if (live.trim() === committed.trim()) {
    // eslint-disable-next-line no-console
    console.log('OpenAPI document is in sync with the committed openapi.yaml.');
    return;
  }
  // eslint-disable-next-line no-console
  console.error(
    'OpenAPI DRIFT: the live document differs from the committed openapi.yaml.\n' +
      'Run "npm run guardrail:openapi:generate" and commit the result.',
  );
  process.exit(1);
}

async function main(): Promise<void> {
  const mode = process.argv[2];
  if (mode === '--generate' || mode === 'generate') {
    await generate();
  } else {
    await diff();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
