import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDefined, IsOptional, Length, Matches } from 'class-validator';

/**
 * Ported from victor.training.petclinic.rest.dto.VisitFieldsDto.
 *
 * Java LocalDate -> ISO 'YYYY-MM-DD' string (nullable).
 */
export class VisitFieldsDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be a valid ISO date (YYYY-MM-DD)' })
  @ApiPropertyOptional({ example: '2013-01-01', description: 'The date of the visit.' })
  date?: string;

  @IsDefined({ message: 'must not be null' })
  @Length(1, 255, { message: 'size must be between 1 and 255' })
  @ApiProperty({ example: 'rabies shot', description: 'The description for the visit.' })
  description!: string;
}
