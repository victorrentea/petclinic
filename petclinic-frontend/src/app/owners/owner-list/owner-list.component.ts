import {Component, OnInit} from '@angular/core';
import {OwnerService} from '../owner.service';
import {OwnerListItem} from '../owner';
import {OwnerPage} from '../owner-page';
import {ActivatedRoute, Router} from '@angular/router';
import {finalize} from 'rxjs/operators';

/** Properties the backend allows sorting the owners list by - see `OwnerRestController`. */
type SortableProperty = 'lastName' | 'city';
type SortDirection = 'asc' | 'desc';

@Component({
  selector: 'app-owner-list',
  templateUrl: './owner-list.component.html',
  styleUrls: ['./owner-list.component.css']
})
export class OwnerListComponent implements OnInit {
  readonly pageSizes = [5, 10, 20];

  errorMessage: string;
  lastName = '';
  ownerPage: OwnerPage;
  isOwnersDataReceived = false;

  page = 0;
  size = 10;
  sortProperty: SortableProperty = 'lastName';
  sortDirection: SortDirection = 'asc';

  constructor(private route: ActivatedRoute, private router: Router, private ownerService: OwnerService) {
  }

  ngOnInit() {
    // ActivatedRoute.queryParams emits the current params immediately on subscribe,
    // so this both loads the initial (possibly bookmarked) state and reacts to
    // later browser back/forward navigation between pages.
    this.route.queryParams.subscribe(params => {
      this.readStateFrom(params);
      this.fetchOwners();
    });
  }

  get owners(): OwnerListItem[] {
    return this.ownerPage?.content ?? [];
  }

  get sortParam(): string {
    return `${this.sortProperty},${this.sortDirection}`;
  }

  onSelect(owner: OwnerListItem) {
    this.router.navigate(['/owners', owner.id]);
  }

  addOwner() {
    this.router.navigate(['/owners/add']);
  }

  searchByLastName(lastName: string) {
    this.lastName = lastName;
    this.page = 0;
    this.fetchOwners();
    this.syncUrl();
  }

  sortBy(property: SortableProperty) {
    this.sortDirection = this.sortProperty === property && this.sortDirection === 'asc' ? 'desc' : 'asc';
    this.sortProperty = property;
    this.page = 0;
    this.fetchOwners();
    this.syncUrl();
  }

  changePageSize(size: number) {
    this.size = size;
    this.page = 0;
    this.fetchOwners();
    this.syncUrl();
  }

  goToPage(page: number) {
    if (page >= 0 && page < this.ownerPage.totalPages) {
      this.page = page;
      this.fetchOwners();
      this.syncUrl();
    }
  }

  private readStateFrom(params: {[key: string]: string}) {
    this.page = params.page !== undefined ? Number(params.page) : 0;
    this.size = params.size !== undefined ? Number(params.size) : 10;
    const [property, direction] = (params.sort ?? 'lastName,asc').split(',');
    this.sortProperty = property as SortableProperty;
    this.sortDirection = (direction as SortDirection) || 'asc';
  }

  /** Reflects the current page/size/sort in the URL so it stays bookmarkable, without re-fetching. */
  private syncUrl() {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {page: this.page, size: this.size, sort: this.sortParam}
    });
  }

  private fetchOwners() {
    const request = this.lastName
      ? this.ownerService.searchOwners(this.lastName, this.page, this.size, this.sortParam)
      : this.ownerService.getOwners(this.page, this.size, this.sortParam);

    request.pipe(
      finalize(() => this.isOwnersDataReceived = true)
    ).subscribe(
      ownerPage => this.ownerPage = ownerPage,
      error => this.errorMessage = error as any);
  }
}
