import {Component, OnDestroy, OnInit} from '@angular/core';
import {ActivatedRoute, ParamMap, Params, Router} from '@angular/router';
import {Sort, SortDirection} from '@angular/material/sort';
import {EMPTY, Subscription} from 'rxjs';
import {catchError, map, switchMap, tap} from 'rxjs/operators';
import {OwnerService} from '../owner.service';
import {Owner} from '../owner';
import {OwnerPage, OwnerQuery} from '../owner-page';
import {petTypeEmoji} from '../../pets/pet-type-emoji';
import {PageRequest} from '../owner-pager/owner-pager.component';

// The URL is the only source of the grid's state: the paginator, the sort headers and the search
// form only navigate, and every change of the query parameters reloads the page from the server.
@Component({
  selector: 'app-owner-list',
  templateUrl: './owner-list.component.html',
  styleUrls: ['./owner-list.component.css']
})
export class OwnerListComponent implements OnInit, OnDestroy {
  readonly pageSizeOptions = [5, 10, 20];
  readonly emojiOf = petTypeEmoji;
  lastName = '';
  searchedLastName = '';
  sortActive = 'name';
  sortDirection: SortDirection = 'asc';
  owners: Owner[];
  page: OwnerPage['page'];
  errorMessage: string;
  private subscription: Subscription;

  constructor(private readonly router: Router, private readonly route: ActivatedRoute,
              private readonly ownerService: OwnerService) {
  }

  ngOnInit() {
    this.subscription = this.route.queryParamMap.pipe(
      map(toQuery),
      tap(query => this.showQuery(query)),
      // switchMap drops the answer of a request a newer URL has made stale
      switchMap(query => this.ownerService.getOwners(query).pipe(
        catchError(error => {
          this.errorMessage = error;
          return EMPTY;
        })))
    ).subscribe(result => this.showResult(result));
  }

  ngOnDestroy() {
    this.subscription?.unsubscribe();
  }

  addOwner() {
    void this.router.navigate(['/owners/add']);
  }

  searchByLastName(lastName: string) {
    this.navigate({lastName: lastName || null, page: toUrlPage(0)});
  }

  onSort(sort: Sort) {
    this.navigate({sort: `${sort.active},${sort.direction}`, page: toUrlPage(0)});
  }

  onPage({pageIndex, pageSize}: PageRequest) {
    this.navigate({page: toUrlPage(pageIndex), size: pageSize});
  }

  isSorted(column: string, direction: SortDirection): boolean {
    return this.sortActive === column && this.sortDirection === direction;
  }

  private showQuery(query: OwnerQuery) {
    const [active, direction] = (query.sort ?? 'name,asc').split(',');
    this.sortActive = active;
    this.sortDirection = direction === 'desc' ? 'desc' : 'asc';
    this.lastName = this.searchedLastName = query.lastName ?? '';
  }

  private showResult({content, page}: OwnerPage) {
    const pastTheEnd = content.length === 0 && page.totalElements > 0 && page.number >= page.totalPages;
    if (pastTheEnd) {
      this.navigate({page: toUrlPage(page.totalPages - 1)}, true);
      return;
    }
    this.errorMessage = null;
    this.owners = content;
    this.page = page;
  }

  private navigate(queryParams: Params, replaceUrl = false) {
    void this.router.navigate([], {queryParams, queryParamsHandling: 'merge', replaceUrl});
  }
}

// Only what the URL says is sent: the server owns the defaults (first page, 10 rows, by name).
function toQuery(params: ParamMap): OwnerQuery {
  const query: OwnerQuery = {};
  // a page or size that is not a number is left to the server's default
  const page = Number(params.get('page'));
  if (params.has('page') && Number.isFinite(page)) {
    query.page = fromUrlPage(page);
  }
  const size = Number(params.get('size'));
  if (params.has('size') && Number.isFinite(size)) {
    query.size = size;
  }
  for (const name of ['sort', 'lastName']) {
    if (params.has(name)) {
      query[name] = params.get(name);
    }
  }
  return query;
}

// people count pages from 1, so the URL does; the API counts them from 0
function toUrlPage(pageIndex: number): number {
  return pageIndex + 1;
}

function fromUrlPage(urlPage: number): number {
  return Math.max(urlPage - 1, 0);
}
