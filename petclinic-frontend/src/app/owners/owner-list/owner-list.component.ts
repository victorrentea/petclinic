import {Component, OnDestroy, OnInit} from '@angular/core';
import {OwnerService} from '../owner.service';
import {Owner} from '../owner';
import {OwnerPage, OwnerSort, PageSize} from '../owner-page';
import {ActivatedRoute, ParamMap, Params, Router} from '@angular/router';
import {Subscription} from 'rxjs';

export type SortColumn = 'name' | 'city';

/** The list state as the URL carries it: `page` is 1-based, as the user reads it. */
export interface OwnerListQuery {
  lastName: string;
  page: number;
  size: PageSize;
  sort: OwnerSort;
}

export const PAGE_SIZES: PageSize[] = [5, 10, 20];
const SORTS: OwnerSort[] = ['name,asc', 'name,desc', 'city,asc', 'city,desc'];
const DEFAULT_QUERY: OwnerListQuery = {lastName: '', page: 1, size: 10, sort: 'name,asc'};

@Component({
  selector: 'app-owner-list',
  templateUrl: './owner-list.component.html',
  styleUrls: ['./owner-list.component.css']
})
export class OwnerListComponent implements OnInit, OnDestroy {
  readonly pageSizes = PAGE_SIZES;
  lastName = '';
  query: OwnerListQuery = DEFAULT_QUERY;
  ownerPage: OwnerPage | null = null;
  loadFailed = false;
  private routeSubscription: Subscription;
  private load: Subscription;

  constructor(private router: Router, private route: ActivatedRoute, private ownerService: OwnerService) {
  }

  ngOnInit() {
    this.routeSubscription = this.route.queryParamMap.subscribe(params => this.onUrlChange(params));
  }

  ngOnDestroy() {
    this.routeSubscription?.unsubscribe();
    this.load?.unsubscribe();
  }

  onSelect(owner: Owner) {
    this.router.navigate(['/owners', owner.id]);
  }

  addOwner() {
    this.router.navigate(['/owners/add']);
  }

  searchByLastName(lastName: string) {
    this.show({...this.query, lastName: lastName ?? '', page: 1});
  }

  sortBy(column: SortColumn) {
    const direction = this.sortColumn === column && this.sortDirection === 'asc' ? 'desc' : 'asc';
    this.show({...this.query, sort: `${column},${direction}` as OwnerSort, page: 1});
  }

  changePageSize(size: PageSize) {
    this.show({...this.query, size, page: 1});
  }

  goToPage(page: number) {
    this.show({...this.query, page});
  }

  get sortColumn(): SortColumn {
    return this.query.sort.split(',')[0] as SortColumn;
  }

  get sortDirection(): 'asc' | 'desc' {
    return this.query.sort.split(',')[1] as 'asc' | 'desc';
  }

  ariaSort(column: SortColumn): 'ascending' | 'descending' | null {
    if (this.sortColumn !== column) {
      return null;
    }
    return this.sortDirection === 'asc' ? 'ascending' : 'descending';
  }

  get lastPage(): number {
    return Math.max(1, this.ownerPage?.totalPages ?? 1);
  }

  get firstRowNumber(): number {
    return (this.query.page - 1) * this.query.size + 1;
  }

  get lastRowNumber(): number {
    return this.firstRowNumber + (this.ownerPage?.content.length ?? 0) - 1;
  }

  private onUrlChange(params: ParamMap) {
    const query = parseQuery(params);
    if (!sameParams(params, toUrlParams(query))) {
      this.navigate(query);
      return;
    }
    this.query = query;
    this.lastName = query.lastName;
    this.fetch(query);
  }

  // Only the latest query may answer: a slower earlier response must not overwrite a newer one.
  private fetch(query: OwnerListQuery) {
    this.load?.unsubscribe();
    const apiQuery = {lastName: query.lastName, page: query.page - 1, size: query.size, sort: query.sort};
    this.load = this.ownerService.getOwnerPage(apiQuery).subscribe({
      next: page => {
        const lastPage = Math.max(1, page.totalPages);
        if (query.page > lastPage) {
          this.navigate({...query, page: lastPage});
          return;
        }
        this.ownerPage = page;
        this.loadFailed = false;
      },
      error: () => {
        this.ownerPage = null;
        this.loadFailed = true;
      }
    });
  }

  private show(query: OwnerListQuery) {
    if (sameParams(this.route.snapshot.queryParamMap, toUrlParams(query))) {
      this.fetch(query); // same URL: the router would not emit, but a repeated Find is a retry
    } else {
      this.navigate(query);
    }
  }

  private navigate(query: OwnerListQuery) {
    this.router.navigate([], {relativeTo: this.route, queryParams: toUrlParams(query), replaceUrl: true});
  }
}

function parseQuery(params: ParamMap): OwnerListQuery {
  const page = Number(params.get('page'));
  const size = Number(params.get('size')) as PageSize;
  const sort = params.get('sort') as OwnerSort;
  return {
    lastName: params.get('lastName') ?? DEFAULT_QUERY.lastName,
    page: Number.isInteger(page) && page >= 1 ? page : DEFAULT_QUERY.page,
    size: PAGE_SIZES.includes(size) ? size : DEFAULT_QUERY.size,
    sort: SORTS.includes(sort) ? sort : DEFAULT_QUERY.sort
  };
}

/** Defaults are left out, so a plain /owners stays plain. */
function toUrlParams(query: OwnerListQuery): Params {
  const params: Params = {};
  for (const key of Object.keys(DEFAULT_QUERY) as (keyof OwnerListQuery)[]) {
    if (query[key] !== DEFAULT_QUERY[key]) {
      params[key] = String(query[key]);
    }
  }
  return params;
}

function sameParams(actual: ParamMap, expected: Params): boolean {
  return actual.keys.length === Object.keys(expected).length
    && actual.keys.every(key => actual.getAll(key).length === 1 && actual.get(key) === expected[key]);
}
