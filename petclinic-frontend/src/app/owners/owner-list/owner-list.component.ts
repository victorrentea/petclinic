import {Component, OnDestroy, OnInit} from '@angular/core';
import {Router} from '@angular/router';
import {Subscription} from 'rxjs';
import {PageEvent} from '@angular/material/paginator';
import {Sort} from '@angular/material/sort';
import {OwnerService} from '../owner.service';
import {Owner} from '../owner';
import {OwnerPageQuery} from '../owner-page';

type OwnerSortKey = 'name' | 'city';
type OwnerSortDirection = 'asc' | 'desc';

@Component({
  selector: 'app-owner-list',
  templateUrl: './owner-list.component.html',
  styleUrls: ['./owner-list.component.css']
})
export class OwnerListComponent implements OnInit, OnDestroy {
  readonly pageSizeOptions = [5, 10, 20];
  lastName = '';
  submittedLastName = '';
  pageIndex = 0;
  pageSize = 10;
  sortKey: OwnerSortKey = 'name';
  sortDirection: OwnerSortDirection = 'asc';
  owners: Owner[] = [];
  totalElements = 0;
  loading = false;
  errorMessage: string | null = null;
  private loaded = false;
  private pageRequest?: Subscription;

  constructor(private readonly router: Router, private readonly ownerService: OwnerService) {
  }

  get noMatches(): boolean {
    return this.loaded && this.totalElements === 0;
  }

  ngOnInit() {
    this.loadPage();
  }

  ngOnDestroy() {
    this.pageRequest?.unsubscribe();
  }

  onSelect(owner: Owner) {
    this.router.navigate(['/owners', owner.id]);
  }

  addOwner() {
    this.router.navigate(['/owners/add']);
  }

  search() {
    this.submittedLastName = this.lastName ?? '';
    this.pageIndex = 0;
    this.loadPage();
  }

  onPage(event: PageEvent) {
    this.pageIndex = event.pageSize === this.pageSize ? event.pageIndex : 0;
    this.pageSize = event.pageSize;
    this.loadPage();
  }

  onSort(sort: Sort) {
    this.sortKey = sort.active as OwnerSortKey;
    this.sortDirection = sort.direction === 'desc' ? 'desc' : 'asc';
    this.pageIndex = 0;
    this.loadPage();
  }

  // Only the latest request may answer: unsubscribing the previous one silences
  // its late page, error and completion alike.
  private loadPage() {
    this.pageRequest?.unsubscribe();
    this.loading = true;
    this.errorMessage = null;
    this.pageRequest = this.ownerService.getOwners(this.pageQuery()).subscribe({
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

  private pageQuery(): OwnerPageQuery {
    return {
      lastName: this.submittedLastName,
      page: this.pageIndex,
      size: this.pageSize,
      sort: `${this.sortKey},${this.sortDirection}`
    };
  }
}
