import {Component, OnDestroy, OnInit} from '@angular/core';
import {OwnerService} from '../owner.service';
import {Owner} from '../owner';
import {OwnerSort} from '../owner-page';
import {Router} from '@angular/router';
import {Subscription} from 'rxjs';
import {PageEvent} from '@angular/material/paginator';
import {Sort, SortDirection} from '@angular/material/sort';

type SortKey = 'name' | 'city';

@Component({
  selector: 'app-owner-list',
  templateUrl: './owner-list.component.html',
  styleUrls: ['./owner-list.component.css']
})
export class OwnerListComponent implements OnInit, OnDestroy {
  readonly pageSizeOptions = [5, 10, 20];

  /** What the search box holds; becomes the filter only once submitted. */
  draftLastName = '';
  submittedLastName = '';
  pageIndex = 0;
  pageSize = 10;
  sortKey: SortKey = 'name';
  sortDirection: SortDirection = 'asc';

  owners: Owner[] = [];
  totalElements = 0;
  loaded = false;
  loading = false;
  errorMessage: string | null = null;

  private request?: Subscription;

  constructor(private readonly router: Router, private readonly ownerService: OwnerService) {
  }

  // After a failure the last rows no longer match the requested page, filter or sort
  get showGrid(): boolean {
    return this.totalElements > 0 && !this.errorMessage;
  }

  ngOnInit() {
    this.load();
  }

  ngOnDestroy() {
    this.request?.unsubscribe();
  }

  search() {
    this.submittedLastName = this.draftLastName ?? '';
    this.pageIndex = 0;
    this.load();
  }

  onPage(event: PageEvent) {
    // The paginator keeps the first visible row on a size change; this grid restarts instead
    this.pageIndex = event.pageSize === this.pageSize ? event.pageIndex : 0;
    this.pageSize = event.pageSize;
    this.load();
  }

  onSort(sort: Sort) {
    this.sortKey = sort.active as SortKey;
    this.sortDirection = sort.direction || 'asc';
    this.pageIndex = 0;
    this.load();
  }

  onSelect(owner: Owner) {
    this.router.navigate(['/owners', owner.id]);
  }

  addOwner() {
    this.router.navigate(['/owners/add']);
  }

  // Unsubscribing cancels the previous request, so none of its callbacks can touch the state
  private load() {
    this.request?.unsubscribe();
    this.loading = true;
    this.errorMessage = null;
    this.request = this.ownerService.listOwners({
      lastName: this.submittedLastName,
      page: this.pageIndex,
      size: this.pageSize,
      sort: `${this.sortKey},${this.sortDirection}` as OwnerSort
    }).subscribe({
      next: page => {
        this.owners = page.content;
        this.totalElements = page.totalElements;
        this.loaded = true;
        this.loading = false;
      },
      error: error => {
        this.errorMessage = String(error);
        this.loading = false;
      }
    });
  }
}
