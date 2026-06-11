import {Component, OnInit} from '@angular/core';
import {OwnerService} from '../owner.service';
import {Owner} from '../owner';
import {OwnerPage} from '../owner-page';
import {ActivatedRoute, Router} from '@angular/router';
import {Sort, SortDirection} from '@angular/material/sort';
import {PageEvent} from '@angular/material/paginator';
import {finalize} from 'rxjs/operators';

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
  pageSize = 10;
  sortActive = 'name';
  sortDirection: SortDirection = 'asc';
  lastName = '';
  loading = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private ownerService: OwnerService
  ) {
  }

  ngOnInit() {
    this.route.queryParamMap.subscribe(params => {
      this.pageIndex = Number(params.get('page') ?? 0);
      this.pageSize = Number(params.get('size') ?? 10);
      const [active, direction] = (params.get('sort') ?? 'name,asc').split(',');
      this.sortActive = active || 'name';
      this.sortDirection = direction === 'desc' ? 'desc' : 'asc';
      this.lastName = params.get('lastName') ?? '';
      this.loadPage();
    });
  }

  private loadPage() {
    this.loading = true;
    this.ownerService.getOwnersPage({
      page: this.pageIndex,
      size: this.pageSize,
      sort: `${this.sortActive},${this.sortDirection}`,
      lastName: this.lastName
    }).pipe(finalize(() => this.loading = false))
      .subscribe((page: OwnerPage) => {
        this.owners = page.content ?? [];
        this.totalElements = page.page?.totalElements ?? 0;
        this.clampToLastPageIfNeeded();
      });
  }

  private clampToLastPageIfNeeded() {
    if (this.totalElements === 0) {
      return;
    }
    const lastPage = Math.ceil(this.totalElements / this.pageSize) - 1;
    if (this.pageIndex > lastPage) {
      this.updateUrl({page: lastPage});
    }
  }

  onSortChange(sort: Sort) {
    this.updateUrl({sort: `${sort.active},${sort.direction || 'asc'}`, page: 0});
  }

  onPageChange(event: PageEvent) {
    this.updateUrl({page: event.pageIndex, size: event.pageSize});
  }

  search() {
    this.updateUrl({lastName: this.lastName || null, page: 0});
  }

  private updateUrl(changes: {[key: string]: string | number | null}) {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: changes,
      queryParamsHandling: 'merge'
    });
  }

  displayName(owner: Owner): string {
    return `${owner.lastName}, ${owner.firstName}`;
  }

  petNames(owner: Owner): string {
    return (owner.pets ?? []).map(pet => pet.name).join(', ');
  }

  onSelect(owner: Owner) {
    this.router.navigate(['/owners', owner.id]);
  }

  addOwner() {
    this.router.navigate(['/owners/add']);
  }
}
