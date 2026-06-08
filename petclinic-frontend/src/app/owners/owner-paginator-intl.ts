import { MatPaginatorIntl } from '@angular/material/paginator';

/**
 * Renders the paginator range as "Showing X–Y of Z" (per the owners-list spec),
 * instead of Angular Material's default "X – Y of Z".
 */
export function ownersPaginatorIntl(): MatPaginatorIntl {
  const intl = new MatPaginatorIntl();
  intl.itemsPerPageLabel = 'Owners per page';
  intl.getRangeLabel = (page: number, pageSize: number, length: number): string => {
    if (length === 0 || pageSize === 0) {
      return 'Showing 0 of 0';
    }
    const start = page * pageSize + 1;
    const end = Math.min((page + 1) * pageSize, length);
    return `Showing ${start}–${end} of ${length}`;
  };
  return intl;
}
