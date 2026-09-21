import {Component, OnInit} from '@angular/core';
import {ActivatedRoute, Params, Router} from '@angular/router';
import {finalize} from 'rxjs/operators';
import {OwnerService} from '../owner.service';
import {Owner, OwnerPage} from '../owner';

/** The only two columns the server will sort on. */
export type OwnerSortKey = 'name' | 'city';
export type SortDirection = 'asc' | 'desc';

const DEFAULT_SIZE = 10;
const SORT_KEYS: OwnerSortKey[] = ['name', 'city'];

/**
 * The grid holds no state of its own: filter, page, size and sort live in the URL, every
 * control navigates, and the fetch happens in reaction to `queryParamMap`. One source of
 * truth, so a deep link, the back button and a click on a header all go through one path.
 */
@Component({
  selector: 'app-owner-list',
  templateUrl: './owner-list.component.html',
  styleUrls: ['./owner-list.component.css']
})
export class OwnerListComponent implements OnInit {
  readonly pageSizes = [5, 10, 20];

  errorMessage: string;
  /** Bound to the search box — reaches the URL only when Find Owner is pressed. */
  lastName = '';
  /** The filter the shown result was fetched with, i.e. what the URL says. */
  appliedLastName = '';
  pageIndex = 0;
  size = DEFAULT_SIZE;
  sortKey: OwnerSortKey = 'name';
  sortDirection: SortDirection = 'asc';
  ownerPage: OwnerPage = null;
  isOwnersDataReceived = false;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private ownerService: OwnerService
  ) {
  }

  ngOnInit() {
    this.route.queryParamMap.subscribe(params => {
      this.appliedLastName = params.get('lastName') || '';
      this.lastName = this.appliedLastName;
      this.pageIndex = this.readPageIndex(params.get('page'));
      this.size = this.readSize(params.get('size'));
      this.readSort(params.get('sort'));
      this.load();
    });
  }

  get owners(): Owner[] {
    return this.ownerPage ? this.ownerPage.content : [];
  }

  get sort(): string {
    return this.sortKey + ',' + this.sortDirection;
  }

  get totalPages(): number {
    return this.ownerPage && this.ownerPage.totalPages > 0 ? this.ownerPage.totalPages : 1;
  }

  get isFirstPage(): boolean {
    return this.pageIndex <= 0;
  }

  get isLastPage(): boolean {
    return this.pageIndex >= this.totalPages - 1;
  }

  /** 'ascending' / 'descending' / 'none', as `aria-sort` wants it. */
  ariaSort(key: OwnerSortKey): string {
    if (this.sortKey !== key) {
      return 'none';
    }
    return this.sortDirection === 'asc' ? 'ascending' : 'descending';
  }

  sortIndicator(key: OwnerSortKey): string {
    if (this.sortKey !== key) {
      return '';
    }
    return this.sortDirection === 'asc' ? '▲' : '▼';
  }

  /** Clicking the active column flips the direction; any other column starts ascending. */
  sortBy(key: OwnerSortKey) {
    const direction: SortDirection =
      this.sortKey === key && this.sortDirection === 'asc' ? 'desc' : 'asc';
    this.navigateTo({sort: key + ',' + direction, page: 0});
  }

  /** A new filter means a new result set, so page 3 of the old one is meaningless. */
  searchByLastName(lastName: string) {
    this.navigateTo({lastName: lastName || '', page: 0});
  }

  goToPage(pageIndex: number) {
    this.navigateTo({page: pageIndex});
  }

  changeSize(size: number) {
    if (size === this.size) {
      return;
    }
    this.navigateTo({size, page: 0});
  }

  onSelect(owner: Owner) {
    this.router.navigate(['/owners', owner.id]);
  }

  addOwner() {
    this.router.navigate(['/owners/add']);
  }

  private load() {
    this.ownerService
      .listOwners({lastName: this.appliedLastName, page: this.pageIndex, size: this.size, sort: this.sort})
      .pipe(finalize(() => this.isOwnersDataReceived = true))
      .subscribe(
        page => this.ownerPage = page,
        error => {
          this.ownerPage = null;
          this.errorMessage = error as any;
        });
  }

  private navigateTo(changes: Params) {
    const queryParams: Params = {
      lastName: this.appliedLastName,
      page: this.pageIndex,
      size: this.size,
      sort: this.sort,
      ...changes
    };
    this.router.navigate([], {relativeTo: this.route, queryParams});
  }

  private readPageIndex(raw: string): number {
    const page = Number(raw);
    return Number.isInteger(page) && page >= 0 ? page : 0;
  }

  private readSize(raw: string): number {
    const size = Number(raw);
    return this.pageSizes.includes(size) ? size : DEFAULT_SIZE;
  }

  private readSort(raw: string) {
    const [key, direction] = (raw || '').split(',');
    this.sortKey = SORT_KEYS.includes(key as OwnerSortKey) ? key as OwnerSortKey : 'name';
    this.sortDirection = direction === 'desc' ? 'desc' : 'asc';
  }
}
