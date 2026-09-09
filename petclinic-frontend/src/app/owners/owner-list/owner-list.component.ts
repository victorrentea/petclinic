import { Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatSort, Sort } from '@angular/material/sort';
import { switchMap } from 'rxjs/operators';

import { OwnerService } from '../owner.service';
import { Owner } from '../owner';
import {
  DEFAULT_PAGE_SIZE,
  DEFAULT_SORT,
  OwnerPage,
  OwnerQuery,
  PAGE_SIZES,
} from '../owner-page';

/**
 * The grid is a projection of the URL, never of its own fields: every user action
 * navigates, and the query parameters are what triggers a reload. Refresh, Back and a
 * pasted link therefore all take the same path as a click — one behaviour to test
 * instead of three.
 */
@Component({
  selector: 'app-owner-list',
  templateUrl: './owner-list.component.html',
  styleUrls: ['./owner-list.component.css'],
})
export class OwnerListComponent implements OnInit {
  readonly pageSizes = PAGE_SIZES;

  errorMessage: string;
  /** Bound to the search box; only applied to the URL when the search is submitted. */
  lastName = '';
  page: OwnerPage = emptyPage();
  isOwnersDataReceived = false;

  @ViewChild(MatPaginator) paginator: MatPaginator;
  @ViewChild(MatSort) sort: MatSort;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private ownerService: OwnerService
  ) {}

  ngOnInit() {
    this.route.queryParamMap
      .pipe(
        switchMap((params) => {
          const query = toQuery(params);
          this.lastName = query.lastName;
          return this.ownerService.getOwnerPage(query);
        })
      )
      .subscribe(
        (page) => {
          this.page = page;
          this.isOwnersDataReceived = true;
        },
        (error) => (this.errorMessage = error as any)
      );
  }

  get owners(): Owner[] {
    return this.page.content;
  }

  /** True only once a page has actually come back holding nothing. */
  get isEmpty(): boolean {
    return this.isOwnersDataReceived && this.page.totalElements === 0;
  }

  get activeSortColumn(): string {
    return this.page ? currentSortColumn(this.route.snapshot.queryParamMap.get('sort')) : 'name';
  }

  get activeSortDirection(): 'asc' | 'desc' {
    return currentSortDirection(this.route.snapshot.queryParamMap.get('sort'));
  }

  /** The whole Pets list as one line, for the cell's tooltip. */
  petNamesOf(owner: Owner): string {
    return owner.pets.map((pet) => pet.name).join(', ');
  }

  onSelect(owner: Owner) {
    this.router.navigate(['/owners', owner.id]);
  }

  addOwner() {
    this.router.navigate(['/owners/add']);
  }

  /** A new search starts at the first page, keeping whatever sort is in effect. */
  searchByLastName(lastName: string) {
    this.navigate({ lastName: lastName ?? '', page: 0 });
  }

  onPage(event: PageEvent) {
    this.navigate({ page: event.pageIndex, size: event.pageSize });
  }

  onSort(event: Sort) {
    this.navigate({ sort: `${event.active},${event.direction || 'asc'}`, page: 0 });
  }

  private navigate(changes: Partial<OwnerQuery>) {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: changes,
      queryParamsHandling: 'merge',
    });
  }
}

function toQuery(params: { get(key: string): string | null }): OwnerQuery {
  return {
    lastName: params.get('lastName') ?? '',
    page: Number(params.get('page') ?? 0),
    size: Number(params.get('size') ?? DEFAULT_PAGE_SIZE),
    sort: params.get('sort') ?? DEFAULT_SORT,
  };
}

function currentSortColumn(sort: string | null): string {
  return (sort ?? DEFAULT_SORT).split(',')[0];
}

function currentSortDirection(sort: string | null): 'asc' | 'desc' {
  return (sort ?? DEFAULT_SORT).split(',')[1] === 'desc' ? 'desc' : 'asc';
}

function emptyPage(): OwnerPage {
  return { content: [], totalElements: 0, totalPages: 0, number: 0, size: DEFAULT_PAGE_SIZE };
}
