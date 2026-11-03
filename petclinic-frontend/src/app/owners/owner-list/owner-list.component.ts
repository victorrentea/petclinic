import {Component, OnDestroy, OnInit} from '@angular/core';
import {ActivatedRoute, ParamMap, Router} from '@angular/router';
import {PageEvent} from '@angular/material/paginator';
import {Sort, SortDirection} from '@angular/material/sort';
import {of, Subject} from 'rxjs';
import {catchError, map, switchMap, takeUntil, tap} from 'rxjs/operators';
import {OwnerService} from '../owner.service';
import {Owner} from '../owner';
import {OwnerPage, OwnerQuery} from '../owner-page';

const DEFAULT_SIZE = 10;
const DEFAULT_SORT = 'name,asc';

@Component({
  selector: 'app-owner-list',
  templateUrl: './owner-list.component.html',
  styleUrls: ['./owner-list.component.css']
})
export class OwnerListComponent implements OnInit, OnDestroy {
  readonly pageSizeOptions = [5, 10, 20];
  lastName = '';
  owners: Owner[] = [];
  totalElements = 0;
  pageIndex = 0;
  size = DEFAULT_SIZE;
  sortKey = 'name';
  sortDirection: SortDirection = 'asc';
  isOwnersDataReceived = false;
  private readonly destroyed$ = new Subject<void>();

  constructor(private router: Router,
              private route: ActivatedRoute,
              private ownerService: OwnerService) {
  }

  // The URL is the single source of truth: events only change it, and a change of the URL
  // (typed, refreshed, or reached with Back) loads the page. switchMap keeps only the
  // answer to the latest query.
  ngOnInit() {
    this.route.queryParamMap.pipe(
      map(params => this.toQuery(params)),
      tap(query => this.lastName = query.lastName), // not on the answer: it would erase what is being typed
      switchMap(query => this.ownerService.getOwners(query).pipe(
        map(page => ({query, page})),
        catchError(() => of({query, page: null as OwnerPage})))),
      takeUntil(this.destroyed$)
    ).subscribe(({query, page}) => this.show(query, page));
  }

  ngOnDestroy() {
    this.destroyed$.next();
    this.destroyed$.complete();
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
    this.navigate({sort: `${sort.active},${sort.direction}`, page: 0});
  }

  onPage(event: PageEvent) {
    if (event.pageSize !== this.size) {
      this.navigate({size: event.pageSize, page: 0});
    } else {
      this.navigate({page: event.pageIndex});
    }
  }

  private navigate(queryParams: {[name: string]: string | number | null}, replaceUrl = false) {
    void this.router.navigate([], {relativeTo: this.route, queryParams, queryParamsHandling: 'merge', replaceUrl});
  }

  private toQuery(params: ParamMap): OwnerQuery {
    const page = Number(params.get('page'));
    const size = Number(params.get('size'));
    const sort = params.get('sort');
    return {
      page: Number.isInteger(page) && page > 0 ? page : 0,
      size: this.pageSizeOptions.includes(size) ? size : DEFAULT_SIZE,
      sort: sort && /^(name|city),(asc|desc)$/.test(sort) ? sort : DEFAULT_SORT,
      lastName: params.get('lastName') || ''
    };
  }

  private show(query: OwnerQuery, page: OwnerPage | null) {
    if (!page) {
      this.owners = [];
      this.totalElements = 0;
      this.isOwnersDataReceived = true;
      return;
    }
    const lastExistingPage = Math.max(page.totalPages - 1, 0);
    if (query.page > lastExistingPage) {
      this.navigate({page: lastExistingPage}, true);
      return;
    }
    const [sortKey, sortDirection] = query.sort.split(',');
    this.sortKey = sortKey;
    this.sortDirection = sortDirection as SortDirection;
    this.size = query.size;
    this.pageIndex = page.number;
    this.owners = page.content;
    this.totalElements = page.totalElements;
    this.isOwnersDataReceived = true;
  }
}
