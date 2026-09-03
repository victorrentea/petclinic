import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { PageEvent } from '@angular/material/paginator';
import { finalize } from 'rxjs/operators';
import { OwnerService } from '../owner.service';
import {
  DEFAULT_OWNER_CRITERIA,
  OwnerPage,
  OwnerRow,
  OwnerSearchCriteria,
  OwnerSortField,
  OWNER_PAGE_SIZES,
  SortDirection
} from '../owner-row';

@Component({
  selector: 'app-owner-list',
  templateUrl: './owner-list.component.html',
  styleUrls: ['./owner-list.component.css']
})
export class OwnerListComponent implements OnInit {
  readonly pageSizes = OWNER_PAGE_SIZES;

  errorMessage: string;
  lastName: string = DEFAULT_OWNER_CRITERIA.lastName;
  owners: OwnerRow[];
  criteria: OwnerSearchCriteria = { ...DEFAULT_OWNER_CRITERIA };
  totalElements = 0;
  isOwnersDataReceived = false;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private ownerService: OwnerService
  ) {}

  /**
   * The URL is the single source of truth for the grid: a reload, the back button and a shared
   * link all land on the same page, and an e2e scenario can navigate straight to it.
   */
  ngOnInit() {
    this.route.queryParams.subscribe((params: Params) => {
      this.criteria = {
        lastName: params['lastName'] ?? DEFAULT_OWNER_CRITERIA.lastName,
        page: Number(params['page'] ?? DEFAULT_OWNER_CRITERIA.page),
        size: Number(params['size'] ?? DEFAULT_OWNER_CRITERIA.size),
        sort: (params['sort'] ?? DEFAULT_OWNER_CRITERIA.sort) as OwnerSortField,
        dir: (params['dir'] ?? DEFAULT_OWNER_CRITERIA.dir) as SortDirection
      };
      this.lastName = this.criteria.lastName;
      this.loadPage();
    });
  }

  searchByLastName(lastName: string) {
    this.navigate({ lastName: lastName ?? '', page: 0 });
  }

  /** A second click on the same column flips the direction; a different column starts ascending. */
  sortBy(field: OwnerSortField) {
    const dir: SortDirection =
      this.criteria.sort === field && this.criteria.dir === 'ASC' ? 'DESC' : 'ASC';
    this.navigate({ sort: field, dir, page: 0 });
  }

  onPage(event: PageEvent) {
    const sizeChanged = event.pageSize !== this.criteria.size;
    this.navigate({ size: event.pageSize, page: sizeChanged ? 0 : event.pageIndex });
  }

  sortArrow(field: OwnerSortField): string {
    if (this.criteria.sort !== field) {
      return '';
    }
    return this.criteria.dir === 'ASC' ? '▲' : '▼';
  }

  onSelect(owner: OwnerRow) {
    this.router.navigate(['/owners', owner.id]);
  }

  addOwner() {
    this.router.navigate(['/owners/add']);
  }

  private navigate(changes: Partial<OwnerSearchCriteria>) {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { ...this.criteria, ...changes }
    });
  }

  private loadPage() {
    this.ownerService
      .findOwners(this.criteria)
      .pipe(finalize(() => (this.isOwnersDataReceived = true)))
      .subscribe(
        (page: OwnerPage) => {
          this.owners = page.content;
          this.totalElements = page.page?.totalElements ?? 0;
        },
        error => (this.errorMessage = error as any)
      );
  }
}
