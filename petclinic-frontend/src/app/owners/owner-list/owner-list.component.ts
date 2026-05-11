import { Component, OnInit, OnDestroy } from '@angular/core';
import { OwnerService, OwnerPage, SortField, SortDir } from '../owner.service';
import { Owner } from '../owner';
import { Router } from '@angular/router';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, switchMap } from 'rxjs/operators';

@Component({
  selector: 'app-owner-list',
  templateUrl: './owner-list.component.html',
  styleUrls: ['./owner-list.component.css']
})
export class OwnerListComponent implements OnInit, OnDestroy {
  errorMessage: string = '';
  searchTerm: string = '';
  owners: Owner[] = [];
  totalElements: number = 0;
  isOwnersDataReceived: boolean = false;

  currentPage: number = 0;
  pageSize: number = 10;
  sortField: SortField = 'NAME';
  sortDir: SortDir = 'ASC';

  private searchSubject = new Subject<string>();
  private subscription = new Subscription();

  constructor(private router: Router, private ownerService: OwnerService) {}

  ngOnInit() {
    const debounced$ = this.searchSubject.pipe(
      debounceTime(300),
      switchMap(term => this.ownerService.searchOwnersPaged(
        term, this.currentPage, this.pageSize, this.sortField, this.sortDir
      ))
    );

    this.subscription.add(
      debounced$.subscribe(page => this.handlePage(page))
    );

    this.fetchPage();
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  private fetchPage() {
    this.isOwnersDataReceived = false;
    this.ownerService
      .searchOwnersPaged(this.searchTerm, this.currentPage, this.pageSize, this.sortField, this.sortDir)
      .subscribe(page => {
        this.handlePage(page);
        this.isOwnersDataReceived = true;
      }, error => {
        this.errorMessage = error as string;
        this.isOwnersDataReceived = true;
      });
  }

  private handlePage(page: OwnerPage) {
    this.owners = page.content;
    this.totalElements = page.totalElements;
    this.isOwnersDataReceived = true;
  }

  onSearchInput() {
    this.currentPage = 0;
    this.searchSubject.next(this.searchTerm);
  }

  onSearchEnter() {
    this.currentPage = 0;
    this.fetchPage();
  }

  onSortChange(field: SortField) {
    if (this.sortField === field) {
      this.sortDir = this.sortDir === 'ASC' ? 'DESC' : 'ASC';
    } else {
      this.sortField = field;
      this.sortDir = 'ASC';
    }
    this.currentPage = 0;
    this.fetchPage();
  }

  onPageSizeChange() {
    this.currentPage = 0;
    this.fetchPage();
  }

  prevPage() {
    if (this.currentPage > 0) {
      this.currentPage--;
      this.fetchPage();
    }
  }

  nextPage() {
    if ((this.currentPage + 1) * this.pageSize < this.totalElements) {
      this.currentPage++;
      this.fetchPage();
    }
  }

  get totalPages(): number {
    return Math.ceil(this.totalElements / this.pageSize);
  }

  onSelect(owner: Owner) {
    this.router.navigate(['/owners', owner.id]);
  }

  addOwner() {
    this.router.navigate(['/owners/add']);
  }
}
