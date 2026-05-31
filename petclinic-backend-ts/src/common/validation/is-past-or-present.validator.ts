import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/**
 * Mirrors jakarta.validation @PastOrPresent for our ISO date string fields.
 *
 * Dates are represented as 'YYYY-MM-DD' strings (Java LocalDate). A value is
 * valid when it is null/undefined (nullability is governed separately by
 * @IsDefined/@IsNotEmpty) OR a syntactically valid date that is today or in
 * the past — never in the future.
 */
@ValidatorConstraint({ name: 'isPastOrPresent', async: false })
export class IsPastOrPresentConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (value === null || value === undefined) {
      return true; // presence handled by other decorators
    }
    if (typeof value !== 'string') {
      return false;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return false;
    }
    const parsed = Date.parse(`${value}T00:00:00`);
    if (Number.isNaN(parsed)) {
      return false;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return parsed <= today.getTime();
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} must not be in the future`;
  }
}

/**
 * @PastOrPresent equivalent. Usage: `@IsPastOrPresent({ message: '...' })`.
 */
export function IsPastOrPresent(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsPastOrPresentConstraint,
    });
  };
}
