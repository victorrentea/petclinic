import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDefined, IsOptional, Length, Matches, Min, ValidateNested } from 'class-validator';
import { PetDto } from '../../pets/dto/pet.dto';

/**
 * Data transfer object for an owner.
 */
export class OwnerDto {
  @IsOptional()
  @Min(0, { message: 'must be greater than or equal to 0' })
  @ApiPropertyOptional({ readOnly: true, example: 1, description: 'The ID of the pet owner.' })
  id?: number;

  @IsDefined({ message: 'must not be null' })
  @Length(1, 30, { message: 'size must be between 1 and 30' })
  @ApiProperty({ example: 'George', description: 'The first name of the pet owner.' })
  firstName!: string;

  @IsDefined({ message: 'must not be null' })
  @Length(1, 30, { message: 'size must be between 1 and 30' })
  @ApiProperty({ example: 'Franklin', description: 'The last name of the pet owner.' })
  lastName!: string;

  @IsDefined({ message: 'must not be null' })
  @Length(1, 255, { message: 'size must be between 1 and 255' })
  @ApiProperty({ example: '110 W. Liberty St.', description: 'The postal address of the pet owner.' })
  address!: string;

  @IsDefined({ message: 'must not be null' })
  @Length(1, 80, { message: 'size must be between 1 and 80' })
  @ApiProperty({ example: 'Madison', description: 'The city of the pet owner.' })
  city!: string;

  // class-validator emits constraints in reverse declaration order, so declare Length before
  // Matches to emit the pattern message before the size message for telephone.
  @IsDefined({ message: 'must not be null' })
  @Length(1, 20, { message: 'size must be between 1 and 20' })
  @Matches(/^[0-9]*$/, { message: 'must match "^[0-9]*$"' })
  @ApiProperty({ example: '6085551023', description: 'The telephone number of the pet owner.' })
  telephone!: string;

  @ValidateNested({ each: true })
  @Type(() => PetDto)
  @ApiProperty({
    type: () => [PetDto],
    readOnly: true,
    description: 'The pets owned by this individual including any booked vet visits.',
    required: true,
  })
  pets: PetDto[] = [];
}
