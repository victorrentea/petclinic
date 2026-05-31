import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDefined, Length, Matches, ValidateNested } from 'class-validator';
import { SpecialtyDto } from '../../specialties/dto/specialty.dto';

/**
 * Ported from victor.training.petclinic.rest.dto.VetFieldsDto.
 *
 * IMPORTANT — faithful port of a latent Java bug:
 * The Java `firstName` @Pattern is `^\p{L}+([ '-][\p{L}]+){0,2` (note the
 * truncated `{0,2` — no closing brace). That string is NOT a valid regex:
 * `Pattern.compile` throws `PatternSyntaxException`. In the Java backend this
 * never surfaces because NO controller validates `VetFieldsDto` (the Vet
 * controller uses `VetDto`, whose `\w+` pattern is fine), so the broken regex
 * is never compiled.
 *
 * To mirror that exactly we pass the patterns to `@Matches` as STRINGS (not
 * pre-built `RegExp` literals). class-validator compiles them lazily, inside
 * `validate()`, only if a value is actually validated — just like Hibernate
 * Validator. Therefore importing this class is safe (no module-load crash),
 * and validating it would fail the same way Java does. `\p{L}` needs the 'u'
 * modifier. The patterns are copied byte-for-byte from the Java source.
 */
export class VetFieldsDto {
  // class-validator emits constraints in reverse declaration order, so declare Matches before
  // Length to reproduce Java's Size-then-Pattern emission order. The @Matches messages quote the
  // EXACT Java @Pattern regexp source (the first-name one is the truncated/broken Java regex,
  // faithfully reproduced).
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
