import {Component, OnInit} from '@angular/core';
import { OwnerService } from '../owner.service';
import { Owner } from '../owner';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { debounceTime, finalize } from 'rxjs/operators';

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
  pageIndex: number = 0;
  pageSize: number = 10;
  totalPages: number = 0;
  totalElements: number = 0;
  sortColumn: OwnerSortColumn = null;
  sortDirection: OwnerSortDirection = 'asc';

  private readonly searchTerms = new Subject<void>();
  isOwnersDataReceived: boolean = false;

  constructor(private router: Router, private ownerService: OwnerService) {

  }

  ngOnInit() {
    this.searchTerms.pipe(
      debounceTime(300)
    ).subscribe(() => this.executeSearch());

    this.loadOwners();
  }

  onSelect(owner: Owner) {
    this.router.navigate(['/owners', owner.id]);
  }

  addOwner() {
    this.router.navigate(['/owners/add']);
  }

  queueSearch() {
    this.searchTerms.next();
  }

  searchOnBlur() {
    this.executeSearch();
  }

  searchOnEnter() {
    this.executeSearch();
  }

  sortBy(column: OwnerSortColumn) {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }

    this.pageIndex = 0;
    this.loadOwners();
  }

  sortIndicator(column: OwnerSortColumn): string {
    if (this.sortColumn !== column) {
      return '';
    }

    return this.sortDirection === 'asc' ? ' (asc)' : ' (desc)';
  }

  previousPage() {
    if (this.pageIndex === 0) {
      return;
    }

    this.pageIndex -= 1;
    this.loadOwners();
  }

  nextPage() {
    if (this.pageIndex + 1 >= this.totalPages) {
      return;
    }

    this.pageIndex += 1;
    this.loadOwners();
  }

  changePageSize() {
    this.pageIndex = 0;
    this.loadOwners();
  }

  private executeSearch() {
    this.pageIndex = 0;
    this.loadOwners();
  }

  private loadOwners() {
    const normalizedName = this.normalizeSearchTerm(this.name || '');
    const normalizedAddress = this.normalizeSearchTerm(this.address || '');
    const sortParams = this.buildSortParams();

    this.ownerService.getOwners({
      name: normalizedName,
      address: normalizedAddress,
      page: this.pageIndex,
      size: this.pageSize,
      sort: sortParams
    }).pipe(
      finalize(() => {
        this.isOwnersDataReceived = true;
      })
    ).subscribe(
      (page) => {
        this.owners = page.content;
        this.totalElements = page.totalElements;
        this.totalPages = page.totalPages;
      },
      () => {
        this.owners = null;
      }
    );
  }

  private normalizeSearchTerm(rawTerm: string): string {
    return rawTerm.trim().split(' ').filter(Boolean).join(' ');
  }

  private buildSortParams(): string[] {
    if (!this.sortColumn) {
      return [];
    }

    const direction = this.sortDirection;

    if (this.sortColumn === 'name') {
      return [`lastName,${direction}`, `firstName,${direction}`];
    }

    return [`${this.sortColumn},${direction}`];
  }


}

type OwnerSortColumn = 'name' | 'address' | 'city' | 'telephone' | null;
type OwnerSortDirection = 'asc' | 'desc';
