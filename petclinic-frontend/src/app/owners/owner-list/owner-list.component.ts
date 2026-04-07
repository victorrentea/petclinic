import {Component, OnDestroy, OnInit} from '@angular/core';
import {OwnerService} from '../owner.service';
import {Owner} from '../owner';
import {ActivatedRoute, Router} from '@angular/router';
import {merge, Subject} from 'rxjs';
import {debounceTime, distinctUntilChanged, map, takeUntil} from 'rxjs/operators';
import {OwnerSearchRequest} from '../owner-page';

@Component({
  selector: 'app-owner-list',
  templateUrl: './owner-list.component.html',
  styleUrls: ['./owner-list.component.css']
})
export class OwnerListComponent implements OnInit, OnDestroy {
  readonly pageSizeOptions: number[] = [2, 10, 20, 50];
  readonly defaultSort = 'id,asc';

  errorMessage: string;
  query = '';
  owners: Owner[] = [];
  isOwnersDataReceived = false;
  page = 0;
  size = 20;
  sort = this.defaultSort;
  totalPages = 0;
  totalElements = 0;
  pageLinks: Array<number | 'ellipsis'> = [];

  private searchTerms = new Subject<string>();
  private blurTerms = new Subject<string>();
  private readonly destroy$ = new Subject<void>();

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private ownerService: OwnerService
  ) {

  }

  ngOnInit() {
    this.route.queryParamMap
      .pipe(takeUntil(this.destroy$))
      .subscribe((params) => {
        this.page = this.parseNonNegativeNumber(params.get('page'), 0);
        this.size = this.parsePageSize(params.get('size'));
        this.sort = params.get('sort') || this.defaultSort;
        this.query = (params.get('q') || '').trim();
        this.fetchOwners();
      });

    merge(
      this.searchTerms.pipe(debounceTime(500)),
      this.blurTerms
    ).pipe(
      map((term) => term ? term.trim() : ''),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe((term) => {
      this.updateQueryParams({q: term, page: 0});
    });
  }

  onSelect(owner: Owner) {
    this.router.navigate(['/owners', owner.id]);
  }

  addOwner() {
    this.router.navigate(['/owners/add']);
  }

  onSearchTermChange(query: string) {
    this.searchTerms.next(query);
  }

  onSearchBlur(query: string) {
    this.blurTerms.next(query);
  }

  onPageSizeChange(size: number) {
    this.updateQueryParams({size, page: 0});
  }

  onPageSelect(page: number) {
    if (page < 0 || page >= this.totalPages || page === this.page) {
      return;
    }
    this.updateQueryParams({page});
  }

  onPageLinkClick(item: number | 'ellipsis') {
    if (item === 'ellipsis') {
      return;
    }
    this.onPageSelect(item);
  }

  previousPage() {
    this.onPageSelect(this.page - 1);
  }

  nextPage() {
    this.onPageSelect(this.page + 1);
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    this.searchTerms.complete();
    this.blurTerms.complete();
  }

  private fetchOwners() {
    this.isOwnersDataReceived = false;
    this.ownerService.getOwnersPage(this.getRequestState())
      .pipe(takeUntil(this.destroy$))
      .subscribe(
        page => {
          this.owners = page.content;
          this.totalPages = page.totalPages;
          this.totalElements = page.totalElements;
          this.page = page.number;
          this.size = page.size;
          this.pageLinks = this.buildPageLinks(page.totalPages, page.number);
          this.errorMessage = null;
          this.isOwnersDataReceived = true;
        },
        error => {
          this.errorMessage = error as any;
          this.isOwnersDataReceived = true;
        }
      );
  }

  private getRequestState(): OwnerSearchRequest {
    return {
      page: this.page,
      size: this.size,
      sort: this.sort,
      q: this.query
    };
  }

  private updateQueryParams(partial: Partial<OwnerSearchRequest>) {
    const next = {
      page: partial.page ?? this.page,
      size: partial.size ?? this.size,
      sort: partial.sort ?? this.sort,
      q: partial.q ?? this.query
    };
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: next,
      queryParamsHandling: 'merge'
    });
  }

  private parseNonNegativeNumber(value: string | null, fallback: number): number {
    if (value === null) {
      return fallback;
    }
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
  }

  private parsePageSize(value: string | null): number {
    const parsed = this.parseNonNegativeNumber(value, 20);
    return this.pageSizeOptions.includes(parsed) ? parsed : 20;
  }

  private buildPageLinks(totalPages: number, currentPage: number): Array<number | 'ellipsis'> {
    if (totalPages <= 0) {
      return [];
    }

    const corePages = new Set<number>();
    this.addRange(corePages, 0, Math.min(2, totalPages - 1));
    this.addRange(corePages, Math.max(0, currentPage - 2), Math.min(totalPages - 1, currentPage + 2));
    this.addRange(corePages, Math.max(0, totalPages - 2), totalPages - 1);

    const sortedCorePages = Array.from(corePages).sort((a, b) => a - b);
    for (let i = 0; i < sortedCorePages.length - 1; i++) {
      const left = sortedCorePages[i];
      const right = sortedCorePages[i + 1];
      if (right - left > 1) {
        corePages.add(Math.floor((left + right) / 2));
      }
    }

    const pages = Array.from(corePages).sort((a, b) => a - b);
    const result: Array<number | 'ellipsis'> = [];
    for (const page of pages) {
      const previous = result.length > 0 ? result[result.length - 1] : null;
      if (typeof previous === 'number' && page - previous > 1) {
        result.push('ellipsis');
      }
      result.push(page);
    }
    return result;
  }

  private addRange(target: Set<number>, start: number, end: number) {
    for (let index = start; index <= end; index++) {
      target.add(index);
    }
  }

}
