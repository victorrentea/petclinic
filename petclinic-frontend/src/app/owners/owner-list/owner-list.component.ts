import {Component, OnDestroy, OnInit} from '@angular/core';
import {OwnerService} from '../owner.service';
import {Owner} from '../owner';
import {DEFAULT_OWNER_QUERY, OwnerQuery, ownerQueryFrom, PAGE_SIZES, urlParamsOf} from '../owner-page';
import {ActivatedRoute, Router} from '@angular/router';
import {Sort} from '@angular/material/sort';
import {PageEvent} from '@angular/material/paginator';
import {finalize} from 'rxjs/operators';
import {Subscription} from 'rxjs';

@Component({
  selector: 'app-owner-list',
  templateUrl: './owner-list.component.html',
  styleUrls: ['./owner-list.component.css']
})
export class OwnerListComponent implements OnInit, OnDestroy {
  readonly columns = ['name', 'address', 'city', 'telephone', 'pets'];
  readonly pageSizes = PAGE_SIZES;
  errorMessage: string;
  lastName = '';
  owners: Owner[] = [];
  totalOwners = 0;
  isOwnersDataReceived = false;
  query: OwnerQuery = DEFAULT_OWNER_QUERY;
  private load: Subscription;
  private urlChanges: Subscription;

  constructor(private router: Router, private route: ActivatedRoute, private ownerService: OwnerService) {
  }

  // The view lives in the address bar: a refresh, a Back from an owner or a link someone shared
  // shows the same search, sort and page. Every change goes through the URL, which then fetches.
  ngOnInit() {
    this.urlChanges = this.route.queryParamMap.subscribe(params => {
      this.query = ownerQueryFrom(params);
      this.lastName = this.query.lastName;
      this.fetch();
    });
  }

  ngOnDestroy() {
    this.urlChanges?.unsubscribe();
    this.load?.unsubscribe();
  }

  get sortKey(): string {
    return this.query.sort.split(',')[0];
  }

  get sortDirection(): 'asc' | 'desc' {
    return this.query.sort.split(',')[1] as 'asc' | 'desc';
  }

  onSelect(owner: Owner) {
    this.router.navigate(['/owners', owner.id]);
  }

  addOwner() {
    this.router.navigate(['/owners/add']);
  }

  // A new search, sort or page size shows its first page: page 3 of another result means nothing.
  search() {
    this.show({lastName: this.lastName ?? '', page: 0});
  }

  onSort(sort: Sort) {
    this.show({sort: `${sort.active},${sort.direction}`, page: 0});
  }

  onPage(event: PageEvent) {
    const sizeChanged = event.pageSize !== this.query.size;
    this.show({size: event.pageSize, page: sizeChanged ? 0 : event.pageIndex});
  }

  petNames(owner: Owner): string {
    return owner.pets.map(pet => pet.name).join(', ');
  }

  // The same view again (searching the same name twice) leaves the URL as it is, and the router
  // ignores a navigation to the URL it is on: ask again directly.
  private show(change: Partial<OwnerQuery>) {
    const next = {...this.query, ...change};
    if (JSON.stringify(urlParamsOf(next)) === JSON.stringify(urlParamsOf(this.query))) {
      this.fetch();
    } else {
      this.router.navigate([], {relativeTo: this.route, queryParams: urlParamsOf(next)});
    }
  }

  // Only the latest query may answer: a page asked for while an earlier one is still in
  // flight would otherwise be overwritten by the earlier one when it lands afterwards.
  private fetch() {
    this.load?.unsubscribe();
    this.load = this.ownerService.getOwnersPage(this.query).pipe(
      finalize(() => this.isOwnersDataReceived = true)
    ).subscribe(
      page => {
        this.owners = page.content;
        this.totalOwners = page.totalElements;
        this.errorMessage = null;
      },
      error => this.errorMessage = error);
  }
}
