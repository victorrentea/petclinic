import {Component, OnDestroy, OnInit} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {BehaviorSubject, combineLatest, Observable, of, Subject} from 'rxjs';
import {catchError, distinctUntilChanged, filter, map, startWith, switchMap, takeUntil, tap} from 'rxjs/operators';
import {OwnerService} from '../owner.service';
import {Owner} from '../owner';
import {
  DEFAULT_OWNER_QUERY, OwnerPage, OwnerQuery, OwnerSortField, PAGE_SIZES, PageSize
} from '../owner-page';
import {parseOwnerQuery, sameQuery, toQueryParams} from '../owner-query';
import {petEmoji} from '../pet-emoji';

/** What the grid shows for the applied query; only the latest request can produce one. */
export type OwnerListView =
  | {kind: 'loading'}
  | {kind: 'error'; message: string}
  | {kind: 'loaded'; page: OwnerPage};

@Component({
  selector: 'app-owner-list',
  templateUrl: './owner-list.component.html',
  styleUrls: ['./owner-list.component.css']
})
export class OwnerListComponent implements OnInit, OnDestroy {
  readonly petEmoji = petEmoji;
  readonly pageSizes: PageSize[] = [...PAGE_SIZES];
  /** The query in the URL; what every request, header and control reflects. */
  applied: OwnerQuery = DEFAULT_OWNER_QUERY;
  /** What is typed in the search box; only becomes the filter when submitted. */
  draftLastName = '';
  view: OwnerListView = {kind: 'loading'};
  /** The last page that loaded: kept, dimmed, while the next one loads, so the grid keeps its height. */
  page: OwnerPage | undefined;

  private readonly retry$ = new BehaviorSubject<void>(undefined);
  private readonly destroyed$ = new Subject<void>();

  constructor(private router: Router, private route: ActivatedRoute, private ownerService: OwnerService) {
  }

  ngOnInit() {
    const appliedQuery$ = this.route.queryParamMap.pipe(
      map(parseOwnerQuery),
      tap(parsed => parsed.correction && this.navigate(parsed.correction, true)),
      filter(parsed => !parsed.correction),
      map(parsed => parsed.query),
      distinctUntilChanged(sameQuery),
      tap(query => this.apply(query))
    );
    combineLatest([appliedQuery$, this.retry$]).pipe(
      switchMap(([query]) => this.load(query)),
      takeUntil(this.destroyed$)
    ).subscribe(view => this.show(view));
  }

  ngOnDestroy() {
    this.destroyed$.next();
    this.destroyed$.complete();
  }

  get isRefreshing(): boolean {
    return this.view.kind === 'loading' && !!this.page;
  }

  get rangeText(): string {
    const page = this.page;
    if (!page || page.content.length === 0) {
      return '0-0 of 0';
    }
    const first = page.number * page.size + 1;
    return `${first}-${first + page.content.length - 1} of ${page.totalElements}`;
  }

  get hasPreviousPage(): boolean {
    return this.view.kind === 'loaded' && this.applied.page > 0;
  }

  get hasNextPage(): boolean {
    const page = this.page;
    return this.view.kind === 'loaded' && !!page && page.number < page.totalPages - 1;
  }

  ariaSort(field: OwnerSortField): 'ascending' | 'descending' | 'none' {
    if (this.applied.sortField !== field) {
      return 'none';
    }
    return this.applied.sortDirection === 'asc' ? 'ascending' : 'descending';
  }

  sortIndicator(field: OwnerSortField): string {
    if (this.applied.sortField !== field) {
      return '';
    }
    return this.applied.sortDirection === 'asc' ? '▲' : '▼';
  }

  sortBy(field: OwnerSortField) {
    const sameField = this.applied.sortField === field;
    const sortDirection = sameField && this.applied.sortDirection === 'asc' ? 'desc' : 'asc';
    this.go({...this.applied, sortField: field, sortDirection, page: 0});
  }

  changeSize(size: PageSize) {
    this.go({...this.applied, size, page: 0});
  }

  applyFilter() {
    this.go({...this.applied, lastName: this.draftLastName, page: 0});
  }

  clearFilter() {
    this.draftLastName = '';
    this.applyFilter();
  }

  goToPage(page: number) {
    this.go({...this.applied, page});
  }

  get lastPageIndex(): number {
    return Math.max((this.page?.totalPages ?? 1) - 1, 0);
  }

  retry() {
    this.retry$.next();
  }

  onSelect(owner: Owner) {
    this.router.navigate(['/owners', owner.id]);
  }

  addOwner() {
    this.router.navigate(['/owners/add']);
  }

  private apply(query: OwnerQuery) {
    if (query.lastName !== this.applied.lastName) {
      this.draftLastName = query.lastName;
    }
    this.applied = query;
  }

  private go(query: OwnerQuery) {
    this.navigate(toQueryParams(query), false);
  }

  private navigate(queryParams: Record<string, unknown>, replaceUrl: boolean) {
    this.router.navigate([], {relativeTo: this.route, queryParams, replaceUrl});
  }

  /** Errors are caught inside the switched branch, so a failure never ends the route subscription. */
  private load(query: OwnerQuery): Observable<OwnerListView> {
    return this.ownerService.getOwnerPage(query).pipe(
      map((page): OwnerListView => ({kind: 'loaded', page})),
      catchError(error => of<OwnerListView>({kind: 'error', message: String(error)})),
      startWith<OwnerListView>({kind: 'loading'})
    );
  }

  private show(view: OwnerListView) {
    if (view.kind === 'loaded' && this.isBeyondLastPage(view.page)) {
      const lastPage = Math.max(view.page.totalPages - 1, 0);
      this.navigate(toQueryParams({...this.applied, page: lastPage}), true);
      return; // still loading: the replaced URL requests the last page
    }
    this.view = view;
    if (view.kind === 'loaded') {
      this.page = view.page;
    } else if (view.kind === 'error') {
      this.page = undefined;
    }
  }

  private isBeyondLastPage(page: OwnerPage): boolean {
    return page.number > 0 && page.number >= page.totalPages;
  }
}
