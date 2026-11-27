import {Component, OnDestroy, OnInit} from '@angular/core';
import {ActivatedRoute, ParamMap, Router} from '@angular/router';
import {PageEvent} from '@angular/material/paginator';
import {Sort, SortDirection} from '@angular/material/sort';
import {Subscription} from 'rxjs';
import {map, switchMap, tap} from 'rxjs/operators';
import {OwnerQuery, OwnerService} from '../owner.service';
import {OwnerPage} from '../owner-page';
import {Owner} from '../owner';

const DEFAULT_QUERY: OwnerQuery = {lastName: '', page: 0, size: 10, sort: 'name,asc'};

/**
 * GH #25: one page of owners at a time. The URL holds the search, page, size and sort, so Back
 * from an owner returns to the same page; every user action only navigates.
 */
@Component({
  selector: 'app-owner-list',
  templateUrl: './owner-list.component.html',
  styleUrls: ['./owner-list.component.css']
})
export class OwnerListComponent implements OnInit, OnDestroy {
  readonly pageSizes = [5, 10, 20];
  query: OwnerQuery = DEFAULT_QUERY;
  lastName = '';
  page: OwnerPage;
  private load: Subscription;

  constructor(private router: Router, private route: ActivatedRoute, private ownerService: OwnerService) {
  }

  get sortActive(): string {
    return this.query.sort.split(',')[0];
  }

  get sortDirection(): SortDirection {
    return (this.query.sort.split(',')[1] || 'asc') as SortDirection;
  }

  ngOnInit() {
    // switchMap: only the latest query may answer, a slow earlier one is dropped
    this.load = this.route.queryParamMap.pipe(
      map(toQuery),
      tap(query => this.query = query),
      tap(query => this.lastName = query.lastName),
      switchMap(query => this.ownerService.getOwners(query))
    ).subscribe(page => this.show(page));
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

  searchByLastName(lastName: string) {
    this.navigate({lastName: lastName || '', page: 0});
  }

  onPage(event: PageEvent) {
    const sizeChanged = event.pageSize !== this.query.size;
    this.navigate({page: sizeChanged ? 0 : event.pageIndex, size: event.pageSize});
  }

  onSort(sort: Sort) {
    this.navigate({sort: `${sort.active},${sort.direction || 'asc'}`, page: 0});
  }

  private show(page: OwnerPage) {
    const pastTheEnd = page.totalPages > 0 && page.number >= page.totalPages;
    if (pastTheEnd) {
      this.navigate({page: page.totalPages - 1}, true);
      return;
    }
    this.page = page;
  }

  private navigate(changes: Partial<OwnerQuery>, replaceUrl = false) {
    this.router.navigate([], {relativeTo: this.route, queryParams: {...this.query, ...changes}, replaceUrl});
  }
}

function toQuery(params: ParamMap): OwnerQuery {
  return {
    lastName: params.get('lastName') ?? DEFAULT_QUERY.lastName,
    page: Number(params.get('page') ?? DEFAULT_QUERY.page),
    size: Number(params.get('size') ?? DEFAULT_QUERY.size),
    sort: params.get('sort') ?? DEFAULT_QUERY.sort
  };
}
