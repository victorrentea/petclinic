import { components } from '../../generated/api-types';
import { Exact } from '../../common/contract';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDefined, IsOptional, Length, Matches, Min, ValidateNested } from 'class-validator';
import { SpecialtyDto } from '../../specialties/dto/specialty.dto';

/**
 * Data transfer object for a vet.
 */
export class VetDto {
  // class-validator emits constraints in reverse declaration order, so declare Matches before
  // Length to emit the size message before the pattern message for the vet name fields.
  @IsDefined({ message: 'must not be null' })
  @Matches(/\w+/, { message: 'must match "\\w+"' })
  @Length(1, 30, { message: 'size must be between 1 and 30' })
  @ApiProperty({ example: 'James', description: 'The first name of the vet.' })
  firstName!: string;

  @IsDefined({ message: 'must not be null' })
  @Matches(/\w+/, { message: 'must match "\\w+"' })
  @Length(1, 30, { message: 'size must be between 1 and 30' })
  @ApiProperty({ example: 'Carter', description: 'The last name of the vet.' })
  lastName!: string;

  @IsDefined({ message: 'must not be null' })
  @ValidateNested({ each: true })
  @Type(() => SpecialtyDto)
  @ApiProperty({ type: () => [SpecialtyDto], description: 'The specialties of the vet.' })
  specialties: SpecialtyDto[] = [];

  @IsOptional()
  @Min(0, { message: 'must be greater than or equal to 0' })
  @ApiProperty({
    readOnly: true,
    example: 1,
    description: 'The ID of the vet.',
    required: true,
  })
  id!: number;
}

// Compile-time lock against the root openapi.yaml (see GUARDRAILS.md).
true satisfies Exact<VetDto, components['schemas']['VetDto']>;
