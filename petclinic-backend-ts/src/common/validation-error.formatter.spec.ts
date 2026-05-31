import { ValidationError } from 'class-validator';
import {
  capitalizeFirst,
  formatValidationErrors,
  humanizePath,
} from './validation-error.formatter';

/**
 * Ports victor.training.petclinic.rest.error.ValidationErrorExtractorTest.
 *
 * The Java test mocks jakarta `ConstraintViolation`s (path + message + invalidValue).
 * Here the equivalent input is class-validator `ValidationError`s, so each Java
 * scenario is reproduced by building a `ValidationError` whose `property` is the
 * (last segment of the) path, whose single `constraints` entry carries the message,
 * and whose `value` is the invalid value. Nested/dotted paths are reproduced via
 * a parent error with `children` (mirroring Spring's "pet.name" style path).
 *
 * The humanization algorithm (humanizePath + capitalizeFirst + the
 * "message-starts-with-field" rule + " (value: X)" suffix) is identical to the
 * Java extractor, so the expected strings match the Java assertions one-for-one.
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

describe('formatValidationErrors (ports ValidationErrorExtractorTest)', () => {
  it('extract_nullViolations_returnsEmptyList: empty input -> empty list', () => {
    expect(formatValidationErrors([])).toEqual([]);
  });

  it('extract_simpleField_combinesPathAndMessage', () => {
    const errors = formatValidationErrors([err('firstName', 'must not be blank', '')]);
    expect(errors).toEqual(['First name must not be blank (value: )']);
  });

  it('extract_camelCasePath_splitIntoWords (null value -> "null")', () => {
    const errors = formatValidationErrors([err('birthDate', 'is required', null)]);
    expect(errors).toEqual(['Birth date is required (value: null)']);
  });

  it('extract_dottedPath_splitIntoWords (nested children produce dotted path)', () => {
    // "pet.name" path: a parent "pet" error with a child "name" constraint.
    const parent: ValidationError = {
      property: 'pet',
      value: { name: 'x' },
      children: [err('name', 'must not be empty', 'x')],
    };
    const errors = formatValidationErrors([parent]);
    expect(errors).toEqual(['Pet name must not be empty (value: x)']);
  });

  it('extract_messageStartsWithFieldName_usesMessageAsIs', () => {
    const errors = formatValidationErrors([err('telephone', 'telephone must be numeric', 'abc')]);
    expect(errors).toEqual(['Telephone must be numeric (value: abc)']);
  });

  it('extract_emptyMessage_usesPathOnly', () => {
    const errors = formatValidationErrors([err('city', '', 'London')]);
    expect(errors).toEqual(['City (value: London)']);
  });

  it('extract_nonStringValue_stringified (Java toString) -> 42', () => {
    // Analogous to extract_nullPath_usesValueDefault's non-string value handling:
    // a numeric invalid value renders via String(value), matching Java toString.
    const errors = formatValidationErrors([err('age', 'must not be null', 42)]);
    expect(errors).toEqual(['Age must not be null (value: 42)']);
  });
});

describe('humanizePath (ported from the Java extractor)', () => {
  it('null/undefined/empty path -> "Value" (extract_nullPath_usesValueDefault)', () => {
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

describe('capitalizeFirst (ported from the Java extractor)', () => {
  it('capitalizes the first character only', () => {
    expect(capitalizeFirst('must not be blank')).toBe('Must not be blank');
  });

  it('handles single-character and empty strings', () => {
    expect(capitalizeFirst('a')).toBe('A');
    expect(capitalizeFirst('')).toBe('');
  });
});
