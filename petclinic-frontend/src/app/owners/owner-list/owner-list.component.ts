import {Component, OnDestroy, OnInit} from '@angular/core';
import {ActivatedRoute, Params, Router} from '@angular/router';
import {Subject, Subscription} from 'rxjs';
import {debounceTime, finalize, takeUntil} from 'rxjs/operators';

import {Owner, OwnerPage} from '../owner';
import {OwnerService} from '../owner.service';

@Component({
  selector: 'app-owner-list',
  templateUrl: './owner-list.component.html',
  styleUrls: ['./owner-list.component.css']
})
export class OwnerListComponent implements OnInit, OnDestroy {
  errorMessage: string;
  query: string = '';
  page: number = 0;
  size: number = 10;
  sort: string = 'name,asc';
  ownerPage: OwnerPage | null = null;
  isOwnersDataReceived: boolean = false;

  private readonly destroy$ = new Subject<void>();
  private readonly querySubject = new Subject<void>();
  private subscription: Subscription;

  constructor(
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private ownerService: OwnerService
  ) {}

  get owners(): Owner[] {
    return this.ownerPage?.content ?? [];
  }

  get totalPages(): number {
    return this.ownerPage?.totalPages ?? 0;
  }

  get pageNumbers(): number[] {
    const lastPage = this.totalPages - 1;
    const pages = [
      0,
      lastPage,
      this.page,
      this.page - 1,
      this.page + 1,
      Math.floor(this.page / 2),
      Math.floor((this.page + lastPage) / 2)
    ];

    return [...new Set(pages.filter(page => page >= 0 && page < this.totalPages))]
      .sort((left, right) => left - right);
  }

  ngOnInit() {
    this.querySubject.pipe(
      debounceTime(300),
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.navigateWithQueryParams(0, this.size, this.sort);
    });

    this.subscription = this.activatedRoute.queryParams.subscribe((params: Params) => {
      this.query = params['query'] ?? '';
      this.page = this.parseNumber(params['page'], 0);
      this.size = this.parseNumber(params['size'], 10);
      this.sort = params['sort'] ?? 'name,asc';
      this.isOwnersDataReceived = false;

      this.ownerService.searchOwners(this.query, this.page, this.size, this.sort).pipe(
        finalize(() => this.isOwnersDataReceived = true)
      ).subscribe(
        ownerPage => this.ownerPage = ownerPage,
        error => this.errorMessage = error as string
      );
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  onQueryChange() {
    this.querySubject.next();
  }

  clearSearch() {
    this.query = '';
    this.onQueryChange();
  }

  onSizeChange() {
    this.navigateWithQueryParams(0, this.size, this.sort);
  }

  goToPage(page: number) {
    this.navigateWithQueryParams(page, this.size, this.sort);
  }

  toggleSort(field: string) {
    let sort = `${field},asc`;

    if (this.sort === `${field},asc`) {
      sort = `${field},desc`;
    } else if (this.sort === `${field},desc`) {
      sort = `${field},asc`;
    }

    this.navigateWithQueryParams(0, this.size, sort);
  }

  onSelect(owner: Owner) {
    this.router.navigate(['/owners', owner.id]);
  }

  addOwner() {
    this.router.navigate(['/owners/add']);
  }

  private navigateWithQueryParams(page: number, size: number, sort: string) {
    this.router.navigate([], {
      relativeTo: this.activatedRoute,
      queryParams: { query: this.query, page, size, sort },
      queryParamsHandling: 'merge'
    });
  }

  private parseNumber(value: string | undefined, fallback: number): number {
    const parsedValue = Number.parseInt(value ?? '', 10);
    return Number.isNaN(parsedValue) ? fallback : parsedValue;
  }
}
