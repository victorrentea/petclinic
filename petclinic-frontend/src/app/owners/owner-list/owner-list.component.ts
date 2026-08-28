import {Component, OnDestroy, OnInit} from '@angular/core';
import {OwnerService} from '../owner.service';
import {Owner} from '../owner';
import {OwnerPage} from '../owner-page';
import {ActivatedRoute, Params, Router} from '@angular/router';
import {Subscription} from 'rxjs';
import {finalize} from 'rxjs/operators';

export type OwnerSortKey = 'name' | 'city';
export type SortDirection = 'asc' | 'desc';

const PAGE_SIZES = [5, 10, 20];
const DEFAULT_PAGE_SIZE = 10;
const SORT_KEYS: OwnerSortKey[] = ['name', 'city'];

@Component({
  selector: 'app-owner-list',
  templateUrl: './owner-list.component.html',
  styleUrls: ['./owner-list.component.css']
})
export class OwnerListComponent implements OnInit, OnDestroy {
  readonly pageSizes = PAGE_SIZES;
  errorMessage: string;
  lastName = '';
  owners: Owner[];
  ownerPage: OwnerPage;
  isOwnersDataReceived = false;
  page = 0;
  size = DEFAULT_PAGE_SIZE;
  sortKey: OwnerSortKey = 'name';
  sortDirection: SortDirection = 'asc';

  private queryParams: Subscription;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private ownerService: OwnerService
  ) {
  }

  /** The whole grid state lives in the URL, so Back and a shared link both restore it. */
  ngOnInit() {
    this.queryParams = this.route.queryParams.subscribe(params => this.reloadFrom(params));
  }

  ngOnDestroy() {
    if (this.queryParams) {
      this.queryParams.unsubscribe();
    }
  }

  get sort(): string {
    return this.sortKey + ',' + this.sortDirection;
  }

  get currentPageNumber(): number {
    return this.page + 1;
  }

  get isFirstPage(): boolean {
    return this.page <= 0;
  }

  get isLastPage(): boolean {
    if (!this.ownerPage) {
      return true;
    }
    return this.page >= this.ownerPage.totalPages - 1;
  }

  /** Index of the last page, for the "jump to end" pager button. */
  get lastPageIndex(): number {
    if (!this.ownerPage) {
      return 0;
    }
    return Math.max(0, this.ownerPage.totalPages - 1);
  }

  petNames(owner: Owner): string {
    return (owner.pets || []).map((pet) => pet.name).join(', ');
  }

  isSortedBy(key: OwnerSortKey): boolean {
    return this.sortKey === key;
  }

  sortArrow(key: OwnerSortKey): string {
    // A sortable column that isn't the active sort shows the *same* ascending
    // arrow, just dimmed by CSS — a second, different glyph would read as a
    // different control. Ascending is also what clicking it will actually do.
    if (this.sortKey !== key) {
      return '▲';
    }
    if (this.sortDirection === 'asc') {
      return '▲';
    }
    return '▼';
  }

  toggleSort(key: OwnerSortKey) {
    let direction: SortDirection = 'asc';
    if (this.sortKey === key && this.sortDirection === 'asc') {
      direction = 'desc';
    }
    this.navigate({sort: key + ',' + direction, page: 0});
  }

  goToPage(page: number) {
    this.navigate({page});
  }

  changePageSize(size: number) {
    this.navigate({size, page: 0});
  }

  onPageSizeChange(event: Event) {
    this.changePageSize(Number((event.target as HTMLSelectElement).value));
  }

  searchByLastName(lastName: string) {
    this.navigate({lastName: lastName || '', page: 0});
  }

  onSelect(owner: Owner) {
    this.router.navigate(['/owners', owner.id]);
  }

  addOwner() {
    this.router.navigate(['/owners/add']);
  }

  private reloadFrom(params: Params) {
    this.lastName = params['lastName'] || '';
    this.page = parsePage(params['page']);
    this.size = parseSize(params['size']);
    this.sortKey = parseSortKey(params['sort']);
    this.sortDirection = parseSortDirection(params['sort']);
    this.loadOwners();
  }

  private loadOwners() {
    this.ownerService
      .listOwners({lastName: this.lastName, page: this.page, size: this.size, sort: this.sort})
      .pipe(finalize(() => this.isOwnersDataReceived = true))
      .subscribe(
        ownerPage => this.showPage(ownerPage),
        error => {
          this.owners = null;
          this.errorMessage = error as any;
        });
  }

  /**
   * A deep link the filter shrank away: show page 0 instead of an empty table.
   * Deferred to the next macrotask because this runs while the router is still activating the
   * navigation that delivered these query params, and a nested navigate() would be discarded.
   */
  private showPage(ownerPage: OwnerPage) {
    if (ownerPage.content.length === 0 && ownerPage.number > 0) {
      setTimeout(() => this.navigate({page: 0}, true));
      return;
    }
    this.ownerPage = ownerPage;
    this.owners = ownerPage.content;
  }

  private navigate(changes: Params, replaceUrl = false) {
    const queryParams = {
      lastName: this.lastName,
      page: this.page,
      size: this.size,
      sort: this.sort,
      ...changes
    };
    this.router.navigate([], {relativeTo: this.route, queryParams, replaceUrl});
  }
}

function parsePage(raw: string): number {
  const page = Number(raw);
  if (!Number.isInteger(page) || page < 0) {
    return 0;
  }
  return page;
}

function parseSize(raw: string): number {
  const size = Number(raw);
  if (!PAGE_SIZES.includes(size)) {
    return DEFAULT_PAGE_SIZE;
  }
  return size;
}

function parseSortKey(raw: string): OwnerSortKey {
  const key = (raw || '').split(',')[0].trim().toLowerCase() as OwnerSortKey;
  if (!SORT_KEYS.includes(key)) {
    return 'name';
  }
  return key;
}

function parseSortDirection(raw: string): SortDirection {
  const direction = (raw || '').split(',')[1];
  if (direction && direction.trim().toLowerCase() === 'desc') {
    return 'desc';
  }
  return 'asc';
}
