import {Component, OnDestroy, OnInit} from '@angular/core';
import {ActivatedRoute, ParamMap, Router} from '@angular/router';
import {PageEvent} from '@angular/material/paginator';
import {Sort, SortDirection} from '@angular/material/sort';
import {EMPTY, Subscription} from 'rxjs';
import {catchError, map, switchMap, tap} from 'rxjs/operators';
import {OwnerService} from '../owner.service';
import {OwnerPage, OwnerQuery} from '../owner-page';
import {PageLink, pageLinks} from './page-links';

const DEFAULT_SIZE = 10;
const DEFAULT_SORT = 'name';

@Component({
  selector: 'app-owner-list',
  templateUrl: './owner-list.component.html',
  styleUrls: ['./owner-list.component.css']
})
export class OwnerListComponent implements OnInit, OnDestroy {
  readonly pageSizes = [5, 10, 20];
  errorMessage: string;
  lastName = '';
  query: OwnerQuery = {};
  page: OwnerPage;
  private load: Subscription;

  constructor(private router: Router, private route: ActivatedRoute, private ownerService: OwnerService) {
  }

  // The URL holds the query, so Back, refresh and a shared link show the same owners.
  // switchMap drops the answer to a query the URL has already moved past.
  ngOnInit() {
    this.load = this.route.queryParamMap.pipe(
      map(toQuery),
      tap(query => this.show(query)),
      switchMap(query => this.ownerService.listOwners(query).pipe(
        catchError(message => {
          this.errorMessage = message;
          return EMPTY;
        })))
    ).subscribe(page => this.page = page);
  }

  ngOnDestroy() {
    this.load?.unsubscribe();
  }

  get pageIndex(): number {
    return this.query.page ?? 0;
  }

  get pageSize(): number {
    return this.query.size ?? DEFAULT_SIZE;
  }

  get pageLinks(): PageLink[] {
    const lastPage = Math.max(1, Math.ceil(this.page.totalElements / this.pageSize));
    return pageLinks(this.pageIndex + 1, lastPage);
  }

  get sortField(): string {
    return (this.query.sort ?? DEFAULT_SORT).split(',')[0];
  }

  get sortDirection(): SortDirection {
    return this.query.sort?.endsWith(',desc') ? 'desc' : 'asc';
  }

  searchByLastName(lastName: string) {
    this.navigate({...this.query, page: undefined, lastName: lastName || undefined});
  }

  sortBy(sort: Sort) {
    const sortParam = sort.direction === 'desc' ? `${sort.active},desc` : sort.active;
    this.navigate({...this.query, page: undefined, sort: sortParam === DEFAULT_SORT ? undefined : sortParam});
  }

  // a new page size restarts from page 1: page 3 of another size is an arbitrary slice
  changePage(event: PageEvent) {
    if (event.pageSize !== this.pageSize) {
      const size = event.pageSize === DEFAULT_SIZE ? undefined : event.pageSize;
      this.navigate({...this.query, page: undefined, size});
    } else {
      this.navigate({...this.query, page: event.pageIndex || undefined});
    }
  }

  goToPage(link: PageLink) {
    if (link !== '…') {
      this.navigate({...this.query, page: link - 1 || undefined});
    }
  }

  addOwner() {
    this.router.navigate(['/owners/add']);
  }

  private show(query: OwnerQuery) {
    this.query = query;
    this.lastName = query.lastName ?? '';
    this.errorMessage = null;
  }

  private navigate(query: OwnerQuery) {
    void this.router.navigate([], {relativeTo: this.route, queryParams: withoutUndefined(query)});
  }
}

function toQuery(params: ParamMap): OwnerQuery {
  const number = (name: string) => params.has(name) ? Number(params.get(name)) : undefined;
  return withoutUndefined({
    page: number('page'),
    size: number('size'),
    sort: params.get('sort') ?? undefined,
    lastName: params.get('lastName') ?? undefined,
  });
}

function withoutUndefined(query: OwnerQuery): OwnerQuery {
  return Object.keys(query)
    .filter(key => query[key] !== undefined)
    .reduce((kept, key) => ({...kept, [key]: query[key]}), {});
}
