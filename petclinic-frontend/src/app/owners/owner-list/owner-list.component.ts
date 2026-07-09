import { Component, OnInit } from '@angular/core';
import { OwnerService } from '../owner.service';
import { Owner } from '../owner';
import { Router } from '@angular/router';
import { PageEvent } from '@angular/material/paginator';
import { Sort } from '@angular/material/sort';

@Component({
  selector: 'app-owner-list',
  templateUrl: './owner-list.component.html',
  styleUrls: ['./owner-list.component.css']
})
export class OwnerListComponent implements OnInit {
  // Only Name and City are sortable server-side (index-backed); the rest render without a sort header.
  readonly displayedColumns = ['name', 'address', 'city', 'telephone', 'pets'];
  readonly pageSizeOptions = [5, 10, 20];

  owners: Owner[] = [];
  totalElements = 0;
  pageIndex = 0;
  pageSize = 10;
  sort: 'name' | 'city' = 'name';
  dir: 'asc' | 'desc' = 'asc';
  lastName = '';
  errorMessage = '';
  isOwnersDataReceived = false;

  constructor(private router: Router, private ownerService: OwnerService) {
  }

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.ownerService.getOwners({
      page: this.pageIndex,
      size: this.pageSize,
      sort: this.sort,
      dir: this.dir,
      lastName: this.lastName
    }).subscribe({
      next: page => {
        this.owners = page.content;
        this.totalElements = page.totalElements;
        this.isOwnersDataReceived = true;
      },
      error: err => {
        this.errorMessage = err as string;
        this.isOwnersDataReceived = true;
      }
    });
  }

  onPage(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.load();
  }

  onSort(event: Sort): void {
    if (!event.direction) {
      this.sort = 'name';
      this.dir = 'asc';
    } else {
      this.sort = event.active as 'name' | 'city';
      this.dir = event.direction;
    }
    this.pageIndex = 0; // a changed sort invalidates the current page offset
    this.load();
  }

  search(): void {
    this.pageIndex = 0; // a changed filter invalidates the current page offset
    this.load();
  }

  onSelect(owner: Owner): void {
    this.router.navigate(['/owners', owner.id]);
  }

  addOwner(): void {
    this.router.navigate(['/owners/add']);
  }
}
