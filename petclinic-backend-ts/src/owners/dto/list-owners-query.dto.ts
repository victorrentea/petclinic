import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Matches, Max, Min } from 'class-validator';

/**
 * The set of sort columns the owners list accepts. The client sends one of these
 * keys; the server expands it into a full ORDER BY chain (never interpolating the
 * client input — see owner.controller's SORT_CHAINS whitelist).
 */
export const SORTABLE_COLUMNS = ['name', 'address', 'city'] as const;
export type SortableColumn = (typeof SORTABLE_COLUMNS)[number];

/**
 * Query parameters for GET /api/owners.
 *
 * Validated by the global ValidationPipe (transform + whitelist). Invalid
 * `page`/`size`/`sort` values yield 400 via the RFC-7807 filter. `sort` accepts
 * `col,dir` where `col` is one of {@link SORTABLE_COLUMNS} and `dir` is
 * `asc|desc`; the pattern alone rejects unknown columns/directions.
 */
export class ListOwnersQueryDto {
  @IsOptional()
  @ApiPropertyOptional({ type: String, default: '', description: 'Last-name prefix filter.' })
  lastName = '';

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page must be an integer' })
  @Min(0, { message: 'page must be >= 0' })
  @ApiPropertyOptional({ type: Number, default: 0, minimum: 0, description: '0-based page index.' })
  page = 0;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'size must be an integer' })
  @Min(1, { message: 'size must be >= 1' })
  @Max(100, { message: 'size must be <= 100' })
  @ApiPropertyOptional({ type: Number, default: 10, minimum: 1, maximum: 100, description: 'Page size.' })
  size = 10;

  @IsOptional()
  @Matches(/^(name|address|city),(asc|desc)$/, {
    message: 'sort must be one of name|address|city followed by ,asc or ,desc',
  })
  @ApiPropertyOptional({
    type: String,
    example: 'name,asc',
    description: "Sort as 'col,dir' where col is name|address|city and dir is asc|desc.",
  })
  sort?: string;
}
