import { ApiProperty } from '@nestjs/swagger';
import { IsDefined, Length, Min } from 'class-validator';

/**
 * Ported from victor.training.petclinic.rest.dto.PetTypeDto.
 */
export class PetTypeDto {
  @IsDefined({ message: 'must not be null' })
  @Length(1, 80, { message: 'size must be between 1 and 80' })
  @ApiProperty({ example: 'cat', description: 'The name of the pet type.' })
  name!: string;

  // Java @NotNull @Min(0): id is REQUIRED (not read-only). Null -> "must not be null",
  // negative -> "must be greater than or equal to 0".
  @IsDefined({ message: 'must not be null' })
  @Min(0, { message: 'must be greater than or equal to 0' })
  @ApiProperty({ example: 1, description: 'The ID of the pet type.' })
  id!: number;
}
