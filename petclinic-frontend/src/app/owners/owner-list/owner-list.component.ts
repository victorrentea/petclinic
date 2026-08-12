import {Component, OnInit} from '@angular/core';
import {OwnerService} from '../owner.service';
import {Owner} from '../owner';
import {OwnerPage} from '../owner-page';
import {Router} from '@angular/router';
import {PageEvent} from '@angular/material/paginator';

@Component({
  selector: 'app-owner-list',
  templateUrl: './owner-list.component.html',
  styleUrls: ['./owner-list.component.css']
})
export class OwnerListComponent implements OnInit {
  errorMessage: string;
  lastName: string = '';

  owners: Owner[] = [];
  totalElements = 0;
  totalPages = 0;

  currentPage = 0;
  pageSize = 10;
  sortKey = 'name';
  sortDirection = 'asc';

  isOwnersDataReceived: boolean = false;

  constructor(private router: Router, private ownerService: OwnerService) {}

  ngOnInit() {
    this.loadOwners();
  }

  private loadOwners() {
    this.isOwnersDataReceived = false;
    const obs = this.lastName
      ? this.ownerService.searchOwners(this.lastName, this.currentPage, this.pageSize, this.sortKey, this.sortDirection)
      : this.ownerService.getOwners(this.currentPage, this.pageSize, this.sortKey, this.sortDirection);

    obs.subscribe({
      next: (page: OwnerPage) => {
        this.owners = page.content ?? [];
        this.totalElements = page.page?.totalElements ?? 0;
        this.totalPages = page.page?.totalPages ?? 0;
        this.isOwnersDataReceived = true;
      },
      error: (err) => {
        this.errorMessage = err as any;
        this.isOwnersDataReceived = true;
      }
    });
  }

  onSelect(owner: Owner) {
    this.router.navigate(['/owners', owner.id]);
  }

  addOwner() {
    this.router.navigate(['/owners/add']);
  }

  searchByLastName(lastName: string) {
    this.lastName = lastName;
    this.currentPage = 0; // reset to first page on new search
    this.loadOwners();
  }

  onPageChange(event: PageEvent) {
    this.currentPage = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadOwners();
  }

  sortBy(column: 'name' | 'city') {
    if (this.sortKey === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortKey = column;
      this.sortDirection = 'asc';
    }
    this.loadOwners();
  }
}
