import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { Owner } from '../owner';
import { OwnerPage } from '../owner-page';
import { OwnerListParams, OwnerService } from '../owner.service';

@Component({
  selector: 'app-owner-list',
  templateUrl: './owner-list.component.html',
  styleUrls: ['./owner-list.component.css']
})
export class OwnerListComponent implements OnInit, OnDestroy {
  owners: Owner[] = [];
  totalPages = 0;
  totalElements = 0;
  currentPage = 0;
  pageSize = 10;
  sortColumn: 'name' | 'city' = 'name';
  sortOrder: 'asc' | 'desc' = 'asc';
  isOwnersDataReceived = false;
  errorMessage: string;
  searchControl = new FormControl('');

  readonly pageSizes = [10, 20, 50];

  private destroy$ = new Subject<void>();

  constructor(private router: Router, private ownerService: OwnerService) {}

  ngOnInit() {
    this.searchControl.valueChanges.pipe(
      debounceTime(500),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.currentPage = 0;
      this.load();
    });

    this.load();
  }

  private load() {
    const params: OwnerListParams = {
      q: this.searchControl.value || '',
      page: this.currentPage,
      size: this.pageSize,
      sort: this.sortColumn,
      order: this.sortOrder
    };
    this.ownerService.getOwners(params)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (page: OwnerPage) => {
          this.owners = page.content;
          this.totalPages = page.totalPages;
          this.totalElements = page.totalElements;
          this.isOwnersDataReceived = true;
        },
        error: err => this.errorMessage = err
      });
  }

  searchByLastName(term: string) {
    this.searchControl.setValue(term, { emitEvent: false });
    this.currentPage = 0;
    this.load();
  }

  sortBy(column: 'name' | 'city') {
    if (this.sortColumn === column) {
      this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortOrder = 'asc';
    }
    this.currentPage = 0;
    this.load();
  }

  onPageSizeChange(size: number) {
    this.pageSize = size;
    this.currentPage = 0;
    this.load();
  }

  goToPage(page: number) {
    if (page >= 0 && page < this.totalPages) {
      this.currentPage = page;
      this.load();
    }
  }

  get pageNumbers(): number[] {
    const total = this.totalPages;
    const current = this.currentPage;
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i);
    }
    const pages = new Set<number>();
    pages.add(0);
    pages.add(total - 1);
    for (let i = Math.max(0, current - 2); i <= Math.min(total - 1, current + 2); i++) {
      pages.add(i);
    }
    return Array.from(pages).sort((a, b) => a - b);
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSelect(owner: Owner) {
    this.router.navigate(['/owners', owner.id]);
  }

  addOwner() {
    this.router.navigate(['/owners/add']);
  }
}
