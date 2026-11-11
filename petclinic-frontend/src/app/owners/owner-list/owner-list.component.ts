import {Component, OnDestroy, OnInit} from '@angular/core';
import {ActivatedRoute, convertToParamMap, ParamMap, Params, Router} from '@angular/router';
import {PageEvent} from '@angular/material/paginator';
import {Sort, SortDirection} from '@angular/material/sort';
import {of, Subscription} from 'rxjs';
import {catchError, map, switchMap, tap} from 'rxjs/operators';
import {OwnerService} from '../owner.service';
import {Owner} from '../owner';
import {OwnerPage, OwnerPageQuery} from '../owner-page';

const PAGE_SIZES = [5, 10, 20];
const DEFAULT_SIZE = 10;
const DEFAULT_SORT = 'name,asc';
const SORT_PATTERN = /^(name|city),(asc|desc)$/;

/** The grid's whole state lives in the URL's query params, so Back restores it. */
function queryFrom(params: ParamMap): OwnerPageQuery {
  const page = Number(params.get('page'));
  const size = Number(params.get('size'));
  const sort = params.get('sort');
  return {
    lastName: params.get('lastName') ?? '',
    page: Number.isInteger(page) && page > 0 ? page : 0,
    size: PAGE_SIZES.includes(size) ? size : DEFAULT_SIZE,
    sort: SORT_PATTERN.test(sort) ? sort : DEFAULT_SORT
  };
}

/** Defaults are left out, so the unfiltered first page stays plain `/owners`. */
function paramsFrom(query: OwnerPageQuery): Params {
  return {
    lastName: query.lastName || null,
    page: query.page || null,
    size: query.size === DEFAULT_SIZE ? null : query.size,
    sort: query.sort === DEFAULT_SORT ? null : query.sort
  };
}

function emptyPage(query: OwnerPageQuery): OwnerPage {
  return {content: [], totalElements: 0, totalPages: 0, number: query.page, size: query.size};
}

@Component({
  selector: 'app-owner-list',
  templateUrl: './owner-list.component.html',
  styleUrls: ['./owner-list.component.css']
})
export class OwnerListComponent implements OnInit, OnDestroy {
  readonly pageSizes = PAGE_SIZES;
  errorMessage: string;
  lastName = '';
  query: OwnerPageQuery = queryFrom(convertToParamMap({}));
  page: OwnerPage;
  private loading: Subscription;

  constructor(private router: Router, private route: ActivatedRoute, private ownerService: OwnerService) {
  }

  get sortField(): string {
    return this.query.sort.split(',')[0];
  }

  get sortDirection(): SortDirection {
    return this.query.sort.split(',')[1] as SortDirection;
  }

  ngOnInit() {
    // switchMap: only the answer to the latest URL may land, however late an older one arrives
    this.loading = this.route.queryParamMap.pipe(
      map(queryFrom),
      tap(query => {
        this.query = query;
        this.lastName = query.lastName;
      }),
      switchMap(query => this.ownerService.getOwnersPage(query).pipe(
        catchError(error => {
          this.errorMessage = error;
          return of(emptyPage(query));
        })))
    ).subscribe(page => this.page = page);
  }

  ngOnDestroy() {
    this.loading?.unsubscribe();
  }

  onSelect(owner: Owner) {
    this.router.navigate(['/owners', owner.id]);
  }

  addOwner() {
    this.router.navigate(['/owners/add']);
  }

  searchByLastName(lastName: string) {
    this.navigateTo({...this.query, lastName, page: 0});
  }

  onPage(event: PageEvent) {
    this.navigateTo({...this.query, page: event.pageIndex, size: event.pageSize});
  }

  onSort(sort: Sort) {
    this.navigateTo({...this.query, sort: `${sort.active},${sort.direction}`, page: 0});
  }

  private navigateTo(query: OwnerPageQuery) {
    this.router.navigate([], {relativeTo: this.route, queryParams: paramsFrom(query), replaceUrl: true});
  }
}
