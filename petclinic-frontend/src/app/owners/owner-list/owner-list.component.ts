import {Component, OnDestroy, OnInit} from '@angular/core';
import {OwnerService} from '../owner.service';
import {Owner} from '../owner';
import {OwnerPage, OwnerQuery} from '../owner-page';
import {ActivatedRoute, Params, Router} from '@angular/router';
import {PageEvent} from '@angular/material/paginator';
import {Sort, SortDirection} from '@angular/material/sort';
import {Subscription} from 'rxjs';
import {switchMap, tap} from 'rxjs/operators';

const DEFAULT_SORT = 'name,asc';

function optionalNumber(param?: string): number | undefined {
  return param === undefined ? undefined : Number(param);
}

function toQuery({page, size, sort, lastName}: Params): OwnerQuery {
  return {page: optionalNumber(page), size: optionalNumber(size), sort, lastName};
}

@Component({
  selector: 'app-owner-list',
  templateUrl: './owner-list.component.html',
  styleUrls: ['./owner-list.component.css']
})
export class OwnerListComponent implements OnInit, OnDestroy {
  lastName = '';
  searchedLastName = '';
  sortColumn: string;
  sortDirection: SortDirection;
  page: OwnerPage;
  private load: Subscription;

  constructor(private router: Router, private route: ActivatedRoute, private ownerService: OwnerService) {

  }

  ngOnInit() {
    this.load = this.route.queryParams.pipe(
      tap(params => this.reflectInControls(params)),
      switchMap(params => this.ownerService.getOwners(toQuery(params)))
    ).subscribe(page => this.show(page));
  }

  // A late answer must not redirect the user out of wherever they went next.
  ngOnDestroy() {
    this.load.unsubscribe();
  }

  onSelect(owner: Owner) {
    this.router.navigate(['/owners', owner.id]);
  }

  addOwner() {
    this.router.navigate(['/owners/add']);
  }

  searchByLastName(lastName: string) {
    this.navigate({page: 0, lastName: lastName || null});
  }

  onSortChange({active, direction}: Sort) {
    this.navigate({page: 0, sort: `${active},${direction}`});
  }

  // The paginator keeps the first visible owner on a size change, so it reports a page index
  // that has to be ignored.
  onPageChange({pageIndex, pageSize}: PageEvent) {
    const sizeChanged = pageSize !== this.page.size;
    this.navigate(sizeChanged ? {page: 0, size: pageSize} : {page: pageIndex});
  }

  private reflectInControls(params: Params) {
    this.lastName = this.searchedLastName = params.lastName ?? '';
    const [column, direction] = `${params.sort ?? DEFAULT_SORT}`.split(',');
    this.sortColumn = column;
    this.sortDirection = direction === 'desc' ? 'desc' : 'asc'; // MatSort throws on anything else
  }

  private show(page: OwnerPage) {
    const isPastTheEnd = page.content.length === 0 && page.totalElements > 0;
    if (isPastTheEnd) {
      this.navigate({page: page.totalPages - 1}, true);
    } else {
      this.page = page;
    }
  }

  private navigate(queryParams: Params, replaceUrl = false) {
    this.router.navigate([], {relativeTo: this.route, queryParams, queryParamsHandling: 'merge', replaceUrl});
  }
}
