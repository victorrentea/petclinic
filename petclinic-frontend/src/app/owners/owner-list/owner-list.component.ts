import { Component, OnInit, OnDestroy, inject, DestroyRef } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, BehaviorSubject, of, Subscription, EMPTY } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, tap, finalize, catchError } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { OwnerService } from '../owner.service';
import { OwnerPage } from '../owner-page';
import { OwnerSummary } from '../owner-summary';
import { PageCacheService } from '../page-cache.service';

export interface PaginationState {
  page: number;
  size: number;
  sort: string;
  q: string;
}

@Component({
  selector: 'app-owner-list',
  templateUrl: './owner-list.component.html',
  styleUrls: ['./owner-list.component.css'],
  providers: [PageCacheService]
})
export class OwnerListComponent implements OnInit {
  paginationState: PaginationState = { page: 0, size: 10, sort: 'name,asc', q: '' };

  currentPage: OwnerPage | null = null;
  isLoading = false;
  errorMessage = '';
  searchText = '';

  private stateSubject = new BehaviorSubject<PaginationState>(this.paginationState);
  private searchSubject = new Subject<string>();
  private destroyRef = inject(DestroyRef);

  constructor(
    private router: Router,
    private ownerService: OwnerService,
    private pageCacheService: PageCacheService
  ) {}

  ngOnInit(): void {
    // Debounced search input → reset page, update q, emit state
    this.searchSubject.pipe(
      debounceTime(400),
      distinctUntilChanged(),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(term => {
      this.paginationState = { ...this.paginationState, page: 0, q: term };
      this.pageCacheService.invalidateAll();
      this.stateSubject.next(this.paginationState);
    });

    // State changes → fetch page (with switchMap for in-flight cancellation)
    this.stateSubject.pipe(
      switchMap(state => {
        const cached = this.pageCacheService.getPage(state.page, state.size, state.sort, state.q);
        if (cached) {
          return of(cached);
        }
        this.isLoading = true;
        return this.ownerService.getOwnerPage({
          page: state.page,
          size: state.size,
          sort: state.sort,
          q: state.q || undefined
        }).pipe(
          tap(page => {
            this.pageCacheService.storePage(state.page, state.size, state.sort, state.q, page);
            this.pageCacheService.evictOutsideWindow(state.page);
            this.prefetchAdjacentPages(state);
          }),
          catchError(() => {
            this.errorMessage = 'Failed to load owners';
            return EMPTY;
          }),
          finalize(() => {
            this.isLoading = false;
          })
        );
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(page => {
      this.currentPage = page;
      this.isLoading = false;
    });
  }

  onSearchInput(value: string): void {
    this.searchText = value;
    this.searchSubject.next(value);
  }

  onPageChange(oneBasedPage: number): void {
    const zeroBasedPage = oneBasedPage - 1;
    this.paginationState = { ...this.paginationState, page: zeroBasedPage };
    this.stateSubject.next(this.paginationState);
  }

  onPageSizeChange(newSize: number): void {
    this.pageCacheService.invalidateAll();
    this.paginationState = { ...this.paginationState, page: 0, size: newSize };
    this.stateSubject.next(this.paginationState);
  }

  onSortChange(column: string): void {
    const [currentCol, currentDir] = this.paginationState.sort.split(',');
    let newSort: string;
    if (currentCol === column) {
      // Toggle direction
      newSort = `${column},${currentDir === 'asc' ? 'desc' : 'asc'}`;
    } else {
      // New column, default ascending
      newSort = `${column},asc`;
    }
    this.pageCacheService.invalidateAll();
    this.paginationState = { ...this.paginationState, page: 0, sort: newSort };
    this.stateSubject.next(this.paginationState);
  }

  onSelect(owner: OwnerSummary): void {
    this.router.navigate(['/owners', owner.id]);
  }

  addOwner(): void {
    this.router.navigate(['/owners/add']);
  }

  get sortColumn(): string {
    return this.paginationState.sort.split(',')[0];
  }

  get sortDirection(): string {
    return this.paginationState.sort.split(',')[1];
  }

  get sortIndicator(): string {
    return this.sortDirection === 'asc' ? '▲' : '▼';
  }

  get showingStart(): number {
    if (!this.currentPage || this.currentPage.totalElements === 0) return 0;
    return this.currentPage.number * this.currentPage.size + 1;
  }

  get showingEnd(): number {
    if (!this.currentPage || this.currentPage.totalElements === 0) return 0;
    return Math.min((this.currentPage.number + 1) * this.currentPage.size, this.currentPage.totalElements);
  }

  private prefetchAdjacentPages(state: PaginationState): void {
    const totalPages = this.currentPage?.totalPages ?? 0;
    const pagesToPrefetch = [state.page - 1, state.page + 1, state.page - 2, state.page + 2];

    for (const p of pagesToPrefetch) {
      if (p >= 0 && p < totalPages && !this.pageCacheService.getPage(p, state.size, state.sort, state.q)) {
        this.ownerService.getOwnerPage({
          page: p,
          size: state.size,
          sort: state.sort,
          q: state.q || undefined
        }).pipe(
          takeUntilDestroyed(this.destroyRef),
          catchError(() => EMPTY)
        ).subscribe(page => {
          this.pageCacheService.storePage(p, state.size, state.sort, state.q, page);
        });
      }
    }
  }
}
