import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Sort, SortDirection } from '@angular/material/sort';
import { PageEvent } from '@angular/material/paginator';
import { switchMap } from 'rxjs/operators';
import { OwnerService } from '../owner.service';
import { OwnerPage } from '../owner-page';

@Component({
  selector: 'app-owner-list',
  templateUrl: './owner-list.component.html',
  styleUrls: ['./owner-list.component.css']
})
export class OwnerListComponent implements OnInit {
  readonly pageSizeOptions = [5, 10, 20];
  readonly displayedColumns = ['name', 'address', 'city', 'telephone', 'pets'];

  ownerPage: OwnerPage;
  page = 0;
  size = 10;
  sort = 'NAME';
  dir: SortDirection = 'asc';
  lastName = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private ownerService: OwnerService
  ) {
  }

  ngOnInit() {
    this.route.queryParams.pipe(
      switchMap(params => {
        this.page = params.page ? Number(params.page) : 0;
        this.size = params.size ? Number(params.size) : 10;
        this.sort = params.sort || 'NAME';
        this.dir = params.dir || 'asc';
        this.lastName = params.lastName || '';
        return this.ownerService.getOwnersPage({
          page: this.page,
          size: this.size,
          sort: this.sort,
          dir: this.dir,
          lastName: this.lastName
        });
      })
    ).subscribe(page => this.ownerPage = page);
  }

  onSelect(ownerId: number) {
    this.router.navigate(['/owners', ownerId]);
  }

  addOwner() {
    this.router.navigate(['/owners/add']);
  }

  onSortChange(sortState: Sort) {
    this.navigate({ sort: sortState.active, dir: sortState.direction });
  }

  onPageChange(event: PageEvent) {
    this.navigate({ page: event.pageIndex, size: event.pageSize });
  }

  search() {
    this.navigate({ lastName: this.lastName, page: 0 });
  }

  private navigate(queryParams: {}) {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }
}
