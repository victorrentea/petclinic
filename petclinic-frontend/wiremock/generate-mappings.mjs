// Turns the response examples baked into the repo-root `openapi.yaml` (hard-coded in Java via
// ApiExamples, exported by springdoc) into WireMock stub mappings under `./mappings/`.
//
// The PetClinic counterpart of the AI-workshop's TrailStubGenerator, generalized over every
// endpoint that carries an `application/json` example. Run directly or via `start.sh`:
//
//   node generate-mappings.mjs            # reads ../openapi.yaml (repo root), writes ./mappings/
//   node generate-mappings.mjs <spec>     # read a specific openapi.yaml
//
// Uses js-yaml, which the frontend already has in node_modules.

import yaml from 'js-yaml';
import {readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync} from 'node:fs';
import {dirname, resolve, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const specPath = resolve(process.argv[2] ?? join(scriptDir, '..', '..', 'openapi.yaml'));
const mappingsDir = join(scriptDir, 'mappings');

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'];

/** Reads either `examples.<first>.value` (springdoc's @ExampleObject) or a plain `example`. */
function extractExample(jsonContent) {
  if (!jsonContent) {
    return undefined;
  }
  const examples = jsonContent.examples;
  if (examples && typeof examples === 'object') {
    const first = Object.values(examples)[0];
    if (first && 'value' in first) {
      return first.value;
    }
  }
  return jsonContent.example;
}

/** Finds the first response code that carries an application/json example. */
function findExampleResponse(operation) {
  for (const [code, response] of Object.entries(operation.responses ?? {})) {
    const json = response?.content?.['application/json'];
    const example = extractExample(json);
    if (example !== undefined) {
      const status = Number.parseInt(code, 10);
      return {status: Number.isNaN(status) ? 200 : status, example};
    }
  }
  return undefined;
}

/** `GET /api/vets` -> `get-api-vets` (a filesystem-safe stub file name). */
function stubName(method, urlPath) {
  const slug = urlPath.replace(/[^a-zA-Z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  return `${method}-${slug}`;
}

function toMapping(method, urlPath, found) {
  return {
    request: {method: method.toUpperCase(), urlPath},
    response: {
      status: found.status,
      headers: {'Content-Type': 'application/json'},
      jsonBody: found.example,
    },
  };
}

const spec = yaml.load(readFileSync(specPath, 'utf8'));
if (!spec || !spec.paths) {
  console.error(`No paths found in ${specPath}`);
  process.exit(1);
}

rmSync(mappingsDir, {recursive: true, force: true});
mkdirSync(mappingsDir, {recursive: true});

let count = 0;
for (const [urlPath, pathItem] of Object.entries(spec.paths)) {
  for (const method of HTTP_METHODS) {
    const operation = pathItem[method];
    if (!operation) {
      continue;
    }
    const found = findExampleResponse(operation);
    if (!found) {
      continue;
    }
    const mapping = toMapping(method, urlPath, found);
    const file = join(mappingsDir, `${stubName(method, urlPath)}.json`);
    writeFileSync(file, JSON.stringify(mapping, null, 2) + '\n');
    console.log(`  ${mapping.request.method} ${urlPath} -> ${file.replace(scriptDir + '/', '')}`);
    count++;
  }
}

if (count === 0) {
  console.error(
    `No response examples found in ${specPath}. Add @ExampleObject examples and regenerate openapi.yaml.`);
  process.exit(1);
}
console.log(`Generated ${count} WireMock stub(s) from ${specPath.replace(resolve(scriptDir, '..', '..') + '/', '')}`);
