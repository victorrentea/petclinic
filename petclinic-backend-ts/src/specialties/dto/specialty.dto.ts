import { components } from '../../generated/api-types';
import { Exact } from '../../common/contract';
import { ApiProperty } from '@nestjs/swagger';
import { IsDefined, IsOptional, Length, Min } from 'class-validator';

/**
 * Data transfer object for a specialty.
 */
export class SpecialtyDto {
  @IsOptional()
  @Min(0, { message: 'must be greater than or equal to 0' })
  @ApiProperty({
    readOnly: true,
    example: 1,
    description: 'The ID of the specialty.',
    required: true,
  })
  id!: number;

  @IsDefined({ message: 'must not be null' })
  @Length(1, 80, { message: 'size must be between 1 and 80' })
  @ApiProperty({ example: 'radiology', description: 'The name of the specialty.' })
  name!: string;
}

// Compile-time lock against the root openapi.yaml (see GUARDRAILS.md).
true satisfies Exact<SpecialtyDto, components['schemas']['SpecialtyDto']>;
