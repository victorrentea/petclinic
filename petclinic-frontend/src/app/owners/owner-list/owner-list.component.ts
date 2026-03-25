import {Component, OnDestroy, OnInit} from '@angular/core';
import {OwnerService} from '../owner.service';
import {Owner} from '../owner';
import {Router} from '@angular/router';
import { finalize } from 'rxjs/operators';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

@Component({
  selector: 'app-owner-list',
  templateUrl: './owner-list.component.html',
  styleUrls: ['./owner-list.component.css']
})
export class OwnerListComponent implements OnInit, OnDestroy {
  errorMessage: string | null = null;
  lastName: string = '';
  owners: Owner[] = [];

  // 8.1 — pagination state
  currentPage = 0;
  pageSize = 10;
  totalPages = 0;
  loading = false;
  previousOwners: Owner[] | null = null;
  lastRequest: { page: number; size: number; lastName: string } | null = null;

  private readonly searchTerms = new Subject<string>();
  private searchSubscription: Subscription;

  constructor(private router: Router, private ownerService: OwnerService) {}

  ngOnInit() {
    // 8.4 — debounced search resets page to 0
    this.searchSubscription = this.searchTerms.pipe(
      debounceTime(500),
      distinctUntilChanged()
    ).subscribe((term) => {
      this.currentPage = 0;
      this.loadPage(0, this.pageSize, term);
    });

    // 8.2 — initial load
    this.loadPage(0, this.pageSize, '');
  }

  // 8.2 — single unified load method
  loadPage(page: number, size: number, lastName: string): void {
    this.loading = true;
    this.previousOwners = this.owners;
    this.lastRequest = { page, size, lastName };

    this.ownerService.getOwnersPaged(page, size, lastName || undefined)
      .pipe(finalize(() => this.loading = false))
      .subscribe(
        (result) => {
          this.owners = result.owners;
          this.totalPages = result.totalPages;
          this.currentPage = result.currentPage;
          this.errorMessage = null;
        },
        // 8.3 — error handling
        () => {
          this.errorMessage = 'Failed to load owners. Please try again.';
          this.owners = this.previousOwners ?? [];
        }
      );
  }

  // 8.4
  onSearchInput() {
    this.searchTerms.next(this.lastName || '');
  }

  onSearchBlur() {
    this.currentPage = 0;
    this.loadPage(0, this.pageSize, this.lastName || '');
  }

  // 8.5
  onPageChange(page: number): void {
    this.loadPage(page, this.pageSize, this.lastName || '');
  }

  onPageSizeChange(size: number): void {
    this.pageSize = size;
    this.currentPage = 0;
    this.loadPage(0, size, this.lastName || '');
  }

  // 8.6
  retry(): void {
    if (this.lastRequest) {
      this.errorMessage = null;
      this.loadPage(this.lastRequest.page, this.lastRequest.size, this.lastRequest.lastName);
    }
  }

  onSelect(owner: Owner) {
    this.router.navigate(['/owners', owner.id]);
  }

  addOwner() {
    this.router.navigate(['/owners/add']);
  }

  ngOnDestroy() {
    if (this.searchSubscription) {
      this.searchSubscription.unsubscribe();
    }
    this.searchTerms.complete();
  }
}
