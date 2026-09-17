import {Component, OnDestroy, OnInit} from '@angular/core';
import {OwnerService} from '../owner.service';
import {Owner} from '../owner';
import {Router} from '@angular/router';
import {EMPTY, Subject} from 'rxjs';
import {catchError, finalize, switchMap, takeUntil} from 'rxjs/operators';
import {PageEvent} from '@angular/material/paginator';
import {Sort} from '@angular/material/sort';

@Component({
  selector: 'app-owner-list',
  templateUrl: './owner-list.component.html',
  styleUrls: ['./owner-list.component.css']
})
export class OwnerListComponent implements OnInit, OnDestroy {
  displayedColumns = ['name', 'address', 'city', 'telephone', 'pets'];
  errorMessage: string;
  lastName: string = '';
  owners: Owner[] = [];
  totalElements = 0;
  pageIndex = 0;
  pageSize = 10;
  pageSizeOptions = [5, 10, 20];
  sortActive = 'name';
  sortDirection: 'asc' | 'desc' = 'asc';
  isOwnersDataReceived: boolean = false;

  private readonly reloadRequested = new Subject<void>();
  private readonly destroyed = new Subject<void>();

  constructor(private router: Router, private ownerService: OwnerService) {

  }

  ngOnInit() {
    // switchMap cancels an in-flight request when a newer one is issued, so a slow
    // response can never overwrite the grid with rows for a stale sort/page/filter.
    this.reloadRequested.pipe(
      switchMap(() => this.ownerService
        .getOwners(this.pageIndex, this.pageSize, `${this.sortActive},${this.sortDirection}`, this.lastName || undefined)
        .pipe(
          finalize(() => this.isOwnersDataReceived = true),
          catchError(error => {
            this.errorMessage = error as any;
            return EMPTY;
          })
        )),
      takeUntil(this.destroyed)
    ).subscribe(page => {
      this.owners = page.content;
      this.totalElements = page.totalElements;
    });
    this.loadOwners();
  }

  ngOnDestroy() {
    this.destroyed.next();
    this.destroyed.complete();
  }

  private loadOwners() {
    this.reloadRequested.next();
  }

  onSelect(owner: Owner) {
    this.router.navigate(['/owners', owner.id]);
  }

  addOwner() {
    this.router.navigate(['/owners/add']);
  }

  searchByLastName(lastName: string) {
    this.lastName = lastName;
    this.pageIndex = 0;
    this.loadOwners();
  }

  onSortChange(sort: Sort) {
    this.sortActive = sort.active;
    this.sortDirection = (sort.direction || 'asc') as 'asc' | 'desc';
    this.pageIndex = 0;
    this.loadOwners();
  }

  onPageChange(event: PageEvent) {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadOwners();
  }
}
