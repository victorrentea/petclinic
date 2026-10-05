import {Component, OnDestroy, OnInit} from '@angular/core';
import {OwnerService} from '../owner.service';
import {Owner, OwnerPage, OwnerPageQuery} from '../owner';
import {ActivatedRoute, ParamMap, Router} from '@angular/router';
import {of, Subscription} from 'rxjs';
import {catchError, map, switchMap, tap} from 'rxjs/operators';
import {Sort} from '@angular/material/sort';
import {PageEvent} from '@angular/material/paginator';

const PAGE_SIZES = [5, 10, 20];
const DEFAULT_QUERY: OwnerPageQuery = {lastName: '', sort: 'name', dir: 'asc', page: 0, size: 10};

@Component({
  selector: 'app-owner-list',
  templateUrl: './owner-list.component.html',
  styleUrls: ['./owner-list.component.css']
})
export class OwnerListComponent implements OnInit, OnDestroy {
  readonly pageSizes = PAGE_SIZES;
  lastName = '';
  query: OwnerPageQuery = DEFAULT_QUERY;
  owners: Owner[];
  totalElements = 0;
  loadFailed = false;
  readonly expandedPets = new Set<number>();
  private subscription: Subscription;

  constructor(private readonly router: Router, private readonly route: ActivatedRoute,
              private readonly ownerService: OwnerService) {
  }

  // The URL holds the grid's state, so a refresh, a shared link or Back lands on the same page.
  // switchMap: only the latest query may answer, so a slow earlier page never overwrites a newer one.
  ngOnInit() {
    this.subscription = this.route.queryParamMap.pipe(
      map(params => queryFrom(params)),
      tap(query => {
        this.query = query;
        this.lastName = query.lastName;
        this.ownerService.listParams = urlParamsOf(query);
      }),
      // A failed page must not end the stream: the next sort, page or search would fetch nothing.
      switchMap(query => this.ownerService.getOwnersPage(query).pipe(catchError(() => of(null))))
    ).subscribe(page => this.show(page));
  }

  private show(page: OwnerPage | null) {
    this.loadFailed = !page;
    if (!page) {
      return;
    }
    const lastPage = Math.max(0, Math.ceil(page.totalElements / this.query.size) - 1);
    if (this.query.page > lastPage) {
      this.load({page: lastPage}); // a link or a refresh past the end lands on the last page
      return;
    }
    this.owners = page.content;
    this.totalElements = page.totalElements;
  }

  ngOnDestroy() {
    this.subscription?.unsubscribe();
  }

  onSelect(owner: Owner) {
    this.router.navigate(['/owners', owner.id]);
  }

  addOwner() {
    this.router.navigate(['/owners/add']);
  }

  byId(index: number, owner: Owner): number {
    return owner.id;
  }

  petNames(owner: Owner): string {
    return owner.pets.map(pet => pet.name).join(', ');
  }

  togglePets(owner: Owner) {
    if (!this.expandedPets.delete(owner.id)) {
      this.expandedPets.add(owner.id);
    }
  }

  searchByLastName(lastName: string) {
    this.load({lastName: lastName ?? '', page: 0});
  }

  onSort(sort: Sort) {
    this.load({sort: sort.active as OwnerPageQuery['sort'], dir: sort.direction as OwnerPageQuery['dir'], page: 0});
  }

  // A new page size starts again from the first page, wherever the paginator would keep you.
  onPage(event: PageEvent) {
    const sizeChanged = event.pageSize !== this.query.size;
    this.load({page: sizeChanged ? 0 : event.pageIndex, size: event.pageSize});
  }

  // replaceUrl: Back leaves the Owners screen instead of stepping back through every page.
  private load(change: Partial<OwnerPageQuery>) {
    const query = {...this.query, ...change};
    // Nothing to do once it lands: queryParamMap drives the load.
    void this.router.navigate([], {relativeTo: this.route, queryParams: urlParamsOf(query), replaceUrl: true});
  }
}

/** Only what differs from the defaults goes in the URL; anything unreadable there falls back to them. */
function urlParamsOf(query: OwnerPageQuery): Partial<OwnerPageQuery> {
  const params: Partial<OwnerPageQuery> = {};
  for (const key of Object.keys(query) as (keyof OwnerPageQuery)[]) {
    if (query[key] !== DEFAULT_QUERY[key]) {
      (params as any)[key] = query[key];
    }
  }
  return params;
}

function queryFrom(params: ParamMap): OwnerPageQuery {
  const page = Number(params.get('page'));
  const size = Number(params.get('size'));
  return {
    lastName: params.get('lastName') ?? '',
    sort: params.get('sort') === 'city' ? 'city' : DEFAULT_QUERY.sort,
    dir: params.get('dir') === 'desc' ? 'desc' : DEFAULT_QUERY.dir,
    page: Number.isInteger(page) && page > 0 ? page : 0,
    size: PAGE_SIZES.includes(size) ? size : DEFAULT_QUERY.size,
  };
}
