import {Component, OnInit} from '@angular/core';
import {OwnerService} from '../owner.service';
import {Owner} from '../owner';
import {DEFAULT_OWNER_QUERY, OWNER_PAGE_SIZE_OPTIONS, OwnerQuery} from '../owner-page';
import {ActivatedRoute, Params, Router} from '@angular/router';
import {PageEvent} from '@angular/material/paginator';
import {Sort, SortDirection} from '@angular/material/sort';
import {finalize} from 'rxjs/operators';

@Component({
  selector: 'app-owner-list',
  templateUrl: './owner-list.component.html',
  styleUrls: ['./owner-list.component.css']
})
export class OwnerListComponent implements OnInit {
  readonly displayedColumns = ['name', 'address', 'city', 'telephone', 'pets'];
  readonly pageSizeOptions = OWNER_PAGE_SIZE_OPTIONS;

  errorMessage: string;
  owners: Owner[] = [];
  totalElements = 0;
  isOwnersDataReceived = false;

  // mirrors of the URL, bound to the paginator and the sort headers
  pageIndex = DEFAULT_OWNER_QUERY.page;
  pageSize = DEFAULT_OWNER_QUERY.size;
  sortActive = 'name';
  sortDirection: SortDirection = 'asc';
  lastName = DEFAULT_OWNER_QUERY.lastName;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private ownerService: OwnerService
  ) {
  }

  /** The URL is the single source of truth: every sort/page/filter action navigates, and the
   *  resulting query params are what trigger a reload. Back/forward and deep links then work
   *  for free. */
  ngOnInit() {
    this.route.queryParams.subscribe((params) => {
      const query = this.toQuery(params);
      this.pageIndex = query.page;
      this.pageSize = query.size;
      [this.sortActive, this.sortDirection] = this.splitSort(query.sort);
      this.lastName = query.lastName;
      this.loadPage(query);
    });
  }

  private toQuery(params: Params): OwnerQuery {
    return {
      page: this.toNumber(params['page'], DEFAULT_OWNER_QUERY.page),
      size: this.toNumber(params['size'], DEFAULT_OWNER_QUERY.size),
      sort: params['sort'] || DEFAULT_OWNER_QUERY.sort,
      lastName: params['lastName'] || DEFAULT_OWNER_QUERY.lastName
    };
  }

  private toNumber(value: any, fallback: number): number {
    const parsed = Number(value);
    return value !== undefined && Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
  }

  private splitSort(sort: string): [string, SortDirection] {
    const [active, direction] = sort.split(',');
    return [active, (direction === 'desc' ? 'desc' : 'asc') as SortDirection];
  }

  private loadPage(query: OwnerQuery) {
    this.ownerService.getOwners(query).pipe(
      finalize(() => {
        this.isOwnersDataReceived = true;
      })
    ).subscribe(
      (page) => {
        this.owners = page.content;
        this.totalElements = page.totalElements;
      },
      (error) => this.errorMessage = error as any);
  }

  onSortChange(sort: Sort) {
    // back to page 1: whoever was on page 4 under the old order is somewhere else now
    this.navigateWith({sort: `${sort.active},${sort.direction || 'asc'}`, page: 0});
  }

  onPageChange(event: PageEvent) {
    this.navigateWith({page: event.pageIndex, size: event.pageSize});
  }

  searchByLastName(lastName: string) {
    this.navigateWith({lastName: lastName || null, page: 0});
  }

  private navigateWith(queryParams: Params) {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge'
    });
  }

  onSelect(owner: Owner) {
    this.router.navigate(['/owners', owner.id]);
  }

  addOwner() {
    this.router.navigate(['/owners/add']);
  }
}
