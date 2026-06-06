import { components } from '../../generated/api-types';
import { Exact } from '../../common/contract';
import { ApiProperty } from '@nestjs/swagger';
import { IsDefined, Length } from 'class-validator';

/**
 * Mutable fields accepted when creating or updating a pet type.
 */
export class PetTypeFieldsDto {
  @IsDefined({ message: 'must not be null' })
  @Length(1, 80, { message: 'size must be between 1 and 80' })
  @ApiProperty({ example: 'cat', description: 'The name of the pet type.' })
  name!: string;
}

// Compile-time lock against the root openapi.yaml (see GUARDRAILS.md).
true satisfies Exact<PetTypeFieldsDto, components['schemas']['PetTypeFieldsDto']>;
