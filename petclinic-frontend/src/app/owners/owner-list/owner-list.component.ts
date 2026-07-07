import {Component, OnInit} from '@angular/core';
import {OwnerService} from '../owner.service';
import {Owner, OwnerListQuery} from '../owner';
import {ActivatedRoute, Router} from '@angular/router';
import { finalize } from 'rxjs/operators';

@Component({
  selector: 'app-owner-list',
  templateUrl: './owner-list.component.html',
  styleUrls: ['./owner-list.component.css']
})
export class OwnerListComponent implements OnInit {
  errorMessage: string;
  lastName: string = '';
  owners: Owner[] = [];
  isOwnersDataReceived: boolean = false;
  currentQuery: OwnerListQuery = {
    lastName: '',
    page: 1,
    pageSize: 10,
    sort: 'name',
    direction: 'asc'
  };
  totalPages: number = 0;
  // Guards against reloading the identical query twice (the canonicalizing navigate below re-emits queryParams).
  private lastLoadedQueryKey: string | null = null;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private ownerService: OwnerService
  ) {

  }

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      const normalizedQuery = this.normalizeQuery(params);

      if (!this.matchesQueryParams(params, normalizedQuery)) {
        this.router.navigate([], {
          queryParams: normalizedQuery,
          replaceUrl: true
        });
      }

      this.lastName = normalizedQuery.lastName || '';
      this.currentQuery = normalizedQuery;
      this.loadOwners(normalizedQuery);
    });
  }

  onSelect(owner: Owner) {
    this.router.navigate(['/owners', owner.id]);
  }

  addOwner() {
    this.router.navigate(['/owners/add']);
  }

  searchByLastName(lastName: string) {
    this.navigateWithQuery({lastName, page: 1});
  }

  changeSort(sort: 'name' | 'city') {
    const direction = this.currentQuery.sort === sort && this.currentQuery.direction === 'asc'
      ? 'desc'
      : 'asc';
    this.navigateWithQuery({sort, direction, page: 1});
  }

  changePageSize(pageSize: 5 | 10 | 20) {
    this.navigateWithQuery({pageSize, page: 1});
  }

  changePage(page: number) {
    this.navigateWithQuery({page});
  }

  private navigateWithQuery(overrides: Partial<OwnerListQuery>) {
    this.router.navigate([], {
      queryParams: {...this.currentQuery, ...overrides}
    });
  }

  private loadOwners(query: OwnerListQuery) {
    const queryKey = JSON.stringify(query);
    if (queryKey === this.lastLoadedQueryKey) {
      return;
    }
    this.lastLoadedQueryKey = queryKey;

    this.isOwnersDataReceived = false;
    this.ownerService.getOwnersPage(query).pipe(
      finalize(() => {
        this.isOwnersDataReceived = true;
      })
    ).subscribe(
      ownersPage => {
        if ((query.page || 1) > ownersPage.totalPages && ownersPage.totalPages > 0) {
          this.navigateWithQuery({page: ownersPage.totalPages});
          return;
        }
        this.owners = ownersPage.items;
        this.totalPages = ownersPage.totalPages;
      },
      error => this.errorMessage = error as any);
  }

  private normalizeQuery(params: {[key: string]: string}): OwnerListQuery {
    return {
      lastName: params['lastName'] || '',
      page: this.normalizePage(params['page']),
      pageSize: this.normalizePageSize(params['pageSize']),
      sort: this.normalizeSort(params['sort']),
      direction: this.normalizeDirection(params['direction'])
    };
  }

  private normalizePage(page: string | undefined): number {
    const parsed = Number(page);
    if (!Number.isInteger(parsed) || parsed < 1) {
      return 1;
    }
    return parsed;
  }

  private normalizePageSize(pageSize: string | undefined): 5 | 10 | 20 {
    const parsed = Number(pageSize);
    if (parsed === 5 || parsed === 10 || parsed === 20) {
      return parsed;
    }
    return 10;
  }

  private normalizeSort(sort: string | undefined): 'name' | 'city' {
    if (sort === 'city') {
      return 'city';
    }
    return 'name';
  }

  private normalizeDirection(direction: string | undefined): 'asc' | 'desc' {
    if (direction === 'desc') {
      return 'desc';
    }
    return 'asc';
  }

  private matchesQueryParams(params: {[key: string]: string}, normalizedQuery: OwnerListQuery): boolean {
    return (params['lastName'] || '') === normalizedQuery.lastName
      && params['page'] === normalizedQuery.page?.toString()
      && params['pageSize'] === normalizedQuery.pageSize?.toString()
      && params['sort'] === normalizedQuery.sort
      && params['direction'] === normalizedQuery.direction;
  }

}
