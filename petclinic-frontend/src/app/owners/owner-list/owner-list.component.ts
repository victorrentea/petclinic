import {Component, OnDestroy, OnInit} from '@angular/core';
import {Router} from '@angular/router';
import {PageEvent} from '@angular/material/paginator';
import {Sort} from '@angular/material/sort';
import {Subscription} from 'rxjs';
import {OwnerService} from '../owner.service';
import {Owner} from '../owner';
import {OwnerQuery} from '../owner-page';

type SortKey = 'name' | 'city';
type SortDirection = 'asc' | 'desc';

@Component({
  selector: 'app-owner-list',
  templateUrl: './owner-list.component.html',
  styleUrls: ['./owner-list.component.css']
})
export class OwnerListComponent implements OnInit, OnDestroy {
  readonly pageSizeOptions = [5, 10, 20];
  lastName = '';
  submittedLastName = '';
  pageIndex = 0;
  pageSize = 10;
  sortKey: SortKey = 'name';
  sortDirection: SortDirection = 'asc';

  owners: Owner[] = [];
  totalElements = 0;
  loading = false;
  loaded = false;
  errorMessage: string | null = null;
  private load?: Subscription;

  constructor(private router: Router, private ownerService: OwnerService) {
  }

  ngOnInit() {
    this.loadPage();
  }

  ngOnDestroy() {
    this.load?.unsubscribe();
  }

  onSelect(owner: Owner) {
    this.router.navigate(['/owners', owner.id]);
  }

  addOwner() {
    this.router.navigate(['/owners/add']);
  }

  search() {
    this.submittedLastName = this.lastName;
    this.pageIndex = 0;
    this.loadPage();
  }

  onPage(event: PageEvent) {
    const sizeChanged = event.pageSize !== this.pageSize;
    this.pageSize = event.pageSize;
    this.pageIndex = sizeChanged ? 0 : event.pageIndex;
    this.loadPage();
  }

  onSort(sort: Sort) {
    this.sortKey = sort.active as SortKey;
    this.sortDirection = sort.direction as SortDirection;
    this.pageIndex = 0;
    this.loadPage();
  }

  // Unsubscribing the previous request first means only the latest one can ever answer:
  // a cancelled observable delivers neither its value nor its error.
  private loadPage() {
    this.load?.unsubscribe();
    this.loading = true;
    this.errorMessage = null;
    const query: OwnerQuery = {
      lastName: this.submittedLastName,
      page: this.pageIndex,
      size: this.pageSize,
      sort: `${this.sortKey},${this.sortDirection}`
    };
    this.load = this.ownerService.getOwners(query).subscribe(
      page => {
        this.owners = page.content;
        this.totalElements = page.totalElements;
        this.loading = false;
        this.loaded = true;
      },
      error => {
        this.errorMessage = String(error);
        this.loading = false;
      });
  }
}
