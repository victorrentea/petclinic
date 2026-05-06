import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormControl } from '@angular/forms';
import { Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { OwnerService } from '../owner.service';
import { Owner, OwnerPage } from '../owner';

@Component({
  selector: 'app-owner-list',
  templateUrl: './owner-list.component.html',
  styleUrls: ['./owner-list.component.css']
})
export class OwnerListComponent implements OnInit, OnDestroy {
  errorMessage: string;
  ownerPage: OwnerPage = { content: [], totalElements: 0, totalPages: 0, number: 0, size: 10 };
  isOwnersDataReceived = false;

  q = '';
  page = 0;
  size = 10;
  sort = 'name';
  direction = 'asc';

  readonly searchControl = new FormControl('');
  pageWindowNumbers: number[] = [];

  private subscription: Subscription;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private ownerService: OwnerService
  ) {}

  ngOnInit() {
    // Drive everything from queryParams via switchMap
    this.subscription = this.route.queryParams.pipe(
      switchMap(params => {
        this.q = (params['q'] ?? '').trim();
        this.page = +params['page'] || 0;
        this.size = +params['size'] || 10;
        this.sort = params['sort'] || 'name';
        this.direction = params['direction'] || 'asc';

        // Sync search input without triggering valueChanges → debounce cycle
        if (this.searchControl.value !== this.q) {
          this.searchControl.setValue(this.q, { emitEvent: false });
        }

        return this.ownerService.getOwnersPaged(this.q, this.page, this.size, this.sort, this.direction);
      })
    ).subscribe(
      page => {
        this.ownerPage = page;
        this.isOwnersDataReceived = true;
        this.buildPageWindow();
      },
      error => this.errorMessage = error as any
    );

    // Search input debounce → navigate with page reset
    this.searchControl.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(q => this.navigateTo({ q: q ?? '', page: 0 }));
  }

  // ---- Navigation helpers ----

  private navigateTo(overrides: Partial<{ q: string; page: number; size: number; sort: string; direction: string }>,
                     replaceUrl = true) {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        q: overrides.q ?? this.q,
        page: overrides.page ?? this.page,
        size: overrides.size ?? this.size,
        sort: overrides.sort ?? this.sort,
        direction: overrides.direction ?? this.direction
      },
      replaceUrl
    });
  }

  goToPage(p: number) {
    this.navigateTo({ page: p }, false);
  }

  onSizeChange(newSize: number) {
    this.navigateTo({ size: newSize, page: 0 });
  }

  onSortHeader(column: string) {
    if (this.sort === column) {
      this.navigateTo({ direction: this.direction === 'asc' ? 'desc' : 'asc' });
    } else {
      this.navigateTo({ sort: column, direction: 'asc' });
    }
  }

  // ---- Pagination ----

  get isFirstPage(): boolean {
    return this.page === 0;
  }

  get isLastPage(): boolean {
    return this.page >= this.ownerPage.totalPages - 1;
  }

  get recordStart(): number {
    return this.ownerPage.totalElements === 0 ? 0 : this.page * this.size + 1;
  }

  get recordEnd(): number {
    return Math.min((this.page + 1) * this.size, this.ownerPage.totalElements);
  }

  private buildPageWindow() {
    const total = this.ownerPage.totalPages;
    if (total === 0) {
      this.pageWindowNumbers = [];
      return;
    }
    const windowSize = 5;
    let start = Math.max(0, this.page - Math.floor(windowSize / 2));
    let end = start + windowSize - 1;
    if (end >= total) {
      end = total - 1;
      start = Math.max(0, end - windowSize + 1);
    }
    this.pageWindowNumbers = Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }

  // ---- UI helpers ----

  sortIcon(column: string): string {
    if (this.sort !== column) return '';
    return this.direction === 'asc' ? '🔼' : '🔽';
  }

  onSelect(owner: Owner) {
    this.router.navigate(['/owners', owner.id]);
  }

  addOwner() {
    this.router.navigate(['/owners/add']);
  }

  ngOnDestroy() {
    this.subscription?.unsubscribe();
  }
}
