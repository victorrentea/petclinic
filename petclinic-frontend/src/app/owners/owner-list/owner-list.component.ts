import {Component, OnDestroy, OnInit} from '@angular/core';
import {OwnerService} from '../owner.service';
import {Owner} from '../owner';
import {OwnerPage, OwnerSort} from '../owner-page';
import {Router} from '@angular/router';
import {Subscription} from 'rxjs';
import {PageEvent} from '@angular/material/paginator';
import {Sort} from '@angular/material/sort';

type SortKey = 'name' | 'city';
type SortDirection = 'asc' | 'desc';

@Component({
  selector: 'app-owner-list',
  templateUrl: './owner-list.component.html',
  styleUrls: ['./owner-list.component.css']
})
export class OwnerListComponent implements OnInit, OnDestroy {
  readonly pageSizeOptions = [5, 10, 20];

  /** What the search box holds; only {@link submittedLastName} is ever sent. */
  lastNameDraft = '';
  submittedLastName = '';
  pageIndex = 0;
  pageSize = 10;
  sortKey: SortKey = 'name';
  sortDirection: SortDirection = 'asc';

  /** The latest successful answer; null before the first one and after a failure. */
  page: OwnerPage | null = null;
  loading = false;
  failed = false;
  private request?: Subscription;

  constructor(private router: Router, private ownerService: OwnerService) {
  }

  ngOnInit() {
    this.load();
  }

  ngOnDestroy() {
    this.request?.unsubscribe();
  }

  search() {
    this.submittedLastName = this.lastNameDraft;
    this.pageIndex = 0;
    this.load();
  }

  changePage(event: PageEvent) {
    const sizeChanged = event.pageSize !== this.pageSize;
    this.pageSize = event.pageSize;
    this.pageIndex = sizeChanged ? 0 : event.pageIndex;
    this.load();
  }

  changeSort(sort: Sort) {
    this.sortKey = sort.active as SortKey;
    this.sortDirection = sort.direction as SortDirection;
    this.pageIndex = 0;
    this.load();
  }

  onSelect(owner: Owner) {
    this.router.navigate(['/owners', owner.id]);
  }

  addOwner() {
    this.router.navigate(['/owners/add']);
  }

  // Only the latest request may answer: unsubscribing the previous one silences its success,
  // error and completion alike, so a late answer can never overwrite the page asked for since.
  private load() {
    this.request?.unsubscribe();
    this.loading = true;
    this.request = this.ownerService.getOwners({
      lastName: this.submittedLastName,
      page: this.pageIndex,
      size: this.pageSize,
      sort: `${this.sortKey},${this.sortDirection}` as OwnerSort
    }).subscribe({
      next: (page) => {
        this.page = page;
        this.failed = false;
        this.loading = false;
      },
      error: () => {
        this.page = null;
        this.failed = true;
        this.loading = false;
      }
    });
  }
}
