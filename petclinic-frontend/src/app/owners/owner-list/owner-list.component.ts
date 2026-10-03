import {Component, OnDestroy, OnInit} from '@angular/core';
import {Router} from '@angular/router';
import {PageEvent} from '@angular/material/paginator';
import {Sort, SortDirection} from '@angular/material/sort';
import {Subscription} from 'rxjs';
import {finalize} from 'rxjs/operators';
import {OwnerService} from '../owner.service';
import {Owner} from '../owner';
import {FIRST_OWNER_PAGE, OwnerSort} from '../owner-page';

@Component({
  selector: 'app-owner-list',
  templateUrl: './owner-list.component.html',
  styleUrls: ['./owner-list.component.css']
})
export class OwnerListComponent implements OnInit, OnDestroy {
  readonly pageSizeOptions = [5, 10, 20];
  draftLastName = FIRST_OWNER_PAGE.lastName;
  submittedLastName = FIRST_OWNER_PAGE.lastName;
  pageIndex = FIRST_OWNER_PAGE.page;
  pageSize = FIRST_OWNER_PAGE.size;
  sortKey = 'name';
  sortDirection: SortDirection = 'asc';

  owners: Owner[] = [];
  totalElements = 0;
  loading = false;
  loaded = false;
  errorMessage: string | null = null;
  private load?: Subscription;

  constructor(private router: Router, private ownerService: OwnerService) {
  }

  get noOwnersMatch(): boolean {
    return this.loaded && this.totalElements === 0;
  }

  get hasMatches(): boolean {
    return this.loaded && this.totalElements > 0;
  }

  ngOnInit() {
    this.loadPage();
  }

  ngOnDestroy() {
    this.load?.unsubscribe();
  }

  search() {
    this.submittedLastName = this.draftLastName;
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
    this.sortKey = sort.active;
    this.sortDirection = sort.direction || 'asc';
    this.pageIndex = 0;
    this.loadPage();
  }

  /** After a failure: the same page, filter, size and sort again. */
  reload() {
    this.loadPage();
  }

  onSelect(owner: Owner) {
    this.router.navigate(['/owners', owner.id]);
  }

  addOwner() {
    this.router.navigate(['/owners/add']);
  }

  // Only the latest query may answer: cancelling the previous one first means none of its
  // callbacks, finalize included, can touch the rows, total or loading state of this one.
  private loadPage() {
    this.load?.unsubscribe();
    this.loading = true;
    this.errorMessage = null;
    this.load = this.ownerService.getOwnerPage({
      lastName: this.submittedLastName,
      page: this.pageIndex,
      size: this.pageSize,
      sort: `${this.sortKey},${this.sortDirection}` as OwnerSort
    }).pipe(
      finalize(() => this.loading = false)
    ).subscribe({
      next: page => {
        this.owners = page.content;
        this.totalElements = page.totalElements;
        this.loaded = true;
      },
      error: error => {
        this.owners = [];
        this.totalElements = 0;
        this.loaded = false;
        this.errorMessage = String(error);
      }
    });
  }
}
