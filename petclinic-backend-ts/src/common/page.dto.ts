import { ApiProperty } from '@nestjs/swagger';

/**
 * Spring-style page envelope returned by paginated list endpoints.
 *
 * Generic in the row type `T`. `@nestjs/swagger` cannot introspect the generic
 * parameter, so the `content` schema is supplied per-endpoint via an `allOf` of
 * `$ref(PageDto)` + an override of `content.items` (see how the controller wires
 * `@ApiOkResponse`). The non-generic envelope fields below are described here.
 */
export class PageDto<T> {
  @ApiProperty({
    isArray: true,
    description: 'The rows on this page.',
  })
  content!: T[];

  @ApiProperty({
    type: Number,
    format: 'int64',
    example: 53,
    description: 'Total number of rows across all pages (after filtering).',
  })
  totalElements!: number;

  @ApiProperty({
    type: Number,
    format: 'int32',
    example: 6,
    description: 'Total number of pages.',
  })
  totalPages!: number;

  @ApiProperty({
    type: Number,
    format: 'int32',
    example: 0,
    description: 'The 0-based index of this page.',
  })
  number!: number;

  @ApiProperty({
    type: Number,
    format: 'int32',
    example: 10,
    description: 'The requested page size.',
  })
  size!: number;
}

/**
 * Builds a {@link PageDto} from the page content plus paging inputs. `totalPages`
 * is derived from `totalElements` and `size` (at least 1 page when there are
 * rows, 0 pages when empty).
 */
export function buildPage<T>(
  content: T[],
  totalElements: number,
  pageNumber: number,
  size: number,
): PageDto<T> {
  const page = new PageDto<T>();
  page.content = content;
  page.totalElements = totalElements;
  page.totalPages = totalElements === 0 ? 0 : Math.ceil(totalElements / size);
  page.number = pageNumber;
  page.size = size;
  return page;
}
