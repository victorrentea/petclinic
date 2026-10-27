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
        this.ownerPage = undefined;
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

  private navigate(query: OwnerQuery) {
    void this.router.navigate(['/owners'], {queryParams: {...query, lastName: query.lastName || undefined}});
  }
}

function toOwnerQuery(params: ParamMap): OwnerQuery {
  return {
    lastName: params.get('lastName') ?? '',
    page: Number(params.get('page')) || 0,
    size: Number(params.get('size')) || 10,
    sort: params.get('sort') || 'name'
  };
}
