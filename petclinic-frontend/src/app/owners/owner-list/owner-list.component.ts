import {Component, OnInit, OnDestroy} from '@angular/core';
import {OwnerService} from '../owner.service';
import {Owner} from '../owner';
import {ActivatedRoute, Router} from '@angular/router';
import {Subject} from 'rxjs';
import {takeUntil} from 'rxjs/operators';
import {Sort} from '@angular/material/sort';
import {PageEvent} from '@angular/material/paginator';

@Component({
  selector: 'app-owner-list',
  templateUrl: './owner-list.component.html',
  styleUrls: ['./owner-list.component.css']
})
export class OwnerListComponent implements OnInit, OnDestroy {
  displayedColumns = ['name', 'address', 'city', 'telephone', 'pets'];

  owners: Owner[] = [];
  totalElements = 0;

  // URL-driven state — read from queryParams on every navigation
  lastName = '';
  page = 0;
  size = 10;
  sortActive = 'name';
  sortDirection: 'asc' | 'desc' = 'asc';

  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private ownerService: OwnerService
  ) {}

  ngOnInit() {
    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        this.lastName = params['lastName'] ?? '';
        this.page = this.parseIntParam(params['page'], 0, 0);
        this.size = this.parseIntParam(params['size'], 10, 1);
        this.sortActive = params['sort'] ?? 'name';
        this.sortDirection = params['direction'] === 'desc' ? 'desc' : 'asc';
        this.loadOwners();
      });
  }

  /** A malformed URL param (NaN, decimal, below min) must not reach the backend as `NaN` → 400. */
  private parseIntParam(value: unknown, fallback: number, min: number): number {
    const n = Number(value);
    return Number.isInteger(n) && n >= min ? n : fallback;
  }

  private loadOwners() {
    this.ownerService.getOwners({
      lastName: this.lastName || undefined,
      page: this.page,
      size: this.size,
      sort: this.sortActive,
      direction: this.sortDirection
    }).pipe(takeUntil(this.destroy$))
      .subscribe(ownerPage => {
        this.owners = ownerPage.content;
        this.totalElements = ownerPage.page.totalElements;
      });
  }

  onSort(sortEvent: Sort) {
    this.navigate({ sort: sortEvent.active, direction: sortEvent.direction || 'asc', page: 0 });
  }

  onPage(pageEvent: PageEvent) {
    this.navigate({ page: pageEvent.pageIndex, size: pageEvent.pageSize });
  }

  search() {
    this.navigate({ lastName: this.lastName, page: 0 });
  }

  private navigate(params: object) {
    this.router.navigate([], {
      queryParams: params,
      queryParamsHandling: 'merge'
    });
  }

  onSelect(owner: Owner) {
    this.router.navigate(['/owners', owner.id]);
  }

  addOwner() {
    this.router.navigate(['/owners/add']);
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
