import {Component, OnDestroy, OnInit} from '@angular/core';
import {ActivatedRoute, ParamMap, Params, Router} from '@angular/router';
import {PageEvent} from '@angular/material/paginator';
import {Sort} from '@angular/material/sort';
import {of, Subject, Subscription} from 'rxjs';
import {catchError, debounceTime, map, switchMap} from 'rxjs/operators';
import {OwnerService} from '../owner.service';
import {OwnerListItem, OwnerPage, OwnerQuery} from '../owner-page';
import {OwnerGridState} from '../owner-grid-state';

const PAGE_SIZES = [5, 10, 20];
const SEARCH_DEBOUNCE_MS = 300;
const DEFAULT_QUERY: OwnerQuery = {lastName: '', page: 0, size: 10, sort: 'name', direction: 'asc'};

// The grid's state lives in the URL query, defaults left out, so Back and refresh return to the
// same view. Every change only navigates; the request is derived from the URL, in one place.
@Component({
  selector: 'app-owner-list',
  templateUrl: './owner-list.component.html',
  styleUrls: ['./owner-list.component.css']
})
export class OwnerListComponent implements OnInit, OnDestroy {
  readonly pageSizes = PAGE_SIZES;
  query: OwnerQuery = DEFAULT_QUERY;
  lastName = '';
  page: OwnerPage;
  failed = false;
  private load: Subscription;
  private readonly typed = new Subject<string>();
  private search: Subscription;

  constructor(private router: Router, private route: ActivatedRoute, private ownerService: OwnerService,
              private gridState: OwnerGridState) {
  }

  ngOnInit() {
    // search as you type: one request once typing pauses, not one per keystroke
    this.search = this.typed.pipe(debounceTime(SEARCH_DEBOUNCE_MS))
      .subscribe(lastName => this.searchByLastName(lastName));
    // switchMap: only the latest query may answer, however late an earlier one lands
    this.load = this.route.queryParamMap.pipe(
      map(toQuery),
      switchMap(query => {
        this.query = query;
        this.lastName = query.lastName;
        this.gridState.url = this.router.url;
        // caught inside, so a failure does not end the grid: the next navigation loads again
        return this.ownerService.listOwners(query).pipe(catchError(() => of(null)));
      })
    ).subscribe(page => page ? this.show(page) : this.fail());
  }

  ngOnDestroy() {
    this.load?.unsubscribe();
    this.search?.unsubscribe();
  }

  onLastNameTyped(lastName: string) {
    this.typed.next(lastName);
  }

  get owners(): OwnerListItem[] {
    return this.page?.content ?? [];
  }

  searchByLastName(lastName: string) {
    if ((lastName ?? '') !== this.query.lastName) {
      this.go({lastName: lastName ?? '', page: 0});
    }
  }

  onPage(event: PageEvent) {
    const sizeChanged = event.pageSize !== this.query.size;
    this.go({size: event.pageSize, page: sizeChanged ? 0 : event.pageIndex});
  }

  onSort(sort: Sort) {
    this.go({sort: sort.active as OwnerQuery['sort'], direction: sort.direction || 'asc', page: 0});
  }

  onSelect(owner: OwnerListItem) {
    this.router.navigate(['/owners', owner.id]);
  }

  addOwner() {
    this.router.navigate(['/owners/add']);
  }

  private fail() {
    this.failed = true;
    this.page = undefined;
  }

  private show(page: OwnerPage) {
    this.failed = false;
    const pastTheEnd = page.content.length === 0 && page.totalElements > 0;
    if (pastTheEnd) { // another user deleted owners meanwhile: the last page still exists
      this.go({page: page.totalPages - 1}, true);
      return;
    }
    this.page = page;
  }

  private go(change: Partial<OwnerQuery>, replaceUrl = false) {
    this.router.navigate([], {relativeTo: this.route, queryParams: toParams({...this.query, ...change}), replaceUrl});
  }
}

function toQuery(params: ParamMap): OwnerQuery {
  const [sort, direction] = (params.get('sort') ?? '').split(',');
  const size = Number(params.get('size'));
  return {
    lastName: params.get('lastName') ?? '',
    page: Math.max(0, (Number(params.get('page')) || 1) - 1), // 1-based for people, 0-based for the API
    size: PAGE_SIZES.includes(size) ? size : DEFAULT_QUERY.size,
    sort: sort === 'city' ? 'city' : 'name',
    direction: direction === 'desc' ? 'desc' : 'asc',
  };
}

function toParams(query: OwnerQuery): Params {
  const params: Params = {};
  if (query.lastName) {
    params.lastName = query.lastName;
  }
  if (query.page > 0) {
    params.page = query.page + 1;
  }
  if (query.size !== DEFAULT_QUERY.size) {
    params.size = query.size;
  }
  if (query.sort !== DEFAULT_QUERY.sort || query.direction !== DEFAULT_QUERY.direction) {
    params.sort = `${query.sort},${query.direction}`;
  }
  return params;
}
