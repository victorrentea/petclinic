import { readFileSync } from 'fs';
import { resolve } from 'path';
import { buildDepsGraph, generateDiagram } from './package-deps';

const DIAGRAM_PATH = resolve(__dirname, '../../docs/packages.puml');

describe('Package dependency diagram', () => {
  it('docs/packages.puml reflects actual TypeScript imports — run `npm run guardrail:package-deps` to update', () => {
    const generated = generateDiagram(buildDepsGraph());
    const committed = readFileSync(DIAGRAM_PATH, 'utf-8');
    expect(generated).toBe(committed);
  });
});
