import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { Sort } from '@angular/material/sort';
import { PageEvent } from '@angular/material/paginator';

import { Owner } from '../owner';
import { OwnerService, OwnersPage } from '../owner.service';

const DEFAULT_PAGE = 0;
const DEFAULT_SIZE = 10;
const DEFAULT_SORT = 'name,asc';

@Component({
  selector: 'app-owner-list',
  templateUrl: './owner-list.component.html',
  styleUrls: ['./owner-list.component.css']
})
export class OwnerListComponent implements OnInit, OnDestroy {
  errorMessage: string;
  owners: Owner[] = [];

  lastName = '';
  page = DEFAULT_PAGE;
  size = DEFAULT_SIZE;
  sort = DEFAULT_SORT;
  totalElements = 0;
  totalPages = 0;

  loading = false;
  initialLoadDone = false;

  private routeSub?: Subscription;
  private filterChanges$ = new Subject<string>();
  private filterSub?: Subscription;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private ownerService: OwnerService
  ) {}

  ngOnInit(): void {
    this.routeSub = this.route.queryParamMap.subscribe((qp) => {
      this.lastName = qp.get('lastName') ?? '';
      this.page = qp.has('page') ? Number(qp.get('page')) : DEFAULT_PAGE;
      this.size = qp.has('size') ? Number(qp.get('size')) : DEFAULT_SIZE;
      this.sort = qp.get('sort') ?? DEFAULT_SORT;
      this.fetch();
    });

    this.filterSub = this.filterChanges$
      .pipe(debounceTime(0), distinctUntilChanged())
      .subscribe((value) => {
        this.navigate({ lastName: value || null, page: 0 });
      });
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
    this.filterSub?.unsubscribe();
  }

  private fetch(): void {
    this.loading = true;
    this.ownerService
      .listOwners({
        lastName: this.lastName || undefined,
        page: this.page,
        size: this.size,
        sort: this.sort,
      })
      .subscribe({
        next: (response: OwnersPage) => {
          this.owners = response.content ?? [];
          this.totalElements = response.totalElements ?? 0;
          this.totalPages = response.totalPages ?? 0;
          this.loading = false;
          this.initialLoadDone = true;
        },
        error: (err) => {
          this.errorMessage = err as any;
          this.loading = false;
          this.initialLoadDone = true;
        },
      });
  }

  searchByLastName(value: string): void {
    this.filterChanges$.next(value);
  }

  onSortChange(sortState: Sort): void {
    if (!sortState.direction) {
      return;
    }
    this.navigate({ sort: `${sortState.active},${sortState.direction}`, page: 0 });
  }

  onPageChange(event: PageEvent): void {
    const patch: Params = { page: event.pageIndex };
    if (event.pageSize !== this.size) {
      patch.size = event.pageSize;
      patch.page = 0;
    }
    this.navigate(patch);
  }

  onSelect(owner: Owner): void {
    this.router.navigate(['/owners', owner.id]);
  }

  addOwner(): void {
    this.router.navigate(['/owners/add']);
  }

  get matSortActive(): string {
    return this.sort.split(',')[0];
  }

  get matSortDirection(): 'asc' | 'desc' {
    return this.sort.split(',')[1] === 'desc' ? 'desc' : 'asc';
  }

  private navigate(patch: Params): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: patch,
      queryParamsHandling: 'merge',
    });
  }
}
