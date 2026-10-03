import {Component, OnDestroy, OnInit} from '@angular/core';
import {Router} from '@angular/router';
import {PageEvent} from '@angular/material/paginator';
import {Sort, SortDirection} from '@angular/material/sort';
import {Subscription} from 'rxjs';
import {OwnerService} from '../owner.service';
import {Owner} from '../owner';
import {FIRST_OWNER_PAGE, OwnerPage, OwnerPageQuery, OwnerSort} from '../owner-page';

@Component({
  selector: 'app-owner-list',
  templateUrl: './owner-list.component.html',
  styleUrls: ['./owner-list.component.css']
})
export class OwnerListComponent implements OnInit, OnDestroy {
  readonly pageSizeOptions = [5, 10, 20];
  draftLastName = '';
  query: OwnerPageQuery = FIRST_OWNER_PAGE;
  page: OwnerPage | null = null;
  loading = false;
  errorMessage: string | null = null;
  private request?: Subscription;

  constructor(private router: Router, private ownerService: OwnerService) {
  }

  get sortKey(): string {
    return this.query.sort.split(',')[0];
  }

  get sortDirection(): SortDirection {
    return this.query.sort.split(',')[1] as SortDirection;
  }

  ngOnInit() {
    this.load(FIRST_OWNER_PAGE);
  }

  ngOnDestroy() {
    this.request?.unsubscribe();
  }

  search() {
    this.load({...this.query, lastName: this.draftLastName, page: 0});
  }

  onPage(event: PageEvent) {
    const sizeChanged = event.pageSize !== this.query.size;
    this.load({...this.query, size: event.pageSize, page: sizeChanged ? 0 : event.pageIndex});
  }

  onSort(sort: Sort) {
    if (sort.direction) {
      this.load({...this.query, sort: `${sort.active},${sort.direction}` as OwnerSort, page: 0});
    }
  }

  onSelect(owner: Owner) {
    this.router.navigate(['/owners', owner.id]);
  }

  addOwner() {
    this.router.navigate(['/owners/add']);
  }

  // Unsubscribing the previous request first means only the latest one can still
  // touch the rows, the total, the loading flag or the error.
  private load(query: OwnerPageQuery) {
    this.request?.unsubscribe();
    this.query = query;
    this.loading = true;
    this.errorMessage = null;
    this.request = this.ownerService.listOwners(query).subscribe({
      next: page => {
        this.page = page;
        this.loading = false;
      },
      error: () => {
        this.page = null;
        this.errorMessage = 'The owners could not be loaded. Please try again.';
        this.loading = false;
      }
    });
  }
}
