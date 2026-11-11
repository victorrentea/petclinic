import {Component, OnInit} from '@angular/core';
import {ActivatedRoute, Params, Router} from '@angular/router';
import {Sort, SortDirection} from '@angular/material/sort';
import {PageEvent} from '@angular/material/paginator';
import {switchMap, tap} from 'rxjs/operators';
import {VisitService} from '../visit.service';
import {VisitPage, VisitRow} from '../visit';

/** The visits grid. Its page, size and sort live in the URL, so a reload or Back shows the same rows. */
@Component({
  selector: 'app-visits-page',
  templateUrl: './visits-page.component.html',
  styleUrls: ['./visits-page.component.css'],
})
export class VisitsPageComponent implements OnInit {
  readonly pageSizes = [5, 10, 20];
  visits: VisitRow[] = [];
  page = 0;
  size = 10;
  totalElements = 0;
  sortColumn = 'date';
  sortDirection: SortDirection = 'desc';
  isDataReceived = false;

  constructor(private visitService: VisitService, private route: ActivatedRoute, private router: Router) {}

  ngOnInit(): void {
    this.route.queryParams
      .pipe(
        tap(() => this.isDataReceived = false),
        switchMap(({page, size, sort}) => this.visitService.getVisitPage({page, size, sort})),
      )
      .subscribe(served => this.show(served));
  }

  onSort(sort: Sort): void {
    this.navigate({sort: `${sort.active},${sort.direction}`, page: null});
  }

  onPage(event: PageEvent): void {
    this.navigate({page: event.pageIndex, size: event.pageSize});
  }

  private show(served: VisitPage): void {
    this.visits = served.content;
    this.page = served.page;
    this.size = served.size;
    this.totalElements = served.totalElements;
    const [column, direction] = served.sort.split(',');
    this.sortColumn = column;
    this.sortDirection = direction as SortDirection;
    this.isDataReceived = true;
  }

  private navigate(queryParams: Params): void {
    this.router.navigate([], {relativeTo: this.route, queryParams, queryParamsHandling: 'merge'});
  }
}
