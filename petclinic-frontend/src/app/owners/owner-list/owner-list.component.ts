import {Component, OnDestroy, OnInit} from '@angular/core';
import {Sort} from '@angular/material/sort';
import {PageEvent} from '@angular/material/paginator';
import {Subscription} from 'rxjs';
import {OwnerService} from '../owner.service';
import {Owner} from '../owner';
import {DEFAULT_OWNER_PAGE_QUERY, OWNER_PAGE_SIZES, OwnerPageQuery, OwnerSortKey} from '../owner-page';

@Component({
  selector: 'app-owner-list',
  templateUrl: './owner-list.component.html',
  styleUrls: ['./owner-list.component.css']
})
export class OwnerListComponent implements OnInit, OnDestroy {
  readonly pageSizes = OWNER_PAGE_SIZES;
  // What is typed in the search box; only search() turns it into the query's lastName
  draftLastName = '';
  query: OwnerPageQuery = DEFAULT_OWNER_PAGE_QUERY;
  // The prefix of the rows on screen, which lags `query` while a new search is in flight
  shownLastName = '';
  owners: Owner[] = [];
  totalElements = 0;
  loaded = false;
  loading = false;
  errorMessage: string | null = null;
  private request?: Subscription;

  constructor(private ownerService: OwnerService) {
  }

  ngOnInit() {
    this.loadPage(this.query);
  }

  ngOnDestroy() {
    this.request?.unsubscribe();
  }

  search() {
    this.loadPage({...this.query, lastName: this.draftLastName, page: 0});
  }

  onPage(event: PageEvent) {
    const sizeChanged = event.pageSize !== this.query.size;
    this.loadPage({...this.query, size: event.pageSize, page: sizeChanged ? 0 : event.pageIndex});
  }

  onSort(sort: Sort) {
    this.loadPage({...this.query, sort: sort.active as OwnerSortKey, direction: sort.direction || 'asc', page: 0});
  }

  // The only place a request starts: cancelling the previous one first means no answer,
  // failure or completion of an older query can ever reach the screen.
  private loadPage(query: OwnerPageQuery) {
    this.request?.unsubscribe();
    this.query = query;
    this.loading = true;
    this.request = this.ownerService.getOwnerPage(query).subscribe(
      page => {
        this.owners = page.content;
        this.shownLastName = query.lastName;
        this.totalElements = page.totalElements;
        this.errorMessage = null;
        this.loaded = true;
        this.loading = false;
      },
      error => {
        this.errorMessage = String(error);
        this.loading = false;
      });
  }
}
