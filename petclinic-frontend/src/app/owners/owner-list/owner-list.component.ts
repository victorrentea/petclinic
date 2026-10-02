import {Component, OnDestroy, OnInit} from '@angular/core';
import {PageEvent} from '@angular/material/paginator';
import {Sort} from '@angular/material/sort';
import {OwnerService} from '../owner.service';
import {Owner} from '../owner';
import {ActivatedRoute, ParamMap, Router} from '@angular/router';
import { finalize } from 'rxjs/operators';
import {Subscription} from 'rxjs';
import {OwnerSortDirection, OwnerSortKey} from '../owner-page';
import {DEFAULT_OWNER_LIST_QUERY, OwnerListQuery, readOwnerListQuery} from '../owner-list-query';

@Component({
  selector: 'app-owner-list',
  templateUrl: './owner-list.component.html',
  styleUrls: ['./owner-list.component.css']
})
export class OwnerListComponent implements OnInit, OnDestroy {
  errorMessage = '';
  noticeMessage = '';
  lastName = '';
  appliedLastName = '';
  owners: Owner[] = [];
  pageIndex = 0;
  pageSize = 10;
  totalElements = 0;
  sortKey: OwnerSortKey = 'name';
  sortDirection: OwnerSortDirection = 'asc';
  isOwnersDataReceived: boolean = false;
  private load: Subscription;
  private queryChanges: Subscription;
  private appliedQuery: OwnerListQuery;

  constructor(private router: Router, private ownerService: OwnerService, private route: ActivatedRoute) {

  }

  ngOnInit() {
    this.queryChanges = this.route.queryParamMap.subscribe(params => this.loadFromUrl(params));
  }

  ngOnDestroy() {
    this.queryChanges?.unsubscribe();
    this.load?.unsubscribe();
  }

  onSelect(owner: Owner) {
    this.router.navigate(['/owners', owner.id]);
  }

  addOwner() {
    this.router.navigate(['/owners/add']);
  }

  searchByLastName(lastName: string) {
    this.requestQuery({lastName, page: 0});
  }

  onPageChange(event: PageEvent) {
    this.requestQuery({page: event.pageSize !== this.pageSize ? 0 : event.pageIndex, size: event.pageSize});
  }

  onSortChange(sort: Sort) {
    if ((sort.active !== 'name' && sort.active !== 'city') || sort.direction === '') {
      throw new Error('Unsupported owner sort');
    }
    this.requestQuery({page: 0, sort: `${sort.active},${sort.direction}`});
  }

  private loadFromUrl(params: ParamMap) {
    const result = readOwnerListQuery(params);
    if (result.valid === false) {
      this.noticeMessage = `Invalid owner-list URL: ${result.reason}. Restored defaults for all settings.`;
      this.lastName = DEFAULT_OWNER_LIST_QUERY.lastName;
      this.applyQuery(DEFAULT_OWNER_LIST_QUERY);
      this.navigateToQuery(DEFAULT_OWNER_LIST_QUERY, true);
      return;
    }
    if (this.isAppliedQuery(result.query)) {
      return;
    }
    this.noticeMessage = '';
    this.applyQuery(result.query);
  }

  private applyQuery(query: OwnerListQuery) {
    if (!this.appliedQuery || query.lastName !== this.appliedLastName) {
      this.lastName = query.lastName;
    }
    this.appliedQuery = query;
    this.appliedLastName = query.lastName;
    this.pageIndex = query.page;
    this.pageSize = query.size;
    this.sortKey = query.sort.startsWith('city,') ? 'city' : 'name';
    this.sortDirection = query.sort.endsWith(',desc') ? 'desc' : 'asc';
    this.loadOwners();
  }

  private isAppliedQuery(query: OwnerListQuery): boolean {
    return !!this.appliedQuery && this.appliedQuery.page === query.page
      && this.appliedQuery.size === query.size && this.appliedQuery.sort === query.sort
      && this.appliedQuery.lastName === query.lastName;
  }

  private requestQuery(changes: Partial<OwnerListQuery>) {
    const query = {...(this.appliedQuery ?? DEFAULT_OWNER_LIST_QUERY), ...changes};
    this.noticeMessage = '';
    if (this.isAppliedQuery(query)) {
      this.loadOwners();
    } else {
      this.navigateToQuery(query);
    }
  }

  private navigateToQuery(query: OwnerListQuery, replaceUrl = false) {
    this.router.navigate([], {
      relativeTo: this.route, queryParams: query, queryParamsHandling: 'merge', replaceUrl
    }).catch((error: unknown) => {
      console.error('OwnerListComponent::navigateToQuery failed', error);
      this.errorMessage = 'Unable to update the owner-list URL. Please try again.';
    });
  }

  private loadOwners() {
    this.load?.unsubscribe();
    this.isOwnersDataReceived = false;
    this.errorMessage = '';
    const sort = `${this.sortKey},${this.sortDirection}` as const;
    const owners$ = this.appliedLastName === ''
      ? this.ownerService.getOwners(this.pageIndex, this.pageSize, sort)
      : this.ownerService.searchOwners(this.appliedLastName, this.pageIndex, this.pageSize, sort);
    this.load = owners$.pipe(finalize(() => this.isOwnersDataReceived = true)).subscribe(
      page => {
        this.owners = page.content;
        this.totalElements = page.totalElements;
      },
      error => {
        this.owners = [];
        this.errorMessage = error;
      });
  }
}
