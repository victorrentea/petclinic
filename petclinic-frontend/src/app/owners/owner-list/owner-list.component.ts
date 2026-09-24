import {Component, OnDestroy, OnInit} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {Observable, of, Subscription} from 'rxjs';
import {catchError, map, switchMap, tap} from 'rxjs/operators';
import {OwnerService} from '../owner.service';
import {OwnerPage, OwnerRow} from '../owner';
import {
  DEFAULT_OWNER_QUERY,
  nonDefaultParams,
  OwnerQuery,
  ownerQueryFrom,
  OwnerSort,
  PAGE_SIZES,
} from '../owner-query';

type ListResult = { page: OwnerPage } | { failed: true };

@Component({
  selector: 'app-owner-list',
  templateUrl: './owner-list.component.html',
  styleUrls: ['./owner-list.component.css']
})
export class OwnerListComponent implements OnInit, OnDestroy {
  readonly pageSizes = [...PAGE_SIZES];
  query: OwnerQuery = {...DEFAULT_OWNER_QUERY};
  /** Bound to the search box; only a submit turns it into the query. */
  lastName = '';
  page: OwnerPage | null = null;
  loading = false;
  loadFailed = false;
  /** Rows kept on screen while the next page loads, so the table does not collapse. */
  placeholderRows: number[] = [];
  private correctingPastTheEnd = false;
  private subscription: Subscription;

  constructor(private router: Router, private route: ActivatedRoute, private ownerService: OwnerService) {
  }

  ngOnInit() {
    // switchMap: a newer address cancels the request of the older one, so only the latest answers.
    this.subscription = this.route.queryParamMap.pipe(
      map(ownerQueryFrom),
      tap(query => this.startLoading(query)),
      switchMap(query => this.load(query))
    ).subscribe(result => this.show(result));
  }

  ngOnDestroy() {
    this.subscription?.unsubscribe();
  }

  get owners(): OwnerRow[] {
    return this.page?.content ?? [];
  }

  get isFirstPage(): boolean {
    return this.query.page === 0;
  }

  get isLastPage(): boolean {
    return !this.page || this.query.page >= this.page.totalPages - 1;
  }

  get isEmpty(): boolean {
    return !this.loading && !this.loadFailed && this.page?.totalElements === 0;
  }

  search() {
    this.navigateTo({lastName: this.lastName ?? '', page: 0});
  }

  sortBy(sort: OwnerSort) {
    if (sort === this.query.sort) {
      const direction = this.query.direction === 'asc' ? 'desc' : 'asc';
      this.navigateTo({direction, page: 0});
    } else {
      this.navigateTo({sort, direction: 'asc', page: 0});
    }
  }

  ariaSort(sort: OwnerSort): string {
    if (sort !== this.query.sort) {
      return 'none';
    }
    return this.query.direction === 'asc' ? 'ascending' : 'descending';
  }

  sortIcon(sort: OwnerSort): string {
    if (sort !== this.query.sort) {
      return 'glyphicon-sort';
    }
    return this.query.direction === 'asc' ? 'glyphicon-triangle-top' : 'glyphicon-triangle-bottom';
  }

  get totalPagesShown(): number {
    return Math.max(this.page?.totalPages ?? 1, 1);
  }

  changePageSize(size: number) {
    this.navigateTo({size, page: 0});
  }

  previousPage() {
    this.navigateTo({page: this.query.page - 1});
  }

  nextPage() {
    this.navigateTo({page: this.query.page + 1});
  }

  addOwner() {
    this.router.navigate(['/owners/add']);
  }

  private startLoading(query: OwnerQuery) {
    this.query = query;
    this.lastName = query.lastName;
    this.loading = true;
    this.loadFailed = false;
    const rowsShown = this.owners.length || query.size;
    this.placeholderRows = Array.from({length: rowsShown}, (_, i) => i);
  }

  private load(query: OwnerQuery): Observable<ListResult> {
    return this.ownerService.listOwners(query).pipe(
      map(page => ({page})),
      catchError(() => of({failed: true as const}))
    );
  }

  private show(result: ListResult) {
    if ('failed' in result) {
      this.correctingPastTheEnd = false;
      this.loading = false;
      this.loadFailed = true;
      this.page = null;
      return;
    }
    const page = result.page;
    if (this.isPastTheEnd(page) && !this.correctingPastTheEnd) {
      this.correctingPastTheEnd = true;
      const lastPage = Math.max(page.totalPages - 1, 0);
      this.navigateTo({page: lastPage}, true);
      return;
    }
    this.correctingPastTheEnd = false;
    this.loading = false;
    this.page = page;
  }

  private isPastTheEnd(page: OwnerPage): boolean {
    return page.number > 0 && page.number >= page.totalPages;
  }

  private navigateTo(changes: Partial<OwnerQuery>, replaceUrl = false) {
    const queryParams = nonDefaultParams({...this.query, ...changes});
    this.router.navigate([], {relativeTo: this.route, queryParams, replaceUrl});
  }
}
