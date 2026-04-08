import {Component, OnInit} from '@angular/core';
import {OwnerService} from '../owner.service';
import {Owner} from '../owner';
import {Router} from '@angular/router';
import {PageEvent} from '@angular/material/paginator';
import {Sort} from '@angular/material/sort';
import {finalize} from 'rxjs/operators';

@Component({
  selector: 'app-owner-list',
  templateUrl: './owner-list.component.html',
  styleUrls: ['./owner-list.component.css']
})
export class OwnerListComponent implements OnInit {
  errorMessage: string;
  lastName: string;
  owners: Owner[];
  isOwnersDataReceived = false;

  totalElements = 0;
  pageIndex = 0;
  pageSize = 20;
  sort: string[] | undefined;

  constructor(private router: Router, private ownerService: OwnerService) {}

  ngOnInit() {
    this.loadOwners();
  }

  private loadOwners() {
    this.isOwnersDataReceived = false;
    const request$ = this.lastName
      ? this.ownerService.searchOwners(this.lastName, this.pageIndex, this.pageSize, this.sort)
      : this.ownerService.getOwners(this.pageIndex, this.pageSize, this.sort);

    request$.pipe(finalize(() => this.isOwnersDataReceived = true))
      .subscribe(
        page => {
          this.owners = page.content;
          this.totalElements = page.totalElements;
        },
        error => this.errorMessage = error as any
      );
  }

  onPageChange(event: PageEvent) {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadOwners();
  }

  onSortChange(sort: Sort) {
    if (!sort.active || !sort.direction) {
      this.sort = undefined;
    } else if (sort.active === 'lastName') {
      // Name column shows "firstName lastName" — sort by firstName then lastName
      this.sort = [`firstName,${sort.direction}`, `lastName,${sort.direction}`];
    } else {
      this.sort = [`${sort.active},${sort.direction}`];
    }
    this.pageIndex = 0;
    this.loadOwners();
  }

  onSelect(owner: Owner) {
    this.router.navigate(['/owners', owner.id]);
  }

  addOwner() {
    this.router.navigate(['/owners/add']);
  }

  searchByLastName(lastName: string) {
    this.pageIndex = 0;
    this.lastName = lastName || undefined;
    this.loadOwners();
  }
}
