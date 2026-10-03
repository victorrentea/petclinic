import {Component, OnDestroy, OnInit} from '@angular/core';
import {PageEvent} from '@angular/material/paginator';
import {Sort, SortDirection} from '@angular/material/sort';
import {Subscription} from 'rxjs';
import {OwnerService} from '../owner.service';
import {Owner} from '../owner';
import {OwnerSort} from '../owner-page';

type OwnerSortKey = 'name' | 'city';

@Component({
  selector: 'app-owner-list',
  templateUrl: './owner-list.component.html',
  styleUrls: ['./owner-list.component.css']
})
export class OwnerListComponent implements OnInit, OnDestroy {
  readonly pageSizeOptions = [5, 10, 20];

  /** What is typed in the search box; only a submit makes it the filter. */
  lastName = '';
  submittedLastName = '';
  pageIndex = 0;
  pageSize = 10;
  sortKey: OwnerSortKey = 'name';
  sortDirection: SortDirection = 'asc';

  owners: Owner[] = [];
  totalElements = 0;
  loading = false;
  loaded = false;
  errorMessage: string | null = null;

  private request?: Subscription;

  constructor(private ownerService: OwnerService) {
  }

  ngOnInit() {
    this.loadPage();
  }

  ngOnDestroy() {
    this.request?.unsubscribe();
  }

  search() {
    this.submittedLastName = this.lastName ?? '';
    this.pageIndex = 0;
    this.loadPage();
  }

  onPage(event: PageEvent) {
    const sizeChanged = event.pageSize !== this.pageSize;
    this.pageSize = event.pageSize;
    this.pageIndex = sizeChanged ? 0 : event.pageIndex;
    this.loadPage();
  }

  onSort(sort: Sort) {
    this.sortKey = sort.active as OwnerSortKey;
    this.sortDirection = sort.direction;
    this.pageIndex = 0;
    this.loadPage();
  }

  get noOwnersFound(): boolean {
    return this.loaded && !this.errorMessage && this.totalElements === 0;
  }

  // Unsubscribing first is what makes the latest request the only one that answers:
  // an earlier one can no longer set rows, total, loading or error once it is dropped.
  private loadPage() {
    this.request?.unsubscribe();
    this.loading = true;
    this.errorMessage = null;
    this.request = this.ownerService.getOwners({
      lastName: this.submittedLastName,
      page: this.pageIndex,
      size: this.pageSize,
      sort: `${this.sortKey},${this.sortDirection}` as OwnerSort
    }).subscribe(
      page => {
        this.owners = page.content;
        this.totalElements = page.totalElements;
        this.loaded = true;
        this.loading = false;
      },
      error => {
        this.owners = [];
        this.errorMessage = String(error);
        this.loading = false;
      });
  }
}
