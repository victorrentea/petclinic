import {Component, OnDestroy, OnInit} from '@angular/core';
import {Router} from '@angular/router';
import {PageEvent} from '@angular/material/paginator';
import {Sort} from '@angular/material/sort';
import {Subscription} from 'rxjs';
import {OwnerService} from '../owner.service';
import {Owner} from '../owner';
import {OwnerPage, OwnerPageSize, OwnerSort} from '../owner-page';

type OwnerSortKey = 'name' | 'city';

/** What a list request asks for: the controls that produced the page on screen. */
interface ListState {
  submittedLastName: string;
  pageIndex: number;
  pageSize: OwnerPageSize;
  sortKey: OwnerSortKey;
  sortDirection: 'asc' | 'desc';
}

@Component({
  selector: 'app-owner-list',
  templateUrl: './owner-list.component.html',
  styleUrls: ['./owner-list.component.css']
})
export class OwnerListComponent implements OnInit, OnDestroy {
  readonly pageSizes: OwnerPageSize[] = [5, 10, 20];

  /** What is typed in the search box; only a submitted search reaches the query. */
  lastName = '';
  submittedLastName = '';
  pageIndex = 0;
  pageSize: OwnerPageSize = 10;
  sortKey: OwnerSortKey = 'name';
  sortDirection: 'asc' | 'desc' = 'asc';

  owners: Owner[] = [];
  totalElements = 0;
  loading = false;
  loaded = false;
  errorMessage: string | null = null;

  private request?: Subscription;
  private shown?: ListState;

  constructor(private readonly router: Router, private readonly ownerService: OwnerService) {
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
    this.pageSize = event.pageSize as OwnerPageSize;
    this.pageIndex = sizeChanged ? 0 : event.pageIndex;
    this.loadPage();
  }

  onSort(sort: Sort) {
    this.sortKey = sort.active as OwnerSortKey;
    this.sortDirection = sort.direction || 'asc'; // matSortDisableClear: never '' in practice
    this.pageIndex = 0;
    this.loadPage();
  }

  onSelect(owner: Owner) {
    this.router.navigate(['/owners', owner.id]);
  }

  addOwner() {
    this.router.navigate(['/owners/add']);
  }

  get noMatches(): boolean {
    return this.loaded && !this.errorMessage && this.totalElements === 0;
  }

  // Cancelling the previous request first means only the latest one may answer:
  // an unsubscribed observer gets no next, error or complete.
  private loadPage() {
    this.request?.unsubscribe();
    this.loading = true;
    this.request = this.ownerService.getOwnerPage({
      lastName: this.submittedLastName,
      page: this.pageIndex,
      size: this.pageSize,
      sort: `${this.sortKey},${this.sortDirection}` as OwnerSort
    }).subscribe({
      next: page => this.show(page),
      error: error => this.fail(error)
    });
  }

  private show(page: OwnerPage) {
    this.shown = this.listState();
    this.owners = page.content;
    this.totalElements = page.totalElements;
    this.errorMessage = null;
    this.loaded = true;
    this.loading = false;
  }

  // The last page that did load stays on screen, and the paginator and sort header go back to
  // describing it: left on the page that failed, they would claim rows the table does not hold.
  private fail(error: unknown) {
    if (this.shown) {
      Object.assign(this, this.shown);
    }
    this.errorMessage = String(error);
    this.loading = false;
  }

  private listState(): ListState {
    const {submittedLastName, pageIndex, pageSize, sortKey, sortDirection} = this;
    return {submittedLastName, pageIndex, pageSize, sortKey, sortDirection};
  }
}
