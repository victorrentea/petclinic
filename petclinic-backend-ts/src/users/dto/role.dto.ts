import { ApiProperty } from '@nestjs/swagger';
import { IsDefined, Length } from 'class-validator';

/**
 * Ported from victor.training.petclinic.rest.dto.RoleDto.
 */
export class RoleDto {
  @IsDefined({ message: 'must not be null' })
  @Length(1, 80, { message: 'size must be between 1 and 80' })
  @ApiProperty({ example: 'admin', description: "The role's name" })
  name!: string;
}
