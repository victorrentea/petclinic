import { components } from '../../generated/api-types';
import { Exact } from '../../common/contract';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDefined, IsOptional, Matches, MaxLength, Min, ValidateNested } from 'class-validator';
import { PetTypeDto } from './pet-type.dto';
import { VisitDto } from '../../visits/dto/visit.dto';
import { IsPastOrPresent } from '../../common/validation/is-past-or-present.validator';

/**
 * Data transfer object for a pet.
 *
 * birthDate is an ISO 'YYYY-MM-DD' string.
 */
export class PetDto {
  // Reject null, empty AND whitespace-only with a single "must not be blank":
  // @IsDefined covers null; @Matches(/\S/) covers empty/whitespace; @MaxLength caps length at 30.
  @IsDefined({ message: 'must not be blank' })
  @Matches(/\S/, { message: 'must not be blank' })
  @MaxLength(30, { message: 'size must be between 0 and 30' })
  @ApiProperty({ example: 'Leo', description: 'The name of the pet.' })
  name!: string;

  @IsDefined({ message: 'must not be null' })
  @IsPastOrPresent({ message: 'Birth date must not be in the future' })
  @ApiProperty({ example: '2010-09-07' })
  birthDate!: string;

  @IsDefined({ message: 'must not be null' })
  @ValidateNested()
  @Type(() => PetTypeDto)
  type!: PetTypeDto;

  @IsOptional()
  @Min(0, { message: 'must be greater than or equal to 0' })
  @ApiProperty({
    readOnly: true,
    example: 1,
    description: 'The ID of the pet.',
    required: true,
  })
  id!: number;

  @IsOptional()
  @Min(0, { message: 'must be greater than or equal to 0' })
  @ApiPropertyOptional({ readOnly: true, example: 1, description: "The ID of the pet's owner." })
  ownerId?: number;

  @ValidateNested({ each: true })
  @Type(() => VisitDto)
  @ApiProperty({
    type: () => [VisitDto],
    readOnly: true,
    description: 'Vet visit bookings for this pet.',
    required: true,
  })
  visits: readonly VisitDto[] = [];
}

// Compile-time lock against the root openapi.yaml (see GUARDRAILS.md).
true satisfies Exact<PetDto, components['schemas']['PetDto']>;
