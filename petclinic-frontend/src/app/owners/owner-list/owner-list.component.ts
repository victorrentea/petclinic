import {Component, OnInit} from '@angular/core';
import {OwnerService} from '../owner.service';
import {Owner} from '../owner';
import {ActivatedRoute, Params, Router} from '@angular/router';
import {PageEvent} from '@angular/material/paginator';
import {Sort} from '@angular/material/sort';

const DEFAULT_SORT = 'name,asc';
const DEFAULT_SIZE = 10;

@Component({
  selector: 'app-owner-list',
  templateUrl: './owner-list.component.html',
  styleUrls: ['./owner-list.component.css']
})
export class OwnerListComponent implements OnInit {
  readonly displayedColumns = ['name', 'address', 'city', 'telephone', 'pets'];
  readonly pageSizeOptions = [5, 10, 20];

  owners: Owner[] = [];
  totalElements = 0;
  pageIndex = 0;
  pageSize = DEFAULT_SIZE;
  sortActive = 'name';
  sortDirection: 'asc' | 'desc' = 'asc';
  lastName = '';
  errorMessage = '';
  isOwnersDataReceived = false;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private ownerService: OwnerService
  ) {
  }

  // URL query params are the source of truth: every paging/sort/search action
  // navigates (merging params) and a single load() rebuilds the request from them,
  // so refresh, back/forward and deep-links reproduce the same view.
  ngOnInit() {
    this.route.queryParams.subscribe(params => this.load(params));
  }

  private load(params: Params) {
    this.pageIndex = +params['page'] || 0;
    this.pageSize = +params['size'] || DEFAULT_SIZE;
    const [active, direction] = (params['sort'] || DEFAULT_SORT).split(',');
    this.sortActive = active;
    this.sortDirection = direction === 'desc' ? 'desc' : 'asc';
    this.lastName = params['lastName'] || '';

    this.ownerService.listOwners({
      page: this.pageIndex,
      size: this.pageSize,
      sort: `${this.sortActive},${this.sortDirection}`,
      lastName: this.lastName
    }).subscribe({
      next: page => {
        this.owners = page.content ?? [];
        this.totalElements = page.totalElements ?? 0;
        this.isOwnersDataReceived = true;
      },
      error: err => {
        this.errorMessage = err;
        this.isOwnersDataReceived = true;
      }
    });
  }

  petNames(owner: Owner): string {
    return (owner.pets ?? []).map(pet => pet.name).join(', ');
  }

  onPage(event: PageEvent) {
    this.navigate({page: event.pageIndex, size: event.pageSize});
  }

  onSortChange(sort: Sort) {
    // New sort restarts from the first page.
    this.navigate({sort: `${sort.active},${sort.direction || 'asc'}`, page: 0});
  }

  search() {
    // New search resets to the first page.
    this.navigate({lastName: this.lastName || null, page: 0});
  }

  private navigate(queryParams: Params) {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge'
    });
  }

  onSelect(owner: Owner) {
    this.router.navigate(['/owners', owner.id]);
  }

  addOwner() {
    this.router.navigate(['/owners/add']);
  }
}
