/**
 * DTO ↔ OpenAPI contract lock guardrail.
 *
 * The root `openapi.yaml` is the source of truth for DTO shapes. The backend
 * generates `src/generated/api-types.ts` from it (`npm run generate:api`, also
 * wired as `prebuild`), and every DTO class carries a compile-time assertion
 * (`true satisfies Exact<XDto, components['schemas']['XDto']>`) so that any
 * drift between a DTO class and the contract breaks `tsc`.
 *
 * This spec asserts the wiring exists: the generated file is present and every
 * `*Dto` schema exposed by the contract is locked by an `Exact` assertion in
 * some DTO source file. The actual shape comparison is done by the compiler.
 */
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { parse } from 'yaml';

const BACKEND_ROOT = join(__dirname, '..', '..');
const GENERATED_TYPES = join(BACKEND_ROOT, 'src', 'generated', 'api-types.ts');
const OPENAPI_YAML = join(BACKEND_ROOT, '..', 'openapi.yaml');

function dtoSchemaNames(): string[] {
  const doc = parse(readFileSync(OPENAPI_YAML, 'utf8')) as {
    components: { schemas: Record<string, unknown> };
  };
  return Object.keys(doc.components.schemas).filter((name) => name.endsWith('Dto'));
}

function allDtoSources(): string {
  const srcDir = join(BACKEND_ROOT, 'src');
  const dtoFiles: string[] = [];
  for (const domain of readdirSync(srcDir, { withFileTypes: true })) {
    const dtoDir = join(srcDir, domain.name, 'dto');
    if (domain.isDirectory() && existsSync(dtoDir)) {
      for (const file of readdirSync(dtoDir)) {
        dtoFiles.push(join(dtoDir, file));
      }
    }
  }
  return dtoFiles.map((file) => readFileSync(file, 'utf8')).join('\n');
}

describe('DTO ↔ OpenAPI contract lock', () => {
  it('generates backend api-types.ts from the root openapi.yaml', () => {
    expect(existsSync(GENERATED_TYPES)).toBe(true);
  });

  it('locks every *Dto schema of the contract with an Exact assertion', () => {
    const sources = allDtoSources();
    const unlocked = dtoSchemaNames().filter(
      (schema) => !sources.includes(`satisfies Exact<${schema}, components['schemas']['${schema}']>`),
    );
    expect(unlocked).toEqual([]);
  });
});
