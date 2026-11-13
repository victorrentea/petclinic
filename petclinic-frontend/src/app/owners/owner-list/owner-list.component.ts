import {Component, OnDestroy, OnInit} from '@angular/core';
import {OwnerQuery, OwnerService} from '../owner.service';
import {Owner} from '../owner';
import {OwnerPage} from '../owner-page';
import {ActivatedRoute, ParamMap, Params, Router} from '@angular/router';
import {Subscription} from 'rxjs';
import {map, switchMap, tap} from 'rxjs/operators';
import {PageEvent} from '@angular/material/paginator';
import {Sort, SortDirection} from '@angular/material/sort';

export const PAGE_SIZES = [5, 10, 20];
const SORT_KEYS = ['name', 'city'];
const DEFAULT_QUERY: OwnerQuery = {lastName: '', page: 1, size: 10, sort: 'name,asc'};

/** The URL is the grid's only state: Back from an owner, a reload or a shared link reopen the same page. */
@Component({
  selector: 'app-owner-list',
  templateUrl: './owner-list.component.html',
  styleUrls: ['./owner-list.component.css']
})
export class OwnerListComponent implements OnInit, OnDestroy {
  readonly pageSizes = PAGE_SIZES;
  lastName = '';
  query: OwnerQuery = DEFAULT_QUERY;
  page: OwnerPage;
  owners: Owner[];
  isOwnersDataReceived = false;
  private load: Subscription;

  constructor(private router: Router, private route: ActivatedRoute, private ownerService: OwnerService) {
  }

  get sortKey(): string {
    return this.query.sort.split(',')[0];
  }

  get sortDirection(): SortDirection {
    return this.query.sort.split(',')[1] as SortDirection;
  }

  // switchMap: only the latest query may answer, so a slow earlier page can't overwrite a newer one
  ngOnInit() {
    this.load = this.route.queryParamMap.pipe(
      map(toQuery),
      tap(query => {
        this.query = query;
        this.lastName = query.lastName;
      }),
      switchMap(query => this.ownerService.getOwnerPage(query))
    ).subscribe(page => this.show(page));
  }

  ngOnDestroy() {
    this.load?.unsubscribe();
  }

  searchByLastName(lastName: string) {
    this.navigate({lastName: lastName || null, page: null});
  }

  sortBy(sort: Sort) {
    this.navigate({sort: sort.direction ? `${sort.active},${sort.direction}` : null, page: null});
  }

  changePage(event: PageEvent) {
    if (event.pageSize !== this.query.size) {
      this.navigate({size: event.pageSize, page: null});
    } else {
      this.navigate({page: event.pageIndex + 1});
    }
  }

  /** On one line, so every row keeps the same height whatever the number of pets. */
  petNames(owner: Owner): string {
    return owner.pets.map(pet => pet.name).join(', ');
  }

  onSelect(owner: Owner) {
    this.router.navigate(['/owners', owner.id]);
  }

  addOwner() {
    this.router.navigate(['/owners/add']);
  }

  // A page past the end (a stale link, owners deleted since) shows the last page instead
  private show(page: OwnerPage) {
    if (page.content.length === 0 && page.totalPages > 0) {
      this.navigate({page: page.totalPages}, true);
      return;
    }
    this.page = page;
    this.owners = page.content;
    this.isOwnersDataReceived = true;
  }

  private navigate(queryParams: Params, replaceUrl = false) {
    // Fire and forget: the queryParamMap subscription in ngOnInit reacts to the new URL
    void this.router.navigate([], {relativeTo: this.route, queryParams, queryParamsHandling: 'merge', replaceUrl});
  }
}

function toQuery(params: ParamMap): OwnerQuery {
  const page = Number(params.get('page'));
  const size = Number(params.get('size'));
  const sort = params.get('sort') ?? '';
  const [sortKey, direction = 'asc'] = sort.split(',');
  return {
    lastName: params.get('lastName') ?? DEFAULT_QUERY.lastName,
    page: Number.isInteger(page) && page >= 1 ? page : DEFAULT_QUERY.page,
    size: PAGE_SIZES.includes(size) ? size : DEFAULT_QUERY.size,
    sort: SORT_KEYS.includes(sortKey) && ['asc', 'desc'].includes(direction)
      ? `${sortKey},${direction}` : DEFAULT_QUERY.sort
  };
}
