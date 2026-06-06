/**
 * Date-column type guardrail.
 *
 * Parses TypeScript sources with the TypeScript compiler API (real AST, no
 * regex) and flags any `@Entity` class property whose `@Column` declares a
 * `date` column but whose TS type is `string` — those must be typed `Date`.
 *
 * CLI (wired into `.githooks/pre-commit`):
 *   ts-node date-column-type.ts [--staged] <file.ts> [...]
 * With `--staged` each file is read from the git index (`git show :./file`),
 * i.e. exactly the content being committed; otherwise from disk.
 */
import { readFileSync } from 'fs';
import { spawnSync } from 'child_process';
import * as ts from 'typescript';

export interface DateStringViolation {
  file: string;
  className: string;
  property: string;
  line: number;
}

export function findDateStringViolations(sourceText: string, fileName: string): DateStringViolation[] {
  const source = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true);
  const violations: DateStringViolation[] = [];
  ts.forEachChild(source, function visit(node) {
    if (ts.isClassDeclaration(node) && hasDecorator(node, 'Entity')) {
      collectViolations(node, source, violations);
    }
    ts.forEachChild(node, visit);
  });
  return violations;
}

function collectViolations(cls: ts.ClassDeclaration, source: ts.SourceFile, out: DateStringViolation[]): void {
  for (const member of cls.members) {
    if (!ts.isPropertyDeclaration(member) || !ts.isIdentifier(member.name)) {
      continue;
    }
    if (columnTypeOf(member) === 'date' && isStringType(member.type)) {
      out.push({
        file: source.fileName,
        className: cls.name?.text ?? '<anonymous>',
        property: member.name.text,
        line: source.getLineAndCharacterOfPosition(member.name.getStart()).line + 1,
      });
    }
  }
}

/** The column type declared by `@Column('date')` or `@Column({ type: 'date' })`, if any. */
function columnTypeOf(property: ts.PropertyDeclaration): string | undefined {
  const decorator = findDecorator(property, 'Column');
  if (!decorator || !ts.isCallExpression(decorator.expression)) {
    return undefined;
  }
  for (const arg of decorator.expression.arguments) {
    if (ts.isStringLiteral(arg)) {
      return arg.text;
    }
    if (ts.isObjectLiteralExpression(arg)) {
      const typeProp = arg.properties
        .filter(ts.isPropertyAssignment)
        .find((p) => ts.isIdentifier(p.name) && p.name.text === 'type');
      if (typeProp && ts.isStringLiteral(typeProp.initializer)) {
        return typeProp.initializer.text;
      }
    }
  }
  return undefined;
}

function isStringType(type: ts.TypeNode | undefined): boolean {
  if (!type) {
    return false;
  }
  if (ts.isUnionTypeNode(type)) {
    return type.types.some(isStringType);
  }
  return type.kind === ts.SyntaxKind.StringKeyword;
}

function hasDecorator(node: ts.HasDecorators, name: string): boolean {
  return findDecorator(node, name) !== undefined;
}

function findDecorator(node: ts.HasDecorators, name: string): ts.Decorator | undefined {
  return ts.getDecorators(node)?.find((decorator) => {
    const expr = decorator.expression;
    if (ts.isCallExpression(expr)) {
      return ts.isIdentifier(expr.expression) && expr.expression.text === name;
    }
    return ts.isIdentifier(expr) && expr.text === name;
  });
}

function readStaged(file: string): string {
  const result = spawnSync('git', ['show', `:./${file}`], { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`git show failed for ${file}: ${result.stderr}`);
  }
  return result.stdout;
}

function main(): void {
  const args = process.argv.slice(2);
  const staged = args[0] === '--staged';
  const files = staged ? args.slice(1) : args;
  const violations = files.flatMap((file) => {
    const content = staged ? readStaged(file) : readFileSync(file, 'utf8');
    return findDateStringViolations(content, file);
  });
  for (const v of violations) {
    console.error(`${v.file}:${v.line} — ${v.className}.${v.property} is a 'date' column typed string; type it Date`);
  }
  process.exit(violations.length > 0 ? 1 : 0);
}

if (require.main === module) {
  main();
}
