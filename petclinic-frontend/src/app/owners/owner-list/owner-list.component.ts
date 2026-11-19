import {Component, OnDestroy, OnInit} from '@angular/core';
import {OwnerService} from '../owner.service';
import {Owner, OwnerPage, OwnerQuery, OwnerSort} from '../owner';
import {ActivatedRoute, ParamMap, Router} from '@angular/router';
import {Subscription} from 'rxjs';
import {map, switchMap, tap} from 'rxjs/operators';
import {Sort} from '@angular/material/sort';
import {PageEvent} from '@angular/material/paginator';

export const PAGE_SIZES = [5, 10, 20];
const SORTS: OwnerSort[] = ['name,asc', 'name,desc', 'city,asc', 'city,desc'];
const DEFAULT_QUERY: OwnerQuery = {lastName: '', page: 0, size: 10, sort: 'name,asc'};

/** The URL is the only state: anything missing or not allowed falls back to the default. */
export function toOwnerQuery(params: ParamMap): OwnerQuery {
  const page = Number(params.get('page'));
  const size = Number(params.get('size'));
  const sort = params.get('sort') as OwnerSort;
  return {
    lastName: params.get('lastName') ?? DEFAULT_QUERY.lastName,
    page: Number.isInteger(page) && page >= 0 ? page : DEFAULT_QUERY.page,
    size: PAGE_SIZES.includes(size) ? size : DEFAULT_QUERY.size,
    sort: SORTS.includes(sort) ? sort : DEFAULT_QUERY.sort,
  };
}

@Component({
  selector: 'app-owner-list',
  templateUrl: './owner-list.component.html',
  styleUrls: ['./owner-list.component.css']
})
export class OwnerListComponent implements OnInit, OnDestroy {
  readonly pageSizes = PAGE_SIZES;
  readonly columns = ['name', 'address', 'city', 'telephone', 'pets'];
  lastName = '';
  searchedLastName = '';
  query: OwnerQuery = DEFAULT_QUERY;
  ownerPage: OwnerPage;
  private load: Subscription;

  constructor(private router: Router, private route: ActivatedRoute, private ownerService: OwnerService) {
  }

  // switchMap: only the latest query may answer, so a slow earlier page never overwrites a newer one.
  ngOnInit() {
    this.load = this.route.queryParamMap.pipe(
      map(toOwnerQuery),
      tap(query => {
        this.query = query;
        this.lastName = query.lastName;
      }),
      switchMap(query => this.ownerService.listOwners(query)),
    ).subscribe(page => {
      this.ownerPage = page;
      this.searchedLastName = this.query.lastName;
    });
  }

  ngOnDestroy() {
    this.load?.unsubscribe();
  }

  get owners(): Owner[] {
    return this.ownerPage?.content ?? [];
  }

  get sortActive(): string {
    return this.query.sort.split(',')[0];
  }

  get sortDirection(): 'asc' | 'desc' {
    return this.query.sort.split(',')[1] as 'asc' | 'desc';
  }

  onSelect(owner: Owner) {
    this.router.navigate(['/owners', owner.id]);
  }

  addOwner() {
    this.router.navigate(['/owners/add']);
  }

  searchByLastName(lastName: string) {
    this.navigate({lastName: lastName || null, page: 0});
  }

  onSort(sort: Sort) {
    this.navigate({sort: `${sort.active},${sort.direction || 'asc'}`, page: 0});
  }

  // MatPaginator already moved pageIndex so the first owner on screen stays on screen.
  onPage(event: PageEvent) {
    this.navigate({page: event.pageIndex, size: event.pageSize});
  }

  private navigate(queryParams: Record<string, string | number | null>) {
    void this.router.navigate([], {relativeTo: this.route, queryParams, queryParamsHandling: 'merge'});
  }
}
