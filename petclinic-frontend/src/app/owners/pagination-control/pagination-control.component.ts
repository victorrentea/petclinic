import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-pagination-control',
  templateUrl: './pagination-control.component.html'
})
export class PaginationControlComponent {
  @Input() currentPage = 0;
  @Input() totalPages = 0;
  @Input() pageSize = 10;
  @Input() loading = false;
  @Output() pageChange = new EventEmitter<number>();
  @Output() pageSizeChange = new EventEmitter<number>();

  get pages(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i);
  }

  onPageClick(page: number): void {
    this.pageChange.emit(page);
  }

  onPageSizeChange(event: Event): void {
    const size = +(event.target as HTMLSelectElement).value;
    this.pageSizeChange.emit(size);
  }
}
