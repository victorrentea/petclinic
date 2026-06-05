import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { Sort } from '@angular/material/sort';
import { PageEvent } from '@angular/material/paginator';
import { Subscription } from 'rxjs';
import { OwnerService } from '../owner.service';
import { OwnerListStateService } from '../owner-list-state.service';
import { OwnerListRow, Page } from '../owner-list-row';

const DEFAULT_SORT_COLUMN = 'name';
const DEFAULT_SORT_DIRECTION = 'asc';
const DEFAULT_PAGE = 0;
const DEFAULT_SIZE = 10;
const SORT_COLUMNS = ['name', 'address', 'city'];
const PAGE_HIDE_THRESHOLD = 5;

@Component({
  selector: 'app-owner-list',
  templateUrl: './owner-list.component.html',
  styleUrls: ['./owner-list.component.css'],
})
export class OwnerListComponent implements OnInit, OnDestroy {
  readonly pageSizeOptions = [5, 10, 20];

  rows: OwnerListRow[] = [];
  totalElements = 0;
  loading = false;

  lastName = '';
  page = DEFAULT_PAGE;
  size = DEFAULT_SIZE;
  sortColumn = DEFAULT_SORT_COLUMN;
  sortDirection: 'asc' | 'desc' = DEFAULT_SORT_DIRECTION;

  private subscription = new Subscription();

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private ownerService: OwnerService,
    private state: OwnerListStateService
  ) {}

  ngOnInit(): void {
    this.subscription.add(
      this.route.queryParamMap.subscribe((params) => {
        const hasAnyParam =
          params.has('lastName') ||
          params.has('page') ||
          params.has('size') ||
          params.has('sort');
        const remembered = this.state.remembered;
        const hasRememberedParams = remembered && Object.keys(remembered).length > 0;
        if (!hasAnyParam && hasRememberedParams) {
          this.router.navigate([], {
            queryParams: remembered,
            replaceUrl: true,
          });
          return;
        }

        this.applyParams(params.get('lastName'), params.get('page'),
          params.get('size'), params.get('sort'));
        this.state.remember(this.currentQueryParams());
        this.fetch();
      })
    );
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  get showPaginator(): boolean {
    return this.totalElements > PAGE_HIDE_THRESHOLD;
  }

  onSortChange(sort: Sort): void {
    // matSortDisableClear keeps a direction always present; defend anyway.
    const direction = sort.direction || DEFAULT_SORT_DIRECTION;
    this.navigateWith({ sort: sort.active + ',' + direction, page: 0 });
  }

  onPageChange(event: PageEvent): void {
    const sizeChanged = event.pageSize !== this.size;
    const nextPage = sizeChanged ? 0 : event.pageIndex;
    this.navigateWith({ page: nextPage, size: event.pageSize });
  }

  onSearch(lastName: string): void {
    this.navigateWith({ lastName, page: 0 });
  }

  onSelect(row: OwnerListRow): void {
    this.router.navigate(['/owners', row.id]);
  }

  addOwner(): void {
    this.router.navigate(['/owners/add']);
  }

  private navigateWith(changes: Params): void {
    const merged: Params = {
      lastName: this.lastName || null,
      page: this.page,
      size: this.size,
      sort: this.sortColumn + ',' + this.sortDirection,
      ...changes,
    };
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: this.stripDefaults(merged),
    });
  }

  private applyParams(
    lastName: string | null,
    page: string | null,
    size: string | null,
    sort: string | null
  ): void {
    this.lastName = lastName || '';
    this.page = this.parsePage(page);
    this.size = this.parseSize(size);
    this.applySort(sort);
  }

  private applySort(sort: string | null): void {
    let column = DEFAULT_SORT_COLUMN;
    let direction: 'asc' | 'desc' = DEFAULT_SORT_DIRECTION;
    if (sort) {
      const [rawColumn, rawDirection] = sort.split(',');
      if (SORT_COLUMNS.includes(rawColumn)) {
        column = rawColumn;
      }
      if (rawDirection === 'desc') {
        direction = 'desc';
      }
    }
    this.sortColumn = column;
    this.sortDirection = direction;
  }

  private parsePage(value: string | null): number {
    const parsed = Number(value);
    if (!value || !Number.isInteger(parsed) || parsed < 0) {
      return DEFAULT_PAGE;
    }
    return parsed;
  }

  private parseSize(value: string | null): number {
    const parsed = Number(value);
    if (!value || !this.pageSizeOptions.includes(parsed)) {
      return DEFAULT_SIZE;
    }
    return parsed;
  }

  private currentQueryParams(): Params {
    return this.stripDefaults({
      lastName: this.lastName || null,
      page: this.page,
      size: this.size,
      sort: this.sortColumn + ',' + this.sortDirection,
    });
  }

  private stripDefaults(params: Params): Params {
    const result: Params = {};
    if (params['lastName']) {
      result['lastName'] = params['lastName'];
    }
    if (Number(params['page']) !== DEFAULT_PAGE) {
      result['page'] = params['page'];
    }
    if (Number(params['size']) !== DEFAULT_SIZE) {
      result['size'] = params['size'];
    }
    const defaultSort = DEFAULT_SORT_COLUMN + ',' + DEFAULT_SORT_DIRECTION;
    if (params['sort'] && params['sort'] !== defaultSort) {
      result['sort'] = params['sort'];
    }
    return result;
  }

  private fetch(): void {
    this.loading = true;
    const sort = this.sortColumn + ',' + this.sortDirection;
    this.ownerService.getOwners(this.lastName, this.page, this.size, sort)
      .subscribe({
        next: (pageResult) => this.applyPage(pageResult),
        error: () => {
          this.rows = [];
          this.totalElements = 0;
          this.loading = false;
        },
      });
  }

  private applyPage(pageResult: Page<OwnerListRow>): void {
    this.rows = pageResult.content;
    this.totalElements = pageResult.totalElements;
    this.loading = false;
  }
}
