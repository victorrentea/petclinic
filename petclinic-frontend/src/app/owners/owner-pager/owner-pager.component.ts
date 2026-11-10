import {Component, EventEmitter, Input, OnChanges, Output} from '@angular/core';
import {OwnerPage} from '../owner-page';

export interface PageRequest {
  pageIndex: number;
  pageSize: number;
}

interface PageRange {
  index: number;
  label: string;
}

let nextId = 0;

// Rows per page, a dropdown of every page's range ("6 – 10"), the total, and first/previous/next/last.
@Component({
  selector: 'app-owner-pager',
  templateUrl: './owner-pager.component.html',
  styleUrls: ['./owner-pager.component.css']
})
export class OwnerPagerComponent implements OnChanges {
  @Input() page: OwnerPage['page'];
  @Input() pageSizeOptions: number[];
  @Output() pageChange = new EventEmitter<PageRequest>();
  readonly id = `owner-pager-${nextId++}`;
  ranges: PageRange[] = [];

  ngOnChanges() {
    const {size, totalElements, totalPages} = this.page;
    this.ranges = Array.from({length: totalPages}, (_, index) =>
      ({index, label: `${index * size + 1} – ${Math.min((index + 1) * size, totalElements)}`}));
  }

  get lastIndex(): number {
    return this.page.totalPages - 1;
  }

  goTo(pageIndex: number) {
    this.pageChange.emit({pageIndex, pageSize: this.page.size});
  }

  // the new page starts at the first owner the user was looking at
  resize(pageSize: number) {
    this.pageChange.emit({pageIndex: Math.floor(this.page.number * this.page.size / pageSize), pageSize});
  }
}
