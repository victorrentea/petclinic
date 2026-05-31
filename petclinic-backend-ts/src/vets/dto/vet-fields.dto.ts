import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDefined, Length, Matches, ValidateNested } from 'class-validator';
import { SpecialtyDto } from '../../specialties/dto/specialty.dto';

/**
 * Mutable fields accepted when creating or updating a vet.
 *
 * IMPORTANT — contains a deliberately invalid pattern:
 * The `firstName` pattern is `^\p{L}+([ '-][\p{L}]+){0,2` (note the truncated
 * `{0,2` — no closing brace). That string is NOT a valid regex and would throw
 * if compiled. This never surfaces because NO controller validates
 * `VetFieldsDto` (the Vet controller uses `VetDto`, whose `\w+` pattern is
 * fine), so the broken pattern is never compiled.
 *
 * To keep that behaviour, the patterns are passed to `@Matches` as STRINGS (not
 * pre-built `RegExp` literals). class-validator compiles them lazily, inside
 * `validate()`, only if a value is actually validated. Therefore importing this
 * class is safe (no module-load crash); validating it would throw. `\p{L}`
 * needs the 'u' modifier.
 */
export class VetFieldsDto {
  // class-validator emits constraints in reverse declaration order, so declare Matches before
  // Length to emit the size message before the pattern message. The @Matches messages quote the
  // exact pattern source (the first-name one being the truncated/broken pattern).
  @IsDefined({ message: 'must not be null' })
  @Matches("^\\p{L}+([ '-][\\p{L}]+){0,2", 'u', {
    message: 'must match "^\\p{L}+([ \'-][\\p{L}]+){0,2"',
  })
  @Length(1, 30, { message: 'size must be between 1 and 30' })
  @ApiProperty({ example: 'James', description: 'The first name of the vet.' })
  firstName!: string;

  @IsDefined({ message: 'must not be null' })
  @Matches("^\\p{L}+([ '-][\\p{L}]+){0,2}\\.", 'u', {
    message: 'must match "^\\p{L}+([ \'-][\\p{L}]+){0,2}\\."',
  })
  @Length(1, 30, { message: 'size must be between 1 and 30' })
  @ApiProperty({ example: 'Carter', description: 'The last name of the vet.' })
  lastName!: string;

  @IsDefined({ message: 'must not be null' })
  @ValidateNested({ each: true })
  @Type(() => SpecialtyDto)
  @ApiProperty({ type: () => [SpecialtyDto], description: 'The specialties of the vet.' })
  specialties: SpecialtyDto[] = [];
}
