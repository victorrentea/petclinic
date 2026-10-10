import {Component, OnDestroy, OnInit} from '@angular/core';
import {ActivatedRoute, ParamMap, Params, Router} from '@angular/router';
import {PageEvent} from '@angular/material/paginator';
import {Sort} from '@angular/material/sort';
import {EMPTY, Subscription} from 'rxjs';
import {catchError, map, switchMap, tap} from 'rxjs/operators';
import {VisitService} from '../visit.service';
import {VisitPage} from '../visit-page';

/** What the grid shows, as kept in the URL: `page` is 1-based there, and `sort` is spelled as the API spells it. */
interface VisitsPageQuery {
  page: number;
  size: number;
  sort: string;
}

const DEFAULTS: VisitsPageQuery = {page: 1, size: 10, sort: 'date,desc'};
const PAGE_SIZES = [5, 10, 20];
const SORTS = /^(date|description|pet|owner),(asc|desc)$/;

// The URL is the only source of the query: every user action navigates, and the page is loaded
// from whatever the URL then says — so Back, a refresh and a click all take the same path.
@Component({
  selector: 'app-visits-page',
  templateUrl: './visits-page.component.html',
  styleUrls: ['./visits-page.component.css'],
})
export class VisitsPageComponent implements OnInit, OnDestroy {
  readonly pageSizes = PAGE_SIZES;
  query: VisitsPageQuery = DEFAULTS;
  page: VisitPage | undefined;
  errorMessage: string | undefined;
  private load: Subscription;

  constructor(private readonly router: Router, private readonly route: ActivatedRoute,
              private readonly visitService: VisitService) {}

  ngOnInit(): void {
    this.load = this.route.queryParamMap.pipe(
      map(fromUrl),
      tap(query => this.query = query),
      // switchMap: only the latest query may answer, however late an earlier one comes back
      switchMap(query => this.visitService.getVisitsPage(
        {page: query.page - 1, size: query.size, sort: query.sort}).pipe(
        catchError(error => {
          this.errorMessage = String(error);
          this.page = undefined;
          return EMPTY;
        })))
    ).subscribe(page => this.show(page));
  }

  ngOnDestroy(): void {
    this.load?.unsubscribe();
  }

  onPage(event: PageEvent): void {
    const sizeChanged = event.pageSize !== this.query.size;
    this.navigate({size: event.pageSize, page: sizeChanged ? 1 : event.pageIndex + 1});
  }

  onSort(sort: Sort): void {
    this.navigate({sort: `${sort.active},${sort.direction || 'asc'}`, page: 1});
  }

  get sortColumn(): string {
    return this.query.sort.split(',')[0];
  }

  get sortDirection(): 'asc' | 'desc' {
    return this.query.sort.endsWith('desc') ? 'desc' : 'asc';
  }

  private show(page: VisitPage): void {
    this.errorMessage = undefined;
    const pastTheEnd = page.content.length === 0 && page.totalElements > 0;
    if (pastTheEnd) {
      this.navigate({page: page.totalPages}, true);
      return;
    }
    this.page = page;
  }

  private navigate(change: Partial<VisitsPageQuery>, replaceUrl = false): void {
    const queryParams = toUrl({...this.query, ...change});
    this.router.navigate([], {relativeTo: this.route, queryParams, replaceUrl})
      .catch(error => this.errorMessage = String(error));
  }
}

function fromUrl(params: ParamMap): VisitsPageQuery {
  const page = Number(params.get('page'));
  const size = Number(params.get('size'));
  const sort = params.get('sort') ?? '';
  return {
    page: Number.isInteger(page) && page >= 1 ? page : DEFAULTS.page,
    size: PAGE_SIZES.includes(size) ? size : DEFAULTS.size,
    sort: SORTS.test(sort) ? sort : DEFAULTS.sort,
  };
}

/** Only what differs from the defaults goes into the URL, so an untouched grid stays at a bare /visits. */
function toUrl(query: VisitsPageQuery): Params {
  const params: Params = {};
  for (const key of Object.keys(DEFAULTS) as (keyof VisitsPageQuery)[]) {
    if (query[key] !== DEFAULTS[key]) {
      params[key] = query[key];
    }
  }
  return params;
}
