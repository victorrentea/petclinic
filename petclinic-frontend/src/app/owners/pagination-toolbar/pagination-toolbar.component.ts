import { Component, Input, Output, EventEmitter } from '@angular/core';

export interface PageSlot {
  page: number;
  label: string;
  isCurrent: boolean;
}

export function computeSlots(current: number, total: number): PageSlot[] {
  if (total <= 0) {
    return [];
  }

  // 1. Start with candidate set
  const candidates = [1, current - 2, current - 1, current, current + 1, current + 2, total];

  // 2. Filter out values < 1 or > total
  const filtered = candidates.filter(p => p >= 1 && p <= total);

  // 3. Deduplicate
  const unique = [...new Set(filtered)];

  // 4. Sort ascending
  unique.sort((a, b) => a - b);

  // 5. Map to PageSlot with labels
  return unique.map(page => {
    let label = page.toString();
    if (page === 1) {
      label = '« ' + label;
    }
    if (page === total) {
      label = label + ' »';
    }
    return {
      page,
      label,
      isCurrent: page === current
    };
  });
}

@Component({
  selector: 'app-pagination-toolbar',
  templateUrl: './pagination-toolbar.component.html',
  styleUrls: ['./pagination-toolbar.component.css']
})
export class PaginationToolbarComponent {
  @Input() currentPage: number = 1;
  @Input() totalPages: number = 0;
  @Output() pageChange = new EventEmitter<number>();

  get slots(): PageSlot[] {
    return computeSlots(this.currentPage, this.totalPages);
  }

  onSlotClick(slot: PageSlot): void {
    if (!slot.isCurrent) {
      this.pageChange.emit(slot.page);
    }
  }
}
