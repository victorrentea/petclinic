import {Component, OnInit} from '@angular/core';
import {ActivatedRoute, ParamMap, Params, Router} from '@angular/router';
import {PageEvent} from '@angular/material/paginator';
import {Sort, SortDirection} from '@angular/material/sort';
import {EMPTY} from 'rxjs';
import {catchError, map, switchMap, tap} from 'rxjs/operators';
import {OwnerService} from '../owner.service';
import {Owner, OwnerPage, OwnerQuery} from '../owner';

const DEFAULT_QUERY: OwnerQuery = {page: 0, size: 10, sort: 'name,asc', lastName: ''};

@Component({
  selector: 'app-owner-list',
  templateUrl: './owner-list.component.html',
  styleUrls: ['./owner-list.component.css']
})
export class OwnerListComponent implements OnInit {
  readonly pageSizeOptions = [5, 10, 20];
  errorMessage: string;
  lastName = '';
  query = DEFAULT_QUERY;
  owners: Owner[] = [];
  totalElements: number;

  constructor(private router: Router, private route: ActivatedRoute, private ownerService: OwnerService) {
  }

  get sortActive(): string {
    return this.query.sort.split(',')[0];
  }

  get sortDirection(): SortDirection {
    return this.query.sort.split(',')[1] as SortDirection;
  }

  // The URL is the grid's only state: user actions navigate, and every URL change fetches.
  // Only the latest query may answer: switchMap drops a load still in flight when a newer
  // one starts, so a search is never overwritten by the answer to the query before it.
  ngOnInit() {
    this.route.queryParamMap.pipe(
      map(toQuery),
      tap(query => {
        this.query = query;
        this.lastName = query.lastName;
      }),
      switchMap(query => this.ownerService.getOwners(query).pipe(
        catchError(error => {
          this.errorMessage = error;
          return EMPTY;
        })))
    ).subscribe(page => this.show(page));
  }

  onPage({pageIndex, pageSize}: PageEvent) {
    this.navigate({page: pageIndex, size: pageSize});
  }

  onSort({active, direction}: Sort) {
    this.navigate({sort: `${active},${direction}`, page: 0});
  }

  searchByLastName(lastName: string) {
    this.navigate({lastName, page: 0});
  }

  onSelect(owner: Owner) {
    this.router.navigate(['/owners', owner.id]);
  }

  addOwner() {
    this.router.navigate(['/owners/add']);
  }

  private show({content, totalElements}: OwnerPage) {
    if (content.length === 0 && totalElements > 0) {
      const lastPage = Math.ceil(totalElements / this.query.size) - 1;
      this.navigate({page: lastPage}, true);
      return;
    }
    this.owners = content;
    this.totalElements = totalElements;
  }

  private navigate(changes: Partial<OwnerQuery>, replaceUrl = false) {
    const queryParams = toQueryParams({...this.query, ...changes});
    this.router.navigate([], {relativeTo: this.route, queryParams, replaceUrl});
  }
}

function toQuery(params: ParamMap): OwnerQuery {
  return {
    page: numberOr(params.get('page'), DEFAULT_QUERY.page),
    size: numberOr(params.get('size'), DEFAULT_QUERY.size),
    sort: params.get('sort') ?? DEFAULT_QUERY.sort,
    lastName: params.get('lastName') ?? DEFAULT_QUERY.lastName
  };
}

function numberOr(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return value !== null && Number.isInteger(parsed) ? parsed : fallback;
}

/** The query as URL params, leaving out every value equal to its default so `/owners` stays clean. */
function toQueryParams(query: OwnerQuery): Params {
  const params: Params = {};
  for (const key of Object.keys(query) as (keyof OwnerQuery)[]) {
    if (query[key] !== DEFAULT_QUERY[key]) {
      params[key] = query[key];
    }
  }
  return params;
}
