import { ApiProperty } from '@nestjs/swagger';

import { PageDto } from '../../common/page.dto';
import { OwnerListRowDto } from './owner-list-row.dto';

/**
 * Concrete page envelope returned by GET /api/owners.
 *
 * `@nestjs/swagger` cannot introspect the generic `PageDto<T>` parameter, so this
 * subclass pins `content` to `OwnerListRowDto[]` purely for the generated OpenAPI
 * document. The runtime envelope is still built by {@link buildPage}; this class
 * adds no behaviour.
 */
export class OwnerListPageDto extends PageDto<OwnerListRowDto> {
  @ApiProperty({
    type: [OwnerListRowDto],
    description: 'The owner rows on this page.',
  })
  override content!: OwnerListRowDto[];
}
