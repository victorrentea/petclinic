import { Component, OnInit } from '@angular/core';
import { OwnerService } from '../owner.service';
import { Owner } from '../owner';
import { ActivatedRoute, Router } from '@angular/router';
import { PageEvent } from '@angular/material/paginator';
import { finalize } from 'rxjs/operators';

const DEFAULT_SIZE = 10;
const DEFAULT_SORT = 'name,asc';
export const PAGE_SIZE_OPTIONS = [5, 10, 20];

// Logical sortable columns. "name" is expanded to lastName,firstName server-side.
export type SortColumn = 'name' | 'city';

@Component({
  selector: 'app-owner-list',
  templateUrl: './owner-list.component.html',
  styleUrls: ['./owner-list.component.css']
})
export class OwnerListComponent implements OnInit {
  errorMessage: string;
  owners: Owner[] = [];
  totalElements = 0;
  totalPages = 0;
  isOwnersDataReceived = false;

  // view state, mirrored to the URL query params
  lastName = '';
  page = 0;
  size = DEFAULT_SIZE;
  sortColumn: SortColumn = 'name';
  sortDir: 'asc' | 'desc' = 'asc';

  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private ownerService: OwnerService
  ) {}

  ngOnInit() {
    const params = this.route.snapshot.queryParamMap;
    this.lastName = params.get('lastName') ?? '';
    this.page = this.toInt(params.get('page'), 0);
    this.size = this.toInt(params.get('size'), DEFAULT_SIZE);
    this.applySort(params.get('sort') ?? DEFAULT_SORT);
    this.load();
  }

  get sort(): string {
    return `${this.sortColumn},${this.sortDir}`;
  }

  isSorted(column: SortColumn): boolean {
    return this.sortColumn === column;
  }

  // ▲/▼ for the active sort column, a faded ↕ hint on the other sortable columns.
  sortIndicator(column: SortColumn): string {
    if (this.sortColumn !== column) {
      return '↕';
    }
    if (this.sortDir === 'asc') {
      return '▲';
    }
    return '▼';
  }

  load() {
    this.ownerService.getOwners({
      page: this.page,
      size: this.size,
      sort: this.sort,
      lastName: this.lastName
    }).pipe(
      finalize(() => this.isOwnersDataReceived = true)
    ).subscribe(
      ownerPage => {
        // Clamp an out-of-range page (e.g. result set shrank) to the last valid page.
        if (ownerPage.content.length === 0 && ownerPage.totalElements > 0 && this.page > 0) {
          this.page = Math.max(0, ownerPage.totalPages - 1);
          this.syncUrl();
          this.load();
          return;
        }
        this.owners = ownerPage.content;
        this.totalElements = ownerPage.totalElements;
        this.totalPages = ownerPage.totalPages;
      },
      error => this.errorMessage = error as any
    );
  }

  search(lastName: string) {
    this.lastName = lastName ?? '';
    this.page = 0; // changing the search resets to the first page
    this.syncUrl();
    this.load();
  }

  toggleSort(column: SortColumn) {
    if (this.sortColumn === column) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDir = 'asc';
    }
    this.page = 0; // changing the sort resets to the first page
    this.syncUrl();
    this.load();
  }

  onPage(event: PageEvent) {
    if (event.pageSize !== this.size) {
      this.size = event.pageSize;
      this.page = 0; // changing page size resets to the first page
    } else {
      this.page = event.pageIndex;
    }
    this.syncUrl();
    this.load();
  }

  onSelect(owner: Owner) {
    this.router.navigate(['/owners', owner.id]);
  }

  addOwner() {
    this.router.navigate(['/owners/add']);
  }

  private syncUrl() {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        page: this.page,
        size: this.size,
        sort: this.sort,
        lastName: this.lastName || null
      },
      queryParamsHandling: 'merge'
    });
  }

  private applySort(sort: string) {
    const [column, dir] = sort.split(',');
    // Accept legacy "lastName" deep links too; everything else falls back to "name".
    this.sortColumn = column === 'city' ? 'city' : 'name';
    this.sortDir = dir === 'desc' ? 'desc' : 'asc';
  }

  private toInt(value: string | null, fallback: number): number {
    const parsed = Number(value);
    if (value === null || isNaN(parsed)) {
      return fallback;
    }
    return parsed;
  }
}
