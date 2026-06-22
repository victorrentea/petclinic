import {Component, OnInit} from '@angular/core';
import {OwnerService} from '../owner.service';
import {Owner} from '../owner';
import {Router} from '@angular/router';
import { finalize } from 'rxjs/operators';

type SortDir = 'asc' | 'desc';

@Component({
  selector: 'app-owner-list',
  templateUrl: './owner-list.component.html',
  styleUrls: ['./owner-list.component.css']
})
export class OwnerListComponent implements OnInit {
  errorMessage: string;
  query: string = '';
  owners: Owner[];
  isOwnersDataReceived: boolean = false;

  sortField: string = '';
  sortDir: SortDir = 'asc';
  pageIndex: number = 0;
  pageSize: number = 10;
  totalElements: number = 0;
  totalPages: number = 0;

  readonly pageSizeOptions: number[] = [5, 10, 20];

  constructor(private router: Router, private ownerService: OwnerService) {

  }

  ngOnInit() {
    this.loadOwners();
  }

  loadOwners() {
    this.ownerService.getOwners({
      q: this.query,
      page: this.pageIndex,
      size: this.pageSize,
      sort: this.sortField ? this.sortField + ',' + this.sortDir : undefined
    }).pipe(
      finalize(() => {
        this.isOwnersDataReceived = true;
      })
    ).subscribe(
      page => {
        this.owners = page.content;
        this.totalElements = page.totalElements;
        this.totalPages = page.totalPages;
        this.pageIndex = page.number;
        this.pageSize = page.size;
      },
      error => {
        this.owners = null;
        this.errorMessage = error as any;
      });
  }

  search(query: string) {
    this.query = query;
    this.pageIndex = 0;
    this.loadOwners();
  }

  sortBy(field: string) {
    if (this.sortField === field) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDir = 'asc';
    }
    this.pageIndex = 0;
    this.loadOwners();
  }

  goToPage(pageIndex: number) {
    if (pageIndex < 0 || pageIndex >= this.totalPages || pageIndex === this.pageIndex) {
      return;
    }
    this.pageIndex = pageIndex;
    this.loadOwners();
  }

  changePageSize(size: number) {
    this.pageSize = Number(size);
    this.pageIndex = 0;
    this.loadOwners();
  }

  get pageNumbers(): number[] {
    return Array.from({length: this.totalPages}, (_, i) => i);
  }

  onSelect(owner: Owner) {
    this.router.navigate(['/owners', owner.id]);
  }

  addOwner() {
    this.router.navigate(['/owners/add']);
  }
}
