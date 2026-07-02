import {Component, OnInit, ViewChild} from '@angular/core';
import {OwnerService} from '../owner.service';
import {Owner} from '../owner';
import {Router} from '@angular/router';
import {finalize} from 'rxjs/operators';
import {MatPaginator, PageEvent} from '@angular/material/paginator';
import {MatSort, Sort} from '@angular/material/sort';

@Component({
  selector: 'app-owner-list',
  templateUrl: './owner-list.component.html',
  styleUrls: ['./owner-list.component.css']
})
export class OwnerListComponent implements OnInit {
  readonly displayedColumns = ['name', 'address', 'city', 'telephone', 'pets'];
  readonly pageSizeOptions = [5, 10, 20];

  errorMessage: string;
  lastName = '';
  owners: Owner[] = [];
  isOwnersDataReceived = false;

  // server-side pagination + sorting state (page is zero-based, matching Spring & MatPaginator)
  totalElements = 0;
  pageIndex = 0;
  pageSize = 10;
  sortParam = 'name,asc';

  @ViewChild(MatPaginator) paginator: MatPaginator;
  @ViewChild(MatSort) sort: MatSort;

  constructor(private router: Router, private ownerService: OwnerService) {
  }

  ngOnInit() {
    this.load();
  }

  private load() {
    this.ownerService.getOwnersPage({
      lastName: this.lastName,
      page: this.pageIndex,
      size: this.pageSize,
      sort: this.sortParam
    }).pipe(
      finalize(() => this.isOwnersDataReceived = true)
    ).subscribe(
      page => {
        this.owners = page.content ?? [];
        this.totalElements = page.page?.totalElements ?? 0;
      },
      error => this.errorMessage = error as any);
  }

  onSortChange(sort: Sort) {
    // a header toggles asc -> desc -> unsorted; fall back to the default when cleared
    this.sortParam = sort.direction ? `${sort.active},${sort.direction}` : 'name,asc';
    this.pageIndex = 0;
    this.load();
  }

  onPageChange(event: PageEvent) {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.load();
  }

  searchByLastName(lastName: string) {
    // a new search returns to the first page but keeps the current sort and page size
    this.lastName = lastName ?? '';
    this.pageIndex = 0;
    this.load();
  }

  petNames(owner: Owner): string {
    return (owner.pets ?? []).map(pet => pet.name).join(', ');
  }

  onSelect(owner: Owner) {
    this.router.navigate(['/owners', owner.id]);
  }

  addOwner() {
    this.router.navigate(['/owners/add']);
  }
}
