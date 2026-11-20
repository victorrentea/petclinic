import {Component, OnInit} from '@angular/core';
import {ActivatedRoute, ParamMap, Params, Router} from '@angular/router';
import {PageEvent} from '@angular/material/paginator';
import {Sort, SortDirection} from '@angular/material/sort';
import {EMPTY} from 'rxjs';
import {catchError, map, switchMap, tap} from 'rxjs/operators';
import {OwnerService} from '../owner.service';
import {OwnerPage, OwnerQuery} from '../owner-page';

const PAGE_SIZES = [5, 10, 20];
const SORTS = ['name,asc', 'name,desc', 'city,asc', 'city,desc'];
const DEFAULT_QUERY: OwnerQuery = {lastName: '', page: 0, size: 10, sort: 'name,asc'};

function toOwnerQuery(params: ParamMap): OwnerQuery {
  const page = Number(params.get('page'));
  const size = Number(params.get('size'));
  const sort = params.get('sort');
  return {
    lastName: params.get('lastName') ?? DEFAULT_QUERY.lastName,
    page: Number.isInteger(page) && page >= 0 ? page : DEFAULT_QUERY.page,
    size: PAGE_SIZES.includes(size) ? size : DEFAULT_QUERY.size,
    sort: SORTS.includes(sort) ? sort : DEFAULT_QUERY.sort
  };
}

@Component({
  selector: 'app-owner-list',
  templateUrl: './owner-list.component.html',
  styleUrls: ['./owner-list.component.css']
})
export class OwnerListComponent implements OnInit {
  readonly pageSizes = PAGE_SIZES;
  readonly columns = ['name', 'address', 'city', 'telephone', 'pets'];
  query: OwnerQuery = DEFAULT_QUERY;
  lastName = '';
  ownerPage: OwnerPage;
  errorMessage: string;

  constructor(private router: Router, private route: ActivatedRoute, private ownerService: OwnerService) {
  }

  ngOnInit() {
    this.route.queryParamMap.pipe(
      map(toOwnerQuery),
      tap(query => this.startLoading(query)),
      switchMap(query => this.ownerService.getOwners(query).pipe(
        catchError(error => {
          this.ownerPage = null;
          this.errorMessage = error;
          return EMPTY;
        })))
    ).subscribe(ownerPage => this.ownerPage = ownerPage);
  }

  get hasOwners(): boolean {
    return this.ownerPage?.totalElements > 0;
  }

  get isEmpty(): boolean {
    return this.ownerPage?.totalElements === 0;
  }

  get sortActive(): string {
    return this.query.sort.split(',')[0];
  }

  get sortDirection(): SortDirection {
    return this.query.sort.split(',')[1] as SortDirection;
  }

  searchByLastName(lastName: string) {
    this.navigate({lastName: lastName || null, page: 0});
  }

  onSortChange(sort: Sort) {
    this.navigate({sort: sort.active + ',' + sort.direction, page: 0});
  }

  onPage(event: PageEvent) {
    this.navigate({page: event.pageIndex, size: event.pageSize});
  }

  addOwner() {
    this.router.navigate(['/owners/add']);
  }

  private startLoading(query: OwnerQuery) {
    this.query = query;
    this.lastName = query.lastName;
    this.errorMessage = null;
  }

  private navigate(queryParams: Params) {
    this.router.navigate([], {relativeTo: this.route, queryParams, queryParamsHandling: 'merge'});
  }
}
