import {Component, OnInit} from '@angular/core';
import {OwnerService} from '../owner.service';
import {Owner} from '../owner';
import {Router} from '@angular/router';
import { finalize } from 'rxjs/operators';
import { OwnerPage } from '../owner-page';

@Component({
  selector: 'app-owner-list',
  templateUrl: './owner-list.component.html',
  styleUrls: ['./owner-list.component.css']
})
export class OwnerListComponent implements OnInit {
  errorMessage: string;
  lastName: string = '';
  owners: Owner[] = [];
  totalElements: number = 0;
  totalPages: number = 0;
  pageIndex: number = 0;
  pageSize: number = 5;
  activeSortField: string = 'name';
  activeSortDirection: 'asc' | 'desc' = 'asc';
  isOwnersDataReceived: boolean = false;

  constructor(private router: Router, private ownerService: OwnerService) {

  }

  ngOnInit() {
    this.loadOwners();
  }

  onSelect(owner: Owner) {
    this.router.navigate(['/owners', owner.id]);
  }

  addOwner() {
    this.router.navigate(['/owners/add']);
  }

  searchByLastName(lastName: string) {
    this.lastName = lastName ?? '';
    this.pageIndex = 0;
    this.loadOwners();
  }

  onSort(field: string) {
    this.activeSortDirection = this.activeSortField === field && this.activeSortDirection === 'asc' ? 'desc' : 'asc';
    this.activeSortField = field;
    this.pageIndex = 0;
    this.loadOwners();
  }

  onPageSizeChange(pageSize: number) {
    this.pageSize = Number(pageSize);
    this.pageIndex = 0;
    this.loadOwners();
  }

  onPreviousPage() {
    if (this.pageIndex === 0) {
      return;
    }
    this.pageIndex--;
    this.loadOwners();
  }

  onNextPage() {
    if (this.pageIndex >= this.totalPages - 1) {
      return;
    }
    this.pageIndex++;
    this.loadOwners();
  }

  isSortedBy(field: string): boolean {
    return this.activeSortField === field;
  }

  sortIndicator(field: string): string {
    if (!this.isSortedBy(field)) {
      return '';
    }
    return this.activeSortDirection === 'asc' ? '↑' : '↓';
  }

  private loadOwners() {
    this.ownerService.getOwners(this.lastName, this.pageIndex, this.pageSize, this.currentSort()).pipe(
      finalize(() => {
        this.isOwnersDataReceived = true;
      })
    ).subscribe(
      ownerPage => this.updateOwnerPage(ownerPage),
      error => this.errorMessage = error as any);
  }

  private updateOwnerPage(ownerPage: OwnerPage) {
    this.owners = ownerPage.content ?? [];
    this.totalElements = ownerPage.totalElements ?? 0;
    this.totalPages = ownerPage.totalPages ?? 0;
    this.pageIndex = ownerPage.number ?? 0;
    this.pageSize = ownerPage.size ?? this.pageSize;
  }

  private currentSort(): string[] {
    if (this.activeSortField === 'name') {
      return [
        `lastName,${this.activeSortDirection}`,
        `firstName,${this.activeSortDirection}`,
        'id,asc'
      ];
    }
    return [`${this.activeSortField},${this.activeSortDirection}`];
  }

}
