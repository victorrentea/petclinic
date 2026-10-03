import {Component, OnDestroy, OnInit} from '@angular/core';
import {Router} from '@angular/router';
import {PageEvent} from '@angular/material/paginator';
import {Sort, SortDirection} from '@angular/material/sort';
import {Subscription} from 'rxjs';
import {OwnerService} from '../owner.service';
import {Owner} from '../owner';
import {DEFAULT_OWNER_PAGE_QUERY, OWNER_PAGE_SIZES, OwnerPageQuery, OwnerSort} from '../owner-page';

@Component({
  selector: 'app-owner-list',
  templateUrl: './owner-list.component.html',
  styleUrls: ['./owner-list.component.css']
})
export class OwnerListComponent implements OnInit, OnDestroy {
  readonly pageSizes = OWNER_PAGE_SIZES;
  draftLastName = '';
  query: OwnerPageQuery = DEFAULT_OWNER_PAGE_QUERY;
  owners: Owner[] = [];
  totalElements = 0;
  loaded = false;
  loading = false;
  errorMessage: string = null;
  private loadedQuery: OwnerPageQuery = null;
  private request: Subscription;

  constructor(private readonly router: Router, private readonly ownerService: OwnerService) {
  }

  get sortActive(): string {
    return this.query.sort.split(',')[0];
  }

  get sortDirection(): SortDirection {
    return this.query.sort.split(',')[1] as SortDirection;
  }

  ngOnInit() {
    this.load({});
  }

  ngOnDestroy() {
    this.request?.unsubscribe();
  }

  search() {
    this.load({lastName: this.draftLastName ?? '', page: 0});
  }

  onPage(event: PageEvent) {
    const sizeChanged = event.pageSize !== this.query.size;
    this.load({size: event.pageSize, page: sizeChanged ? 0 : event.pageIndex});
  }

  onSort(sort: Sort) {
    this.load({sort: `${sort.active},${sort.direction}` as OwnerSort, page: 0});
  }

  onSelect(owner: Owner) {
    this.router.navigate(['/owners', owner.id]);
  }

  addOwner() {
    this.router.navigate(['/owners/add']);
  }

  // Unsubscribing first is what makes the latest request win: an older one can no longer
  // deliver rows, a total, an error or a completion over the state of the newer one.
  private load(changes: Partial<OwnerPageQuery>) {
    this.request?.unsubscribe();
    this.query = {...this.query, ...changes};
    this.loading = true;
    this.errorMessage = null;
    this.request = this.ownerService.getOwnerPage(this.query).subscribe({
      next: page => {
        this.owners = page.content;
        this.totalElements = page.totalElements;
        this.loadedQuery = this.query;
        this.loaded = true;
        this.loading = false;
      },
      // The last page that did load stays on screen, and the controls go back to describing it,
      // so the user can retry the same click instead of facing a grid that vanished
      error: error => {
        this.query = this.loadedQuery ?? this.query;
        this.loading = false;
        this.errorMessage = String(error?.message ?? error);
      }
    });
  }
}
