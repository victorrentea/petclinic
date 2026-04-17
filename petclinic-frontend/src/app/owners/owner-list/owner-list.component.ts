import {Component, HostListener, OnDestroy, OnInit} from '@angular/core';
import {Router} from '@angular/router';
import {Subject, Subscription} from 'rxjs';
import {debounceTime, distinctUntilChanged} from 'rxjs/operators';
import {Owner} from '../owner';
import {OwnerPage} from '../owner-page';
import {OwnerPaginationService, PageRequest} from '../owner-pagination.service';

const ROW_HEIGHT_PX = 38;
const TABLE_CHROME_PX = 432;

@Component({
  selector: 'app-owner-list',
  templateUrl: './owner-list.component.html',
  styleUrls: ['./owner-list.component.css']
})
export class OwnerListComponent implements OnInit, OnDestroy {
  errorMessage = '';
  searchText = '';
  owners: Owner[] = [];
  isLoading = false;

  currentPageNumber = 0;
  pageSize = 10;
  totalPages = 0;
  totalElements = 0;

  sortColumn: 'name' | 'city' = 'name';
  sortDir: 'asc' | 'desc' = 'asc';

  private searchSubject = new Subject<string>();
  private resizeSubject = new Subject<void>();
  private subs: Subscription[] = [];

  constructor(private router: Router, private paginationService: OwnerPaginationService) {}

  ngOnInit() {
    this.pageSize = this.calculatePageSize();

    this.subs.push(this.paginationService.currentPage$.subscribe((page: OwnerPage | null) => {
      if (page) {
        this.owners = page.content;
        this.currentPageNumber = page.number;
        this.totalPages = page.totalPages;
        this.totalElements = page.totalElements;
      }
    }));

    this.subs.push(this.paginationService.isLoading$.subscribe(v => this.isLoading = v));

    this.loadCurrentPage();

    this.subs.push(this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(q => {
      this.searchText = q;
      this.currentPageNumber = 0;
      this.paginationService.clearCache();
      this.loadCurrentPage();
    }));

    this.subs.push(this.resizeSubject.pipe(
      debounceTime(1000)
    ).subscribe(() => {
      const newSize = this.calculatePageSize();
      if (newSize !== this.pageSize) {
        this.pageSize = newSize;
        this.currentPageNumber = 0;
        this.paginationService.clearCache();
        this.loadCurrentPage();
      }
    }));
  }

  ngOnDestroy() {
    this.searchSubject.complete();
    this.resizeSubject.complete();
    this.subs.forEach(s => s.unsubscribe());
  }

  @HostListener('window:resize')
  onWindowResize() {
    this.resizeSubject.next();
  }

  calculatePageSize(): number {
    return Math.max(5, Math.floor((window.innerHeight - TABLE_CHROME_PX) / ROW_HEIGHT_PX));
  }

  private buildSort(): string[] {
    if (this.sortColumn === 'name') {
      return [`firstName,${this.sortDir}`, `lastName,${this.sortDir}`];
    }
    return [`city,${this.sortDir}`];
  }

  private loadCurrentPage(): void {
    const req: PageRequest = {
      page: this.currentPageNumber,
      size: this.pageSize,
      sort: this.buildSort(),
      q: this.searchText
    };
    this.paginationService.loadPage(req);
  }

  onSortColumn(column: 'name' | 'city') {
    if (this.sortColumn === column) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDir = 'asc';
    }
    this.currentPageNumber = 0;
    this.paginationService.clearCache();
    this.loadCurrentPage();
  }

  onSelect(owner: Owner) {
    this.router.navigate(['/owners', owner.id]);
  }

  addOwner() {
    this.router.navigate(['/owners/add']);
  }

  onSearchTermChange(searchText: string) {
    this.searchSubject.next(searchText);
  }

  goToPage(page: number) {
    if (page < 0 || page >= this.totalPages) { return; }
    this.currentPageNumber = page;
    this.loadCurrentPage();
  }

  get isFirstPage(): boolean { return this.currentPageNumber === 0; }
  get isLastPage(): boolean { return this.currentPageNumber >= this.totalPages - 1; }
}

