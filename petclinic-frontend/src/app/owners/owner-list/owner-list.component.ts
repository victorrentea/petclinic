import { Component, OnDestroy, OnInit } from '@angular/core';
import { OwnerService } from '../owner.service';
import { Owner } from '../owner';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { distinctUntilChanged, switchMap, takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-owner-list',
  templateUrl: './owner-list.component.html',
  styleUrls: ['./owner-list.component.css']
})
export class OwnerListComponent implements OnInit, OnDestroy {
  errorMessage = '';
  searchTerm = '';
  owners: Owner[] = [];
  isOwnersDataReceived = false;

  private readonly destroy$ = new Subject<void>();
  private readonly searchTerms$ = new Subject<string>();

  constructor(private router: Router, private ownerService: OwnerService) {}

  ngOnInit() {
    this.searchTerms$.pipe(
      distinctUntilChanged(),
      switchMap(searchTerm => this.ownerService.searchOwners(searchTerm)),
      takeUntil(this.destroy$)
    ).subscribe(
      owners => {
        this.owners = owners;
        this.isOwnersDataReceived = true;
      },
      error => {
        this.errorMessage = error as string;
        this.owners = [];
        this.isOwnersDataReceived = true;
      }
    );
    this.onSearchTermChange('');
  }

  onSelect(owner: Owner) {
    this.router.navigate(['/owners', owner.id]);
  }

  addOwner() {
    this.router.navigate(['/owners/add']);
  }

  onSearchTermChange(searchTerm: string) {
    this.searchTerms$.next(searchTerm);
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
