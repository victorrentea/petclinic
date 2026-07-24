import {Component, OnInit} from '@angular/core';
import {OwnerService} from '../owner.service';
import {Owner} from '../owner';
import {
  DEFAULT_OWNER_QUERY,
  EMPTY_OWNER_PAGE,
  OWNER_PAGE_SIZE_OPTIONS,
  OwnerPage,
  OwnerQuery,
  OwnerSortColumn
} from '../owner-page';
import {ActivatedRoute, Params, Router} from '@angular/router';
import {of} from 'rxjs';
import {catchError, finalize, switchMap} from 'rxjs/operators';

@Component({
  selector: 'app-owner-list',
  templateUrl: './owner-list.component.html',
  styleUrls: ['./owner-list.component.css']
})
export class OwnerListComponent implements OnInit {
  readonly pageSizeOptions = OWNER_PAGE_SIZE_OPTIONS;

  errorMessage: string;
  /** The current list state, always a projection of the URL query params — never mutated directly. */
  query: OwnerQuery = DEFAULT_OWNER_QUERY;
  page: OwnerPage = EMPTY_OWNER_PAGE;
  /** bound to the search box; it only becomes state once the user submits and the URL changes */
  lastName = DEFAULT_OWNER_QUERY.lastName;
  isOwnersDataReceived = false;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private ownerService: OwnerService
  ) {
  }

  /**
   * The URL is the single source of truth: every sort/page/size/filter action navigates, and it is
   * the resulting query params that trigger the reload. Back/forward, refresh and deep links then
   * work with no extra code.
   */
  ngOnInit() {
    this.route.queryParams.pipe(
      // switchMap cancels the in-flight request when a newer navigation arrives, so a slow earlier
      // response can never overwrite a newer page — the rows always match the URL
      switchMap((params) => {
        this.query = this.toQuery(params);
        this.lastName = this.query.lastName;
        this.errorMessage = undefined;
        return this.ownerService.getOwners(this.query).pipe(
          // catch INSIDE switchMap so one failed load surfaces as an error but does not terminate
          // the queryParams stream — the next navigation must still reload
          catchError(() => {
            this.errorMessage = 'Could not load owners. Please try again.';
            return of(EMPTY_OWNER_PAGE);
          }),
          finalize(() => this.isOwnersDataReceived = true)
        );
      })
    ).subscribe((page) => this.page = page);
  }

  get owners(): Owner[] {
    return this.page.content;
  }

  /** True when the result set has at least one owner somewhere — not necessarily on this page. */
  get hasResults(): boolean {
    return this.page.totalElements > 0;
  }

  get totalPages(): number {
    return this.page.totalPages;
  }

  get hasPreviousPage(): boolean {
    return this.query.page > 0;
  }

  get hasNextPage(): boolean {
    return this.query.page + 1 < this.page.totalPages;
  }

  isSortedBy(column: OwnerSortColumn): boolean {
    return this.query.sort === column;
  }

  /** Clicking the active column reverses it; clicking another column starts it ascending. */
  sortBy(column: OwnerSortColumn) {
    const direction = this.isSortedBy(column) && this.query.direction === 'asc' ? 'desc' : 'asc';
    this.navigateWith({sort: column, direction});
  }

  changePageSize(size: string) {
    this.navigateWith({size: Number(size)});
  }

  goToPage(page: number) {
    this.navigateWith({page});
  }

  searchByLastName(lastName: string) {
    this.navigateWith({lastName: lastName || null});
  }

  onSelect(owner: Owner) {
    this.router.navigate(['/owners', owner.id]);
  }

  addOwner() {
    this.router.navigate(['/owners/add']);
  }

  /**
   * The one place the "back to the first page" rule lives (D16): anything other than the pager
   * changes the shape of the result, so the row that was at the current page position is no longer
   * there — the page index is meaningless and is dropped back to the default 0. Expressing it here
   * rather than at each of the four call sites is what keeps it a rule instead of four coincidences.
   */
  private navigateWith(changed: Params) {
    const queryParams = 'page' in changed ? changed : {...changed, page: DEFAULT_OWNER_QUERY.page};
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge'
    });
  }

  private toQuery(params: Params): OwnerQuery {
    return {
      page: this.toPageIndex(params['page']),
      size: this.toPageSize(params['size']),
      // only the two columns the server agrees to sort on are honoured; anything else falls back
      sort: params['sort'] === 'city' ? 'city' : DEFAULT_OWNER_QUERY.sort,
      direction: params['direction'] === 'desc' ? 'desc' : DEFAULT_OWNER_QUERY.direction,
      lastName: params['lastName'] || DEFAULT_OWNER_QUERY.lastName
    };
  }

  /** A page index must be a whole number ≥ 0; anything else (0.5, "abc", -1) falls back to 0. */
  private toPageIndex(value: unknown): number {
    const parsed = Number(value);
    return value !== undefined && Number.isInteger(parsed) && parsed >= 0
      ? parsed : DEFAULT_OWNER_QUERY.page;
  }

  /**
   * The size must be one the UI actually offers, or the "Rows per page" select — bound to
   * query.size — would match no option and silently desync from the rows the server returned for a
   * value it clamped (e.g. ?size=0 or ?size=99999).
   */
  private toPageSize(value: unknown): number {
    const parsed = Number(value);
    return this.pageSizeOptions.includes(parsed) ? parsed : DEFAULT_OWNER_QUERY.size;
  }
}
