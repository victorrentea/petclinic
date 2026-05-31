import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDefined, IsOptional, Length, Matches } from 'class-validator';

/**
 * Mutable fields accepted when creating or updating a visit.
 *
 * The date is a nullable ISO 'YYYY-MM-DD' string.
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
