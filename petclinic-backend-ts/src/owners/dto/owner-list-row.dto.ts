import { ApiProperty } from '@nestjs/swagger';

/**
 * Read-model for a single row of the owners list screen.
 *
 * Carries exactly the columns the list renders — no visits, no pet types, no
 * full pet entities (those stay in {@link OwnerDto}, served by GET
 * /api/owners/:id). Pet names are aggregated in SQL into {@link petNames}.
 */
export class OwnerListRowDto {
  @ApiProperty({ example: 1, description: 'The ID of the pet owner.' })
  id!: number;

  @ApiProperty({ example: 'George', description: 'The first name of the pet owner.' })
  firstName!: string;

  @ApiProperty({ example: 'Franklin', description: 'The last name of the pet owner.' })
  lastName!: string;

  @ApiProperty({ example: '110 W. Liberty St.', description: 'The postal address of the pet owner.' })
  address!: string;

  @ApiProperty({ example: 'Madison', description: 'The city of the pet owner.' })
  city!: string;

  @ApiProperty({ example: '6085551023', description: 'The telephone number of the pet owner.' })
  telephone!: string;

  @ApiProperty({
    type: [String],
    example: ['Basil', 'Rosy'],
    description: "The names of this owner's pets, sorted ascending.",
  })
  petNames!: string[];
}
