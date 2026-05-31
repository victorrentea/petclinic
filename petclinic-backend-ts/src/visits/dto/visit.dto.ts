import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDefined, IsOptional, Length, Matches, Min } from 'class-validator';

/**
 * Ported from victor.training.petclinic.rest.dto.VisitDto.
 *
 * Java LocalDate -> ISO 'YYYY-MM-DD' string. The Java DTO has no @PastOrPresent
 * on `date` here (unlike PetDto), so we only enforce ISO date syntax when present.
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
}
