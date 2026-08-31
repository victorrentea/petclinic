import {Component, OnInit} from '@angular/core';
import {ActivatedRoute, ParamMap, Params, Router} from '@angular/router';
import {PageEvent} from '@angular/material/paginator';
import {Sort, SortDirection} from '@angular/material/sort';
import {Observable} from 'rxjs';
import {switchMap} from 'rxjs/operators';
import {Owner, OwnerPage} from '../owner';
import {
  DEFAULT_OWNERS_PAGE_SIZE,
  DEFAULT_OWNERS_SORT,
  OWNERS_PAGE_SIZES,
  OwnerService
} from '../owner.service';

@Component({
  selector: 'app-owner-list',
  templateUrl: './owner-list.component.html',
  styleUrls: ['./owner-list.component.css']
})
export class OwnerListComponent implements OnInit {
  readonly pageSizeOptions = OWNERS_PAGE_SIZES;
  errorMessage: string;
  lastName = '';
  owners: Owner[] = [];
  totalElements = 0;
  pageIndex = 0;
  pageSize = DEFAULT_OWNERS_PAGE_SIZE;
  sortActive = 'lastName';
  sortDirection: SortDirection = 'asc';
  isOwnersDataReceived = false;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private ownerService: OwnerService) {
  }

  ngOnInit() {
    this.route.queryParamMap.pipe(
      switchMap(params => this.fetchPageFor(params))
    ).subscribe(
      page => this.showPage(page),
      error => this.errorMessage = error as any);
  }

  onSelect(owner: Owner) {
    this.router.navigate(['/owners', owner.id]);
  }

  addOwner() {
    this.router.navigate(['/owners/add']);
  }

  onPageChange(event: PageEvent) {
    this.navigateWith({page: event.pageIndex, size: event.pageSize});
  }

  onSortChange(sort: Sort) {
    this.navigateWith({page: 0, sort: `${sort.active},${sort.direction}`});
  }

  /** A new search starts over at the first page but keeps the current ordering. */
  searchByLastName(lastName: string) {
    this.navigateWith({page: 0, lastName: lastName || null});
  }

  private fetchPageFor(params: ParamMap): Observable<OwnerPage> {
    this.pageIndex = Number(params.get('page')) || 0;
    this.pageSize = Number(params.get('size')) || DEFAULT_OWNERS_PAGE_SIZE;
    this.lastName = params.get('lastName') || '';
    const sort = params.get('sort') || DEFAULT_OWNERS_SORT;
    const [sortActive, sortDirection] = sort.split(',');
    this.sortActive = sortActive;
    this.sortDirection = sortDirection as SortDirection;
    return this.ownerService.getOwners({
      page: this.pageIndex,
      size: this.pageSize,
      sort,
      lastName: this.lastName
    });
  }

  private showPage(page: OwnerPage) {
    this.owners = page.content || [];
    this.totalElements = (page.page && page.page.totalElements) || 0;
    this.isOwnersDataReceived = true;
  }

  private navigateWith(queryParams: Params) {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge'
    });
  }
}
