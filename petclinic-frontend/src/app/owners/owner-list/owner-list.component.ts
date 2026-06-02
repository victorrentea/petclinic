import {Component, OnInit} from '@angular/core';
import {OwnerService} from '../owner.service';
import {Owner, Page} from '../owner';
import {Router, ActivatedRoute} from '@angular/router';
import {Sort} from '@angular/material/sort';
import {PageEvent} from '@angular/material/paginator';

@Component({
  selector: 'app-owner-list',
  templateUrl: './owner-list.component.html',
  styleUrls: ['./owner-list.component.css']
})
export class OwnerListComponent implements OnInit {
  ownersPage: Page<Owner> | null = null;
  lastName = '';
  page = 0;
  size = 10;
  sort = 'firstName,asc';
  errorMessage = '';

  constructor(private router: Router, private route: ActivatedRoute, private ownerService: OwnerService) {}

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      this.lastName = params['lastName'] || '';
      this.page = +params['page'] || 0;
      this.size = +params['size'] || 10;
      this.sort = params['sort'] || 'firstName,asc';
      this.ownerService.searchOwnersPaged(this.lastName, this.page, this.size, this.sort)
        .subscribe(p => this.ownersPage = p, (err: any) => this.errorMessage = err);
    });
  }

  searchByLastName(lastName: string) {
    this.router.navigate([], { relativeTo: this.route,
      queryParams: { lastName, page: 0, size: this.size, sort: this.sort } });
  }

  onSortChange(sort: Sort) {
    const sortParam = sort.direction ? sort.active + ',' + sort.direction : 'firstName,asc';
    this.router.navigate([], { relativeTo: this.route,
      queryParams: { lastName: this.lastName, page: 0, size: this.size, sort: sortParam } });
  }

  onPageChange(event: PageEvent) {
    this.router.navigate([], { relativeTo: this.route,
      queryParams: { lastName: this.lastName, page: event.pageIndex, size: event.pageSize, sort: this.sort } });
  }

  onSelect(owner: Owner) { this.router.navigate(['/owners', owner.id]); }
  addOwner() { this.router.navigate(['/owners/add']); }
}
