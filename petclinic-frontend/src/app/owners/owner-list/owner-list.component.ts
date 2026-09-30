import {Component, OnInit} from '@angular/core';
import {OwnerService} from '../owner.service';
import {Owner} from '../owner';
import {ActivatedRoute, Router} from '@angular/router';
import {switchMap} from 'rxjs/operators';
import {Sort} from '@angular/material/sort';
import {PageEvent} from '@angular/material/paginator';

type OwnerSort = 'name' | 'city';
type SortDir = 'asc' | 'desc';

const DEFAULT_SORT: OwnerSort = 'name';
const DEFAULT_DIR: SortDir = 'asc';
const DEFAULT_SIZE = 10;

@Component({
  selector: 'app-owner-list',
  templateUrl: './owner-list.component.html',
  styleUrls: ['./owner-list.component.css']
})
export class OwnerListComponent implements OnInit {
  errorMessage: string;
  lastName = '';
  sort: OwnerSort = DEFAULT_SORT;
  dir: SortDir = DEFAULT_DIR;
  page = 0;
  size = DEFAULT_SIZE;

  owners: Owner[];
  totalElements = 0;
  isOwnersDataReceived = false;
  loading = false;

  constructor(private router: Router, private route: ActivatedRoute, private ownerService: OwnerService) {
  }

  // The grid's state lives in the URL, so every navigation (search, sort, page, size)
  // re-enters here through queryParamMap; switchMap cancels a still-in-flight request
  // when a newer navigation lands, instead of the old manual load.unsubscribe().
  ngOnInit() {
    this.route.queryParamMap.pipe(
      switchMap(params => {
        this.lastName = params.get('lastName') || '';
        this.sort = (params.get('sort') as OwnerSort) || DEFAULT_SORT;
        this.dir = (params.get('dir') as SortDir) || DEFAULT_DIR;
        this.page = Number(params.get('page')) || 0;
        this.size = Number(params.get('size')) || DEFAULT_SIZE;
        this.loading = true;
        return this.ownerService.getOwners({
          lastName: this.lastName,
          sort: this.sort,
          dir: this.dir,
          page: this.page,
          size: this.size
        });
      })
    ).subscribe(
      ownerPage => {
        this.owners = ownerPage.content;
        this.totalElements = ownerPage.totalElements;
        this.isOwnersDataReceived = true;
        this.loading = false;
      },
      error => {
        this.errorMessage = error as any;
        this.isOwnersDataReceived = true;
        this.loading = false;
      });
  }

  onSelect(owner: Owner) {
    this.router.navigate(['/owners', owner.id]);
  }

  addOwner() {
    this.router.navigate(['/owners/add']);
  }

  search() {
    this.navigate({lastName: this.lastName, sort: this.sort, dir: this.dir, size: this.size, page: 0});
  }

  onSortChange(sortState: Sort) {
    const newDir: SortDir = sortState.direction === 'desc' ? 'desc' : 'asc';
    const sort = sortState.active as OwnerSort;
    this.navigate({lastName: this.lastName, sort, dir: newDir, size: this.size, page: 0});
  }

  onPageChange(event: PageEvent) {
    const page = event.pageSize !== this.size ? 0 : event.pageIndex;
    this.navigate({lastName: this.lastName, sort: this.sort, dir: this.dir, size: event.pageSize, page});
  }

  private navigate(query: {lastName: string; sort: OwnerSort; dir: SortDir; page: number; size: number}) {
    // The grid reacts to queryParamMap, not to this promise.
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        lastName: query.lastName || null,
        sort: query.sort,
        dir: query.dir,
        page: query.page,
        size: query.size
      }
    });
  }
}
