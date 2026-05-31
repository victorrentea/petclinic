import { ValidationError } from 'class-validator';
import {
  capitalizeFirst,
  formatValidationErrors,
  humanizePath,
} from './validation-error.formatter';

/**
 * Tests the validation-error humanization.
 *
 * Each scenario builds a `ValidationError` whose `property` is the (last segment
 * of the) path, whose single `constraints` entry carries the message, and whose
 * `value` is the invalid value. Nested/dotted paths are built via a parent error
 * with `children` (the "pet.name" style path).
 *
 * The humanization algorithm is humanizePath + capitalizeFirst + the
 * "message-starts-with-field" rule + the " (value: X)" suffix.
 */

/** Builds a single-constraint ValidationError with the given property/message/value. */
function err(property: string, message: string, value: unknown): ValidationError {
  return {
    property,
    value,
    constraints: { someConstraint: message },
    children: [],
  };
}

describe('formatValidationErrors', () => {
  it('empty input -> empty list', () => {
    expect(formatValidationErrors([])).toEqual([]);
  });

  it('combines a simple field path and message', () => {
    const errors = formatValidationErrors([err('firstName', 'must not be blank', '')]);
    expect(errors).toEqual(['First name must not be blank (value: )']);
  });

  it('splits a camelCase path into words (null value -> "null")', () => {
    const errors = formatValidationErrors([err('birthDate', 'is required', null)]);
    expect(errors).toEqual(['Birth date is required (value: null)']);
  });

  it('splits a dotted path into words (nested children produce dotted path)', () => {
    // "pet.name" path: a parent "pet" error with a child "name" constraint.
    const parent: ValidationError = {
      property: 'pet',
      value: { name: 'x' },
      children: [err('name', 'must not be empty', 'x')],
    };
    const errors = formatValidationErrors([parent]);
    expect(errors).toEqual(['Pet name must not be empty (value: x)']);
  });

  it('uses the message as-is when it starts with the field name', () => {
    const errors = formatValidationErrors([err('telephone', 'telephone must be numeric', 'abc')]);
    expect(errors).toEqual(['Telephone must be numeric (value: abc)']);
  });

  it('uses the path only when the message is empty', () => {
    const errors = formatValidationErrors([err('city', '', 'London')]);
    expect(errors).toEqual(['City (value: London)']);
  });

  it('stringifies a non-string value -> 42', () => {
    // A numeric invalid value renders via String(value).
    const errors = formatValidationErrors([err('age', 'must not be null', 42)]);
    expect(errors).toEqual(['Age must not be null (value: 42)']);
  });
});

describe('humanizePath', () => {
  it('null/undefined/empty path -> "Value"', () => {
    expect(humanizePath(null)).toBe('Value');
    expect(humanizePath(undefined)).toBe('Value');
    expect(humanizePath('')).toBe('Value');
  });

  it('splits camelCase: birthDate -> "Birth date"', () => {
    expect(humanizePath('birthDate')).toBe('Birth date');
  });

  it('splits dotted path: pet.name -> "Pet name"', () => {
    expect(humanizePath('pet.name')).toBe('Pet name');
  });

  it('simple field is just capitalized: firstName -> "First name"', () => {
    expect(humanizePath('firstName')).toBe('First name');
  });
});

describe('capitalizeFirst', () => {
  it('capitalizes the first character only', () => {
    expect(capitalizeFirst('must not be blank')).toBe('Must not be blank');
  });

  it('handles single-character and empty strings', () => {
    expect(capitalizeFirst('a')).toBe('A');
    expect(capitalizeFirst('')).toBe('');
  });
});
