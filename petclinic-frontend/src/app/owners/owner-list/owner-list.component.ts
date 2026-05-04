import { Component, OnDestroy, OnInit } from '@angular/core';
import { OwnerService } from '../owner.service';
import { Owner } from '../owner';
import { Router } from '@angular/router';
import { FormControl } from '@angular/forms';
import { Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, startWith, switchMap } from 'rxjs/operators';

@Component({
  selector: 'app-owner-list',
  templateUrl: './owner-list.component.html',
  styleUrls: ['./owner-list.component.css']
})
export class OwnerListComponent implements OnInit, OnDestroy {
  errorMessage: string;
  owners: Owner[];
  isOwnersDataReceived: boolean = false;

  readonly searchControl = new FormControl('');
  private subscription: Subscription;

  constructor(private router: Router, private ownerService: OwnerService) {
  }

  ngOnInit() {
    this.subscription = this.searchControl.valueChanges.pipe(
      debounceTime(300),
      startWith(this.searchControl.value ?? ''),
      distinctUntilChanged(),
      switchMap(q => {
        const trimmed = (q ?? '').trim();
        return trimmed
          ? this.ownerService.searchOwners(trimmed)
          : this.ownerService.getOwners();
      })
    ).subscribe(
      owners => {
        this.owners = owners;
        this.isOwnersDataReceived = true;
      },
      error => this.errorMessage = error as any
    );
  }

  ngOnDestroy() {
    this.subscription?.unsubscribe();
  }

  onSelect(owner: Owner) {
    this.router.navigate(['/owners', owner.id]);
  }

  addOwner() {
    this.router.navigate(['/owners/add']);
  }
}
