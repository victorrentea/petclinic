import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsDefined, IsOptional, Length, ValidateNested } from 'class-validator';
import { RoleDto } from './role.dto';

/**
 * Data transfer object for a user.
 */
export class UserDto {
  @IsDefined({ message: 'must not be null' })
  @Length(1, 80, { message: 'size must be between 1 and 80' })
  @ApiProperty({ example: 'john.doe', description: 'The username' })
  username!: string;

  @IsOptional()
  @Length(1, 80, { message: 'size must be between 1 and 80' })
  @ApiPropertyOptional({ example: '1234abc', description: 'The password' })
  password?: string;

  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional({ example: true, description: 'Indicates if the user is enabled' })
  enabled?: boolean;

  @ValidateNested({ each: true })
  @Type(() => RoleDto)
  @ApiProperty({ type: () => [RoleDto], description: 'The roles of an user' })
  roles: RoleDto[] = [];
}
