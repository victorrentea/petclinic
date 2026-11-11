import {Component, OnDestroy, OnInit} from '@angular/core';
import {EMPTY, Subject, Subscription} from 'rxjs';
import {catchError, switchMap} from 'rxjs/operators';
import {PageEvent} from '@angular/material/paginator';
import {Sort} from '@angular/material/sort';
import {VisitService} from '../visit.service';
import {VisitPage, VisitRow} from '../visit';

@Component({
  selector: 'app-visits-page',
  templateUrl: './visits-page.component.html',
  styleUrls: ['./visits-page.component.css'],
})
export class VisitsPageComponent implements OnInit, OnDestroy {
  readonly pageSizes = [5, 10, 20];
  visits: VisitRow[] = [];
  totalVisits = 0;
  pageIndex = 0;
  pageSize = 10;
  isDataReceived = false;
  // No column chosen yet (or the third click cleared it): the server's default, newest first.
  private sort: Sort = {active: '', direction: ''};
  private readonly reload = new Subject<void>();
  private subscription: Subscription;

  constructor(private readonly visitService: VisitService) {}

  ngOnInit(): void {
    // switchMap: a fast second click drops the first click's late answer.
    // A failed load keeps the page shown, and must not end the stream that serves the next click.
    this.subscription = this.reload.pipe(
      switchMap(() => this.visitService.getVisitPage(
        this.pageIndex, this.pageSize, this.sort.active, this.sort.direction || undefined)
        .pipe(catchError(() => EMPTY))),
    ).subscribe(page => this.show(page));
    this.reload.next();
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  onSort(sort: Sort): void {
    this.sort = sort;
    this.pageIndex = 0;
    this.reload.next();
  }

  onPage(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.reload.next();
  }

  private show(page: VisitPage): void {
    this.visits = page.content ?? [];
    this.totalVisits = page.page?.totalElements ?? 0;
    this.isDataReceived = true;
  }
}
