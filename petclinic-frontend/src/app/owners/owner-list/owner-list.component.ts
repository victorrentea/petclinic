import {Component, OnDestroy, OnInit} from '@angular/core';
import {OwnerService} from '../owner.service';
import {Owner} from '../owner';
import {DEFAULT_OWNER_QUERY, EMPTY_OWNER_PAGE, OwnerQuery} from '../owner-page';
import {ActivatedRoute, Router} from '@angular/router';
import {fromQueryParams, toQueryParams} from './owner-list-url';
import {OwnerListState} from './owner-list-state';
import {Sort} from '@angular/material/sort';
import {PageEvent} from '@angular/material/paginator';
import {BehaviorSubject, of, Subscription} from 'rxjs';
import {catchError, switchMap} from 'rxjs/operators';

@Component({
  selector: 'app-owner-list',
  templateUrl: './owner-list.component.html',
  styleUrls: ['./owner-list.component.css']
})
export class OwnerListComponent implements OnInit, OnDestroy {
  readonly columns = ['name', 'address', 'city', 'telephone', 'pets'];
  readonly pageSizes = [5, 10, 20];
  lastName: string;
  owners: Owner[] = [];
  totalElements = 0;
  isOwnersDataReceived = false;
  query: OwnerQuery = DEFAULT_OWNER_QUERY;
  private queries: BehaviorSubject<OwnerQuery>;
  private subscription: Subscription;

  constructor(private router: Router, private route: ActivatedRoute, private ownerService: OwnerService,
              private state: OwnerListState) {
  }

  ngOnInit() {
    this.query = fromQueryParams(this.route.snapshot?.queryParams);
    this.lastName = this.query.lastName;
    this.state.lastQuery = this.query;
    this.queries = new BehaviorSubject(this.query);
    // switchMap: a newer query drops the answer to an older one still in flight.
    this.subscription = this.queries.pipe(
      switchMap(query => this.ownerService.getOwners(query).pipe(
        catchError(() => of(EMPTY_OWNER_PAGE))))
    ).subscribe(page => {
      this.owners = page.content;
      this.totalElements = page.totalElements;
      this.isOwnersDataReceived = true;
    });
  }

  ngOnDestroy() {
    this.subscription?.unsubscribe();
  }

  searchByLastName(lastName: string) {
    this.load({...this.query, lastName: lastName ?? '', page: 0});
  }

  onSortChange(sort: Sort) {
    this.load({...this.query, sort: sort.active as OwnerQuery['sort'], dir: sort.direction || 'asc', page: 0});
  }

  onPage(event: PageEvent) {
    const sizeChanged = event.pageSize !== this.query.size;
    this.load({...this.query, size: event.pageSize as OwnerQuery['size'], page: sizeChanged ? 0 : event.pageIndex});
  }

  onSelect(owner: Owner) {
    this.router.navigate(['/owners', owner.id]);
  }

  addOwner() {
    this.router.navigate(['/owners/add']);
  }

  private load(query: OwnerQuery) {
    this.query = query;
    this.state.lastQuery = query;
    this.router.navigate([], {relativeTo: this.route, queryParams: toQueryParams(query), replaceUrl: true});
    this.queries.next(query);
  }
}
