import {Component, OnInit} from '@angular/core';
import {OwnerSearchParams, OwnerService, PagedResponse} from '../owner.service';
import {Owner} from '../owner';
import {Router} from '@angular/router';
import {Subject} from 'rxjs';
import {debounceTime, distinctUntilChanged, finalize} from 'rxjs/operators';

type OwnerSortField = 'name' | 'address' | 'city' | 'telephone';
type SortDirection = 'asc' | 'desc';

@Component({
  selector: 'app-owner-list',
  templateUrl: './owner-list.component.html',
  styleUrls: ['./owner-list.component.css']
})
export class OwnerListComponent implements OnInit {
  errorMessage: string;
  name: string;
  address: string;
  owners: Owner[];
  private readonly searchTerms = new Subject<{ name: string; address: string }>();
  isOwnersDataReceived: boolean = false;
  pageNumber = 0;
  pageSize = 10;
  totalPages = 0;
  totalElements = 0;
  readonly pageSizeOptions = [10, 20, 50];
  sortField: OwnerSortField = 'name';
  sortDirection: SortDirection = 'asc';
  private lastSearch: { name: string; address: string } = { name: '', address: '' };

  constructor(private router: Router, private ownerService: OwnerService) {

  }

  ngOnInit() {
    this.executeSearch(this.normalizeSearchValues());

    this.searchTerms.pipe(
      debounceTime(300),
      distinctUntilChanged((previous, current) =>
        previous.name === current.name && previous.address === current.address)
    ).subscribe((term) => this.startNewSearch(term));
  }

  onSelect(owner: Owner) {
    this.router.navigate(['/owners', owner.id]);
  }

  addOwner() {
    this.router.navigate(['/owners/add']);
  }

  queueSearch() {
    this.searchTerms.next(this.normalizeSearchValues());
  }

  searchOnBlur() {
    this.startNewSearch(this.normalizeSearchValues());
  }

  searchOnEnter() {
    this.startNewSearch(this.normalizeSearchValues());
  }

  sortBy(field: OwnerSortField) {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDirection = 'asc';
    }
    this.pageNumber = 0;
    this.executeSearch(this.lastSearch);
  }

  sortIndicator(field: OwnerSortField): string {
    if (this.sortField !== field) {
      return '';
    }
    return this.sortDirection === 'asc' ? '^' : 'v';
  }

  previousPage() {
    if (this.pageNumber > 0) {
      this.pageNumber -= 1;
      this.executeSearch(this.lastSearch);
    }
  }

  nextPage() {
    if (this.pageNumber + 1 < this.totalPages) {
      this.pageNumber += 1;
      this.executeSearch(this.lastSearch);
    }
  }

  changePageSize() {
    this.pageNumber = 0;
    this.executeSearch(this.lastSearch);
  }

  private startNewSearch(search: { name: string; address: string }) {
    this.pageNumber = 0;
    this.executeSearch(search);
  }

  private executeSearch(search: { name: string; address: string }) {
    this.lastSearch = search;
    const params: OwnerSearchParams = {
      name: search.name,
      address: search.address,
      page: this.pageNumber,
      size: this.pageSize,
      sort: this.buildSortParams()
    };
    this.ownerService.getOwners(params)
      .pipe(
        finalize(() => {
          this.isOwnersDataReceived = true;
        })
      )
      .subscribe(
        (page: PagedResponse<Owner>) => {
          this.owners = page.content;
          this.pageNumber = page.number;
          this.pageSize = page.size;
          this.totalElements = page.totalElements;
          this.totalPages = page.totalPages;
        },
        () => {
          this.owners = null;
        }
      );
  }

  private buildSortParams(): string[] {
    if (this.sortField === 'name') {
      return [
        `firstName,${this.sortDirection}`,
        `lastName,${this.sortDirection}`
      ];
    }
    return [`${this.sortField},${this.sortDirection}`];
  }

  private normalizeSearchTerm(rawTerm: string): string {
    return rawTerm.trim().split(' ').filter(Boolean).join(' ');
  }

  private normalizeSearchValues(): { name: string; address: string } {
    return {
      name: this.normalizeSearchTerm(this.name || ''),
      address: this.normalizeSearchTerm(this.address || '')
    };
  }


}
