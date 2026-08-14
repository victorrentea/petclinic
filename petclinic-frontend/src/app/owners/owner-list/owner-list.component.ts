import {Component, OnInit} from '@angular/core';
import {OwnerPage, OwnerQuery, OwnerService} from '../owner.service';
import {Owner} from '../owner';
import {ActivatedRoute, ParamMap, Router} from '@angular/router';
import {Sort, SortDirection} from '@angular/material/sort';
import {PageEvent} from '@angular/material/paginator';
import {of} from 'rxjs';
import {catchError, map, switchMap, tap} from 'rxjs/operators';

const PAGE_SIZE_OPTIONS = [5, 10, 20];
const DEFAULT_QUERY: OwnerQuery = {lastName: '', page: 0, size: 10, sort: 'name,asc'};

@Component({
  selector: 'app-owner-list',
  templateUrl: './owner-list.component.html',
  styleUrls: ['./owner-list.component.css']
})
export class OwnerListComponent implements OnInit {
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;

  /** The single source of view state - always a mirror of the query parameters. */
  view: OwnerQuery = {...DEFAULT_QUERY};
  /** Bound to the search box, so a fruitless search leaves the term there to be corrected. */
  searchTerm = '';
  ownerPage: OwnerPage | null = null;
  loadFailed = false;
  loading = false;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private ownerService: OwnerService
  ) {
  }

  ngOnInit() {
    this.route.queryParamMap.pipe(
      map(params => this.readView(params)),
      tap(view => {
        this.view = view;
        this.searchTerm = view.lastName;
        this.loading = true;
        this.loadFailed = false;
      }),
      switchMap(view => this.ownerService.getOwners(view).pipe(
        catchError(() => of(null))
      ))
    ).subscribe(page => {
      this.ownerPage = page;
      this.loadFailed = page === null;
      this.loading = false;
    });
  }

  get owners(): Owner[] {
    return this.ownerPage ? this.ownerPage.content : [];
  }

  get totalElements(): number {
    return this.ownerPage ? this.ownerPage.totalElements : 0;
  }

  get sortActive(): string {
    return this.view.sort.split(',')[0];
  }

  get sortDirection(): SortDirection {
    return this.view.sort.split(',')[1] === 'desc' ? 'desc' : 'asc';
  }

  get hasResults(): boolean {
    return !this.loadFailed && this.owners.length > 0;
  }

  /** A search that matched nothing - distinct from an empty database. */
  get noSearchMatches(): boolean {
    return this.isLoaded && this.totalElements === 0 && this.view.lastName !== '';
  }

  get noOwnersAtAll(): boolean {
    return this.isLoaded && this.totalElements === 0 && this.view.lastName === '';
  }

  /** Rows exist, just not on the requested page index. */
  get pageIsPastTheEnd(): boolean {
    return this.isLoaded && this.totalElements > 0 && this.owners.length === 0;
  }

  private get isLoaded(): boolean {
    return !this.loadFailed && !this.loading && this.ownerPage !== null;
  }

  petNames(owner: Owner): string {
    return (owner.pets || []).map(pet => pet.name).join(', ');
  }

  onSelect(owner: Owner) {
    this.router.navigate(['/owners', owner.id]);
  }

  addOwner() {
    this.router.navigate(['/owners/add']);
  }

  /** Changing the sort returns to page 1; Back must leave the grid, not replay sort clicks. */
  onSortChange(sort: Sort) {
    this.navigate({sort: `${sort.active},${sort.direction || 'asc'}`, page: 0}, true);
  }

  /** Only the pager changes the page index - and changing the size still returns to page 1. */
  onPageChange(event: PageEvent) {
    const sizeChanged = event.pageSize !== this.view.size;
    this.navigate({page: sizeChanged ? 0 : event.pageIndex, size: event.pageSize}, true);
  }

  searchByLastName(lastName: string) {
    this.navigate({lastName: lastName || '', page: 0}, false);
  }

  goToFirstPage() {
    this.navigate({page: 0}, true);
  }

  private navigate(changes: Partial<OwnerQuery>, replaceUrl: boolean) {
    const next: OwnerQuery = {...this.view, ...changes};
    this.router.navigate([], {relativeTo: this.route, queryParams: {...next}, replaceUrl});
  }

  private readView(params: ParamMap): OwnerQuery {
    const page = Number(params.get('page'));
    const size = Number(params.get('size'));
    return {
      lastName: params.get('lastName') || '',
      page: Number.isInteger(page) && page > 0 ? page : DEFAULT_QUERY.page,
      size: PAGE_SIZE_OPTIONS.indexOf(size) >= 0 ? size : DEFAULT_QUERY.size,
      sort: params.get('sort') || DEFAULT_QUERY.sort
    };
  }
}
