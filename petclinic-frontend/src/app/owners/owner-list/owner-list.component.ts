import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { OwnerPage } from '../owner-page';
import { OwnerPaginationService } from '../owner-pagination.service';

type SortColumn = 'name' | 'city';
type SortDir = 'asc' | 'desc';

@Component({
  selector: 'app-owner-list',
  templateUrl: './owner-list.component.html',
  styleUrls: ['./owner-list.component.css']
})
export class OwnerListComponent implements OnInit, OnDestroy {
  errorMessage = '';
  searchText = '';
  currentPage: OwnerPage | null = null;
  isLoading = false;
  pageIndex = 0;
  pageSize = 20;
  sortColumn: SortColumn = 'name';
  sortDir: SortDir = 'asc';

  private searchSubject = new Subject<string>();
  private subscription = new Subscription();
  private resizeDebounce: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private router: Router,
    private paginationService: OwnerPaginationService
  ) {}

  ngOnInit(): void {
    this.subscription.add(
      this.paginationService.currentPage$.subscribe(page => {
        this.currentPage = page;
        this.isLoading = false;
      })
    );

    this.subscription.add(
      this.searchSubject.pipe(
        debounceTime(300),
        distinctUntilChanged()
      ).subscribe(_q => {
        this.paginationService.clearCache();
        this.pageIndex = 0;
        this.loadCurrentPage();
      })
    );

    this.pageSize = this.paginationService.calculatePageSize();
    this.loadCurrentPage();
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
    this.searchSubject.complete();
    if (this.resizeDebounce) { clearTimeout(this.resizeDebounce); }
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    if (this.resizeDebounce) { clearTimeout(this.resizeDebounce); }
    this.resizeDebounce = setTimeout(() => {
      this.pageSize = this.paginationService.calculatePageSize();
      this.paginationService.clearCache();
      this.pageIndex = 0;
      this.loadCurrentPage();
    }, 1000);
  }

  onSearchTermChange(searchText: string): void {
    this.searchText = searchText;
    this.searchSubject.next(searchText);
  }

  onSortClick(column: SortColumn): void {
    if (this.sortColumn === column) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDir = 'asc';
    }
    this.paginationService.clearCache();
    this.pageIndex = 0;
    this.loadCurrentPage();
  }

  goToPage(page: number): void {
    this.pageIndex = page;
    this.loadCurrentPage();
  }

  onSelect(owner: any): void {
    this.router.navigate(['/owners', owner.id]);
  }

  addOwner(): void {
    this.router.navigate(['/owners/add']);
  }

  get totalPages(): number {
    return this.currentPage?.totalPages ?? 1;
  }

  get sortParams(): string[] {
    if (this.sortColumn === 'name') {
      return [`firstName,${this.sortDir}`, `lastName,${this.sortDir}`];
    }
    return [`city,${this.sortDir}`];
  }

  sortIndicator(column: SortColumn): string {
    if (this.sortColumn !== column) { return ''; }
    return this.sortDir === 'asc' ? '↑' : '↓';
  }

  private loadCurrentPage(): void {
    this.isLoading = true;
    this.paginationService.loadPage(this.pageIndex, this.pageSize, this.sortParams, this.searchText);
  }
}
