import { components } from '../../generated/api-types';
import { Exact } from '../../common/contract';
import { ApiProperty } from '@nestjs/swagger';
import { IsDefined, Length } from 'class-validator';

/**
 * Data transfer object for a role.
 */
export class RoleDto {
  @IsDefined({ message: 'must not be null' })
  @Length(1, 80, { message: 'size must be between 1 and 80' })
  @ApiProperty({ example: 'admin', description: "The role's name" })
  name!: string;
}

// Compile-time lock against the root openapi.yaml (see GUARDRAILS.md).
true satisfies Exact<RoleDto, components['schemas']['RoleDto']>;
