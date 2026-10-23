import {Injectable} from '@angular/core';
import {MatPaginatorIntl} from '@angular/material/paginator';

@Injectable()
export class OwnerPaginatorIntl extends MatPaginatorIntl {
  override getRangeLabel = (page: number, pageSize: number, length: number): string => {
    if (length === 0) {
      return '0 of 0';
    }
    const first = page * pageSize + 1;
    const last = Math.min(first + pageSize - 1, length);
    return `Page ${page + 1} – ${first}..${last} of ${length}`;
  };
}
