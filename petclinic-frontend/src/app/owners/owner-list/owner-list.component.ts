import {Component, OnDestroy, OnInit} from '@angular/core';
import {FormControl} from '@angular/forms';
import {OwnerService} from '../owner.service';
import {Owner} from '../owner';
import {Router} from '@angular/router';
import {debounceTime, distinctUntilChanged, map, startWith, switchMap} from 'rxjs/operators';
import {Subscription} from 'rxjs';

@Component({
  selector: 'app-owner-list',
  templateUrl: './owner-list.component.html',
  styleUrls: ['./owner-list.component.css']
})
export class OwnerListComponent implements OnInit, OnDestroy {
  errorMessage: string;
  searchControl = new FormControl('');
  owners: Owner[];
  isOwnersDataReceived: boolean = false;

  private subscription: Subscription;

  constructor(private router: Router, private ownerService: OwnerService) {}

  ngOnInit() {
    this.subscription = this.searchControl.valueChanges.pipe(
      startWith(''),
      debounceTime(300),
      map(value => (value || '').trim()),
      distinctUntilChanged(),
      switchMap(value => this.ownerService.searchOwners(value))
    ).subscribe({
      next: owners => {
        this.owners = owners;
        this.isOwnersDataReceived = true;
      },
      error: error => this.errorMessage = error
    });
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
