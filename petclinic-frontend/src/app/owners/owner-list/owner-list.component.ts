import {Component, OnDestroy, OnInit} from '@angular/core';
import {Router} from '@angular/router';
import {Sort, SortDirection} from '@angular/material/sort';
import {PageEvent} from '@angular/material/paginator';
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

  draftLastName = '';
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

  constructor(private router: Router, private ownerService: OwnerService) {
  }

  get noMatches(): boolean {
    return this.loaded && this.totalElements === 0;
  }

  ngOnInit() {
    this.loadPage();
  }

  ngOnDestroy() {
    this.request?.unsubscribe();
  }

  search() {
    this.submittedLastName = this.draftLastName;
    this.pageIndex = 0;
    this.loadPage();
  }

  onPage(event: PageEvent) {
    // MatPaginator keeps the first row visible on a size change; we restart from page 0 instead
    this.pageIndex = event.pageSize === this.pageSize ? event.pageIndex : 0;
    this.pageSize = event.pageSize;
    this.loadPage();
  }

  onSort(sort: Sort) {
    this.sortKey = sort.active as OwnerSortKey;
    this.sortDirection = sort.direction || 'asc';
    this.pageIndex = 0;
    this.loadPage();
  }

  onSelect(owner: Owner) {
    this.router.navigate(['/owners', owner.id]);
  }

  addOwner() {
    this.router.navigate(['/owners/add']);
  }

  // Unsubscribing first means no callback of an older request can touch the screen any more
  private loadPage() {
    this.request?.unsubscribe();
    this.loading = true;
    this.errorMessage = null;
    this.request = this.ownerService.getOwners({
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
      error: message => {
        this.owners = [];
        this.loaded = false;
        this.errorMessage = String(message);
        this.loading = false;
      }
    });
  }
}
