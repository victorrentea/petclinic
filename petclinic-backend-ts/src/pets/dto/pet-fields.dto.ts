import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDefined, MaxLength, ValidateNested } from 'class-validator';
import { PetTypeDto } from '../../pet-types/dto/pet-type.dto';
import { IsPastOrPresent } from '../../common/validation/is-past-or-present.validator';

/**
 * Mutable fields accepted when creating or updating a pet.
 *
 * birthDate is an ISO 'YYYY-MM-DD' string.
 */
export class PetFieldsDto {
  @IsDefined()
  @MaxLength(30)
  @ApiProperty({ example: 'Leo', description: 'The name of the pet.' })
  name!: string;

  @IsDefined()
  @IsPastOrPresent({ message: 'Birth date must not be in the future' })
  @ApiProperty({ example: '2010-09-07', description: 'The date of birth of the pet.' })
  birthDate!: string;

  @IsDefined()
  @ValidateNested()
  @Type(() => PetTypeDto)
  @ApiProperty({ type: () => PetTypeDto })
  type!: PetTypeDto;
}
