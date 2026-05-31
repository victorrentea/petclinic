import { ValidationError } from 'class-validator';

/**
 * Humanizes class-validator {@link ValidationError}s into readable strings.
 *
 * Algorithm:
 *   1. humanize the property path  -> "Birth date"
 *   2. if the violation message already starts with the (lowercased) field name,
 *      use the message as-is but capitalize its first letter;
 *      else if the message is empty, use just the field;
 *      else use "<Field> <message>".
 *   3. append " (value: <invalidValue>)" — "null" when the value is null/undefined.
 */

/**
 * Splits camelCase + dots into space-separated words, lowercases everything,
 * then capitalizes only the first letter of the first word.
 *
 * "birthDate"   -> "Birth date"
 * "owner.city"  -> "Owner city"
 * ""            -> "Value"
 */
export function humanizePath(path: string | null | undefined): string {
  if (path === null || path === undefined || path === '') {
    return 'Value';
  }
  // split camelCase, then replace dots with spaces
  let single = path.replace(/([a-z])([A-Z])/g, '$1 $2');
  single = single.replace(/\./g, ' ').trim();
  if (single === '') {
    return 'Value';
  }
  const parts = single.split(/\s+/).map((p) => p.toLowerCase());
  parts[0] = capitalizeFirst(parts[0]);
  return parts.join(' ');
}

/** Capitalizes the first character of the string. */
export function capitalizeFirst(s: string): string {
  if (s === null || s === undefined || s === '') {
    return s;
  }
  return s.charAt(0).toUpperCase() + (s.length > 1 ? s.substring(1) : '');
}

/** Stringifies an invalid value for display in the error message. */
function stringifyInvalidValue(value: unknown): string {
  if (value === null || value === undefined) {
    return 'null';
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

/** Combines a humanized field with its message + invalid value. */
function combine(field: string, rawMessage: string | undefined, invalidValue: unknown): string {
  const message = (rawMessage ?? '').trim();
  const msgLower = message.toLowerCase();
  const fieldLower = field.toLowerCase();

  let combined: string;
  if (fieldLower !== '' && msgLower.startsWith(fieldLower)) {
    combined = capitalizeFirst(message);
  } else if (message === '') {
    combined = field;
  } else {
    combined = `${field} ${message}`;
  }
  return `${combined} (value: ${stringifyInvalidValue(invalidValue)})`;
}

/**
 * Flattens (possibly nested) class-validator errors into humanized messages.
 *
 * Nested errors (from {@code @ValidateNested}) carry a {@code children[]} list; the
 * full property path is the dot-joined chain of parent properties (e.g. "owner.city").
 */
export function formatValidationErrors(errors: ValidationError[]): string[] {
  const result: string[] = [];
  collect(errors, '', result);
  return result;
}

/**
 * class-validator's {@code @Length}/{@code @Min}/{@code @Matches} do NOT skip null/undefined
 * values, so a missing field fails BOTH the presence constraint ({@code isDefined}) AND the
 * secondary constraint — emitting two messages. To surface only the most useful message: when
 * the value is null/undefined and a presence constraint ({@code isDefined}) is present, keep
 * ONLY it and drop the secondary constraints. When the value is present (e.g. an empty string),
 * every failed constraint is kept, so size/pattern/etc. are all reported.
 */
function constraintMessagesFor(error: ValidationError): string[] {
  const constraints = error.constraints ?? {};
  const isNullish = error.value === null || error.value === undefined;
  if (isNullish && 'isDefined' in constraints) {
    return [constraints.isDefined];
  }
  return Object.values(constraints);
}

/** True for a class-validator array-index child property such as "0", "1", ... */
function isArrayIndex(property: string): boolean {
  return /^\d+$/.test(property);
}

function collect(errors: ValidationError[], parentPath: string, result: string[]): void {
  for (const error of errors) {
    // Render array-index segments as "roles" + "[0]" + ".name" -> "roles[0].name"
    // (class-validator surfaces the index as a child whose property is the numeric string "0").
    let path: string;
    if (parentPath === '') {
      path = error.property;
    } else if (isArrayIndex(error.property)) {
      path = `${parentPath}[${error.property}]`;
    } else {
      path = `${parentPath}.${error.property}`;
    }

    if (error.constraints) {
      const field = humanizePath(path);
      // one humanized line per failed constraint
      for (const message of constraintMessagesFor(error)) {
        result.push(combine(field, message, error.value));
      }
    }

    if (error.children && error.children.length > 0) {
      collect(error.children, path, result);
    }
  }
}
