import { ApiProperty } from '@nestjs/swagger';
import { IsDefined, IsOptional, Length, Min } from 'class-validator';

/**
 * Ported from victor.training.petclinic.rest.dto.SpecialtyDto.
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
