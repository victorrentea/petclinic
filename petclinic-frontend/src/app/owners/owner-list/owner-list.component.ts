import {Component, OnDestroy, OnInit} from '@angular/core';
import {OwnerService} from '../owner.service';
import {Owner} from '../owner';
import {Router} from '@angular/router';
import {Subscription} from 'rxjs';
import {PageEvent} from '@angular/material/paginator';
import {Sort, SortDirection} from '@angular/material/sort';
import {DEFAULT_OWNER_QUERY, OwnerQuery} from '../owner-page';

@Component({
  selector: 'app-owner-list',
  templateUrl: './owner-list.component.html',
  styleUrls: ['./owner-list.component.css']
})
export class OwnerListComponent implements OnInit, OnDestroy {
  readonly pageSizeOptions = [5, 10, 20];
  /** What is typed in the search box; only {@link query} — the submitted state — reaches the server. */
  draftLastName = '';
  query: OwnerQuery = {...DEFAULT_OWNER_QUERY};
  owners: Owner[] = [];
  totalElements = 0;
  loaded = false;
  loading = false;
  errorMessage: string = null;
  private request: Subscription;

  constructor(private readonly router: Router, private readonly ownerService: OwnerService) {
  }

  get sortKey(): string {
    return this.query.sort.split(',')[0];
  }

  get sortDirection(): SortDirection {
    return this.query.sort.split(',')[1] as SortDirection;
  }

  ngOnInit() {
    this.load(this.query);
  }

  ngOnDestroy() {
    this.request?.unsubscribe();
  }

  search() {
    this.load({...this.query, lastName: this.draftLastName ?? '', page: 0});
  }

  onPage(event: PageEvent) {
    const sizeChanged = event.pageSize !== this.query.size;
    this.load({...this.query, size: event.pageSize, page: sizeChanged ? 0 : event.pageIndex});
  }

  onSort(sort: Sort) {
    this.load({...this.query, sort: `${sort.active},${sort.direction}` as OwnerQuery['sort'], page: 0});
  }

  onSelect(owner: Owner) {
    this.router.navigate(['/owners', owner.id]);
  }

  addOwner() {
    this.router.navigate(['/owners/add']);
  }

  // Only the latest query may answer: unsubscribing the previous one cancels its HTTP call, and
  // with it any late success, error or completion that would overwrite the newer page.
  private load(query: OwnerQuery) {
    this.request?.unsubscribe();
    this.query = query;
    this.loading = true;
    this.request = this.ownerService.listOwners(query).subscribe({
      next: page => {
        this.owners = page.content;
        this.totalElements = page.totalElements;
        this.errorMessage = null;
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
