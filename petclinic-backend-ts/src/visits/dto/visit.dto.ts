import { components } from '../../generated/api-types';
import { Exact } from '../../common/contract';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDefined, IsOptional, Length, Matches, Min } from 'class-validator';

/**
 * Data transfer object for a visit.
 *
 * The date is an ISO 'YYYY-MM-DD' string. Unlike PetDto, `date` is not required
 * to be past-or-present here, so we only enforce ISO date syntax when present.
 */
export class VisitDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be a valid ISO date (YYYY-MM-DD)' })
  @ApiPropertyOptional({ example: '2013-01-01', description: 'The date of the visit.' })
  date?: string;

  @IsDefined({ message: 'must not be null' })
  @Length(1, 255, { message: 'size must be between 1 and 255' })
  @ApiProperty({ example: 'rabies shot', description: 'The description for the visit.' })
  description!: string;

  @IsOptional()
  @Min(0, { message: 'must be greater than or equal to 0' })
  @ApiProperty({
    readOnly: true,
    example: 1,
    description: 'The ID of the visit.',
    required: true,
  })
  id!: number;

  @IsDefined({ message: 'must not be null' })
  @Min(0, { message: 'must be greater than or equal to 0' })
  @ApiProperty({ example: 1, description: 'The ID of the pet.' })
  petId!: number;

  @ApiPropertyOptional({ readOnly: true, description: 'Name of the pet (server-populated).' })
  petName?: string;

  @ApiPropertyOptional({
    readOnly: true,
    description: 'ID of the owner of the pet (server-populated).',
  })
  ownerId?: number;

  @ApiPropertyOptional({
    readOnly: true,
    description: 'First name of the owner (server-populated).',
  })
  ownerFirstName?: string;

  @ApiPropertyOptional({
    readOnly: true,
    description: 'Last name of the owner (server-populated).',
  })
  ownerLastName?: string;

  @IsDefined({ message: 'must not be null' })
  @Min(1, { message: 'must be greater than or equal to 1' })
  @ApiProperty({ example: 1, description: 'The ID of the vet who served the visit.' })
  vetId!: number;

  @ApiPropertyOptional({
    readOnly: true,
    description: 'First name of the vet (server-populated).',
  })
  vetFirstName?: string;

  @ApiPropertyOptional({
    readOnly: true,
    description: 'Last name of the vet (server-populated).',
  })
  vetLastName?: string;
}

// Compile-time lock against the root openapi.yaml (see GUARDRAILS.md).
true satisfies Exact<VisitDto, components['schemas']['VisitDto']>;
