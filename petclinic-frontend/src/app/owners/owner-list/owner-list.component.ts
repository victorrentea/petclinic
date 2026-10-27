import {Component, OnDestroy, OnInit} from '@angular/core';
import {OwnerQuery, OwnerService} from '../owner.service';
import {Owner} from '../owner';
import {OwnerPage} from '../owner-page';
import {ActivatedRoute, ParamMap, Router} from '@angular/router';
import {catchError, map, switchMap, tap} from 'rxjs/operators';
import {EMPTY, Subscription} from 'rxjs';
import {PageEvent} from '@angular/material/paginator';
import {Sort, SortDirection} from '@angular/material/sort';

@Component({
  selector: 'app-owner-list',
  templateUrl: './owner-list.component.html',
  styleUrls: ['./owner-list.component.css']
})
export class OwnerListComponent implements OnInit, OnDestroy {
  readonly pageSizeOptions = [5, 10, 20];
  errorMessage: string;
  lastName: string;
  query: OwnerQuery;
  ownerPage: OwnerPage;
  private subscription: Subscription;

  constructor(private readonly router: Router, private readonly route: ActivatedRoute,
              private readonly ownerService: OwnerService) {
  }

  get sortActive(): string {
    return this.query.sort.split(',')[0];
  }

  get sortDirection(): SortDirection {
    return this.query.sort.split(',')[1] === 'desc' ? 'desc' : 'asc';
  }

  ngOnInit() {
    this.subscription = this.route.queryParamMap.pipe(
      map(toOwnerQuery),
      tap(query => {
        this.query = query;
        this.lastName = query.lastName;
        this.errorMessage = undefined;
      }),
      switchMap(query => this.ownerService.getOwners(query).pipe(
        catchError(error => {
          this.errorMessage = error;
          return EMPTY;
        })))
    ).subscribe(ownerPage => this.ownerPage = ownerPage);
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  onSelect(owner: Owner) {
    this.router.navigate(['/owners', owner.id]);
  }

  addOwner() {
    this.router.navigate(['/owners/add']);
  }

  searchByLastName(lastName: string) {
    this.navigate({...this.query, lastName, page: 0});
  }

  onPage({pageIndex, pageSize}: PageEvent) {
    const page = pageSize === this.query.size ? pageIndex : 0;
    this.navigate({...this.query, page, size: pageSize});
  }

  onSort({active, direction}: Sort) {
    this.navigate({...this.query, page: 0, sort: `${active},${direction}`});
  }

  trackByOwnerId(index: number, owner: Owner): number {
    return owner.id;
  }

  private navigate(query: OwnerQuery) {
    void this.router.navigate(['/owners'], {
      queryParams: {...query, page: query.page + 1, lastName: query.lastName || undefined}
    });
  }
}

// The URL's page number is 1-based (human-friendly); internally
// (OwnerQuery, mat-paginator, the backend API) it stays 0-based.
function toOwnerQuery(params: ParamMap): OwnerQuery {
  const urlPage = Number(params.get('page')) || 1;
  return {
    lastName: params.get('lastName') ?? '',
    page: Math.max(0, urlPage - 1),
    size: Number(params.get('size')) || 10,
    sort: params.get('sort') || 'name'
  };
}
