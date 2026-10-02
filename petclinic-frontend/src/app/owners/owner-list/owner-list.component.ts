import { Component, OnDestroy, OnInit } from '@angular/core';
import { OwnerService } from '../owner.service';
import { Owner } from '../owner';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { PageEvent } from '@angular/material/paginator';
import { Sort } from '@angular/material/sort';
import { OwnerPage, OwnerSort } from '../owner-page';

type OwnerSortKey = 'name' | 'city';
type OwnerSortDirection = 'asc' | 'desc';

@Component({
  selector: 'app-owner-list',
  templateUrl: './owner-list.component.html',
  styleUrls: ['./owner-list.component.css']
})
export class OwnerListComponent implements OnInit, OnDestroy {
  readonly pageSizeOptions = [5, 10, 20];

  lastNameDraft = '';
  submittedLastName = '';
  pageIndex = 0;
  pageSize = 10;
  sortKey: OwnerSortKey = 'name';
  sortDirection: OwnerSortDirection = 'asc';

  owners: Owner[] = [];
  totalElements = 0;
  answeredLastName: string | null = null;
  loading = false;
  errorMessage: string | null = null;

  private request?: Subscription;

  constructor(private router: Router, private ownerService: OwnerService) {
  }

  get noMatches(): boolean {
    return !this.loading && !this.errorMessage && this.answeredLastName !== null && this.totalElements === 0;
  }

  ngOnInit() {
    this.load();
  }

  ngOnDestroy() {
    this.request?.unsubscribe();
  }

  onSelect(owner: Owner) {
    this.router.navigate(['/owners', owner.id]);
  }

  addOwner() {
    this.router.navigate(['/owners/add']);
  }

  search() {
    this.submittedLastName = this.lastNameDraft ?? '';
    this.pageIndex = 0;
    this.load();
  }

  onPage(event: PageEvent) {
    const sizeChanged = event.pageSize !== this.pageSize;
    this.pageSize = event.pageSize;
    this.pageIndex = sizeChanged ? 0 : event.pageIndex;
    this.load();
  }

  onSort(sort: Sort) {
    this.sortKey = sort.active as OwnerSortKey;
    this.sortDirection = sort.direction || 'asc';
    this.pageIndex = 0;
    this.load();
  }

  // Unsubscribing first means an older request can no longer touch rows, total, loading or error
  private load() {
    this.request?.unsubscribe();
    this.loading = true;
    const lastName = this.submittedLastName;
    this.request = this.ownerService.getOwners({
      lastName,
      page: this.pageIndex,
      size: this.pageSize,
      sort: `${this.sortKey},${this.sortDirection}` as OwnerSort,
    }).subscribe({
      next: (page) => this.showPage(page, lastName),
      error: (error) => this.showError(error),
    });
  }

  private showPage(page: OwnerPage, lastName: string) {
    this.owners = page.content;
    this.totalElements = page.totalElements;
    this.answeredLastName = lastName;
    this.errorMessage = null;
    this.loading = false;
  }

  private showError(error: unknown) {
    this.owners = [];
    this.totalElements = 0;
    this.errorMessage = String(error instanceof Error ? error.message : error);
    this.loading = false;
  }
}
